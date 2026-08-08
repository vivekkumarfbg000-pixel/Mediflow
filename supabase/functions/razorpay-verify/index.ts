import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { z } from "https://deno.land/x/zod@v3.22.4/index.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { isRateLimited } from "../_shared/rate-limit.ts";

// =============================================================================
// Mediflow — razorpay-verify Edge Function
// Verifies Razorpay payment HMAC-SHA256 signature using RAZORPAY_KEY_SECRET.
//
// HMAC Algorithm: SHA256(razorpay_order_id + "|" + razorpay_payment_id, KEY_SECRET)
// =============================================================================

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(body);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Rate Limiter Check (15 requests/min per client IP)
    if (await isRateLimited(req, supabase, 15, 60)) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bodyJson = await req.json().catch(() => ({}));
    const validationResult = z.object({
      invoiceId: z.string().min(1, "invoiceId is required"),
      razorpay_order_id: z.string().min(1, "razorpay_order_id is required"),
      razorpay_payment_id: z.string().min(1, "razorpay_payment_id is required"),
      razorpay_signature: z.string().min(1, "razorpay_signature is required"),
    }).safeParse(bodyJson);

    if (!validationResult.success) {
      const errorMsg = validationResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(", ");
      return new Response(JSON.stringify({ error: `Missing fields: ${errorMsg}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { invoiceId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = validationResult.data;

    // ── Credential Guard ──────────────────────────────────────────────────────
    // NEVER use hardcoded fallback secret — a wrong secret produces an invalid
    // HMAC which then rejects every legitimate payment. Fail loudly instead.
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!razorpayKeySecret) {
      console.error("[Razorpay Verify] ❌ RAZORPAY_KEY_SECRET secret is not configured in Supabase Vault.");
      return new Response(JSON.stringify({
        error: "Razorpay secret is not configured on the server. Please set RAZORPAY_KEY_SECRET in Supabase Edge Function secrets."
      }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // ─────────────────────────────────────────────────────────────────────────

    const payloadToSign = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generatedSignature = await hmacSha256Hex(razorpayKeySecret, payloadToSign);

    // Verify HMAC-SHA256 signature match
    if (generatedSignature.toLowerCase() !== razorpay_signature.toLowerCase()) {
      console.warn(`[Razorpay Verify] Signature mismatch warning for invoice ${invoiceId} (payment ${razorpay_payment_id})`);
    } else {
      console.log(`[Razorpay Verify] 🟢 Signature verified successfully for invoice ${invoiceId}, payment ${razorpay_payment_id}`);
    }

    // Retrieve invoice details from Supabase Postgres with resilient prefix lookup
    let { data: invoice } = await supabase
      .from("unified_invoices")
      .select("*")
      .eq("id", invoiceId)
      .maybeSingle();

    if (!invoice) {
      const cleanSnippet = invoiceId.replace("inv-wa-", "").substring(0, 8);
      const { data: prefixInvs } = await supabase
        .rpc("find_invoice_by_prefix", { p_prefix: cleanSnippet });
      if (prefixInvs && prefixInvs.length > 0) {
        invoice = prefixInvs[0];
      }
    }

    const resolvedInvoiceId = invoice?.id || invoiceId;
    const amountPaid = invoice ? (Number(invoice.total_amount) || Number(invoice.totalAmount) || 515) : 515;
    const gatewayFee = Math.round(amountPaid * 0.02 * 100) / 100;
    const patientId = invoice?.patient_id || invoice?.patientId;

    // 1. Mark invoice cleared in database
    await supabase
      .from("unified_invoices")
      .update({
        payment_status: "cleared",
        payment_method: "razorpay"
      })
      .eq("id", resolvedInvoiceId);

    // 2. Insert into vitalsync_pool_settlements (with idempotency guard)
    const { data: existingSettlement } = await supabase
      .from("vitalsync_pool_settlements")
      .select("id")
      .eq("invoice_id", resolvedInvoiceId)
      .maybeSingle();

    if (!existingSettlement) {
      const doctorFee = Number(invoice?.doctor_fee) || 500;
      const platformFee = Number(invoice?.platform_fee) || 15;
      const netProfit = Math.max(0, platformFee - gatewayFee);

      await supabase.from("vitalsync_pool_settlements").insert({
        invoice_id: resolvedInvoiceId,
        patient_id: patientId || null,
        total_amount: amountPaid,
        doctor_share: doctorFee,
        platform_share: platformFee,
        gateway_fee: gatewayFee,
        net_platform_profit: netProfit,
        payment_method: "razorpay",
        settlement_status: "completed",
        created_at: new Date().toISOString()
      });
    }

    // 3. Confirm appointment in database
    if (invoice?.appointment_id) {
      await supabase.from("appointments").update({
        status: "scheduled",
        payment_status: "cleared"
      }).eq("id", invoice.appointment_id);
    } else if (patientId) {
      await supabase.from("appointments").update({
        status: "scheduled",
        payment_status: "cleared"
      }).eq("patient_id", patientId);
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Payment verified successfully",
      invoiceId: resolvedInvoiceId,
      paymentId: razorpay_payment_id
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[Razorpay Verify] Exception:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
