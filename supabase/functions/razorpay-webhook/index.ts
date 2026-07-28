import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { getCorsHeaders } from "../_shared/cors.ts";

// =============================================================================
// Mediflow — razorpay-webhook Edge Function
// Intercepts `payment.captured` webhooks from Razorpay, clears the invoice,
// assigns the OPD Token number, and logs commission pool splits in Postgres.
// Webhook Secret: Vitalsync_webhook_2026 (set in Supabase Vault as RAZORPAY_WEBHOOK_SECRET)
// =============================================================================

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
    // ── STEP 1: HMAC-SHA256 Signature Verification ────────────────────────────
    // Razorpay signs every webhook with RAZORPAY_WEBHOOK_SECRET.
    // We MUST verify this before touching the database — otherwise any attacker
    // could POST a fake payment.captured event and get free appointments.
    const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("[Razorpay Webhook] ❌ RAZORPAY_WEBHOOK_SECRET not set in Supabase Vault.");
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const razorpaySignature = req.headers.get("x-razorpay-signature") ?? "";
    const rawBody = await req.text(); // read as text to preserve exact bytes for HMAC

    // Compute HMAC-SHA256(rawBody, webhookSecret)
    const encoder = new TextEncoder();
    const keyData = encoder.encode(webhookSecret);
    const msgData = encoder.encode(rawBody);
    const cryptoKey = await crypto.subtle.importKey(
      "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    if (computedSignature !== razorpaySignature) {
      console.error("[Razorpay Webhook] ❌ Signature mismatch — rejecting request.");
      return new Response(JSON.stringify({ error: "Invalid webhook signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("[Razorpay Webhook] ✅ Signature verified — Vitalsync_webhook_2026");
    // ─────────────────────────────────────────────────────────────────────────

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const payload = JSON.parse(rawBody);
    console.log("[Razorpay Webhook] Received payload event:", payload.event);

    const event = payload.event;
    if (event === "payment.captured" || event === "order.paid") {
      const payment = payload.payload?.payment?.entity || {};
      const notes = payment.notes || {};
      const invoiceId = notes.invoice_id;

      if (invoiceId) {
        console.log(`[Razorpay Webhook] 🟢 Clearing invoice ${invoiceId} for captured payment ${payment.id}`);

        // Fetch invoice details
        const { data: invoice } = await supabase
          .from("unified_invoices")
          .select("*")
          .eq("id", invoiceId)
          .single();

        const amountPaid = (payment.amount || 51500) / 100;
        const gatewayFee = (payment.fee || Math.round(amountPaid * 0.02 * 100)) / 100;

        // 1. Mark invoice cleared
        await supabase
          .from("unified_invoices")
          .update({
            payment_status: "cleared",
            payment_method: "razorpay"
          })
          .eq("id", invoiceId);

        // 2. Insert into vitalsync_pool_settlements (with idempotency guard)
        if (invoice) {
          const { data: existingSettlement } = await supabase
            .from("vitalsync_pool_settlements")
            .select("id")
            .eq("invoice_id", invoiceId)
            .maybeSingle();

          if (!existingSettlement) {
            const doctorFee = Number(invoice.doctor_fee) || 500;
            const platformFee = Number(invoice.platform_fee) || 15;
            const netProfit = Math.max(0, platformFee - gatewayFee);

            await supabase.from("vitalsync_pool_settlements").insert({
              invoice_id: invoiceId,
              patient_id: invoice.patient_id || invoice.patientId,
              total_amount: amountPaid,
              doctor_share: doctorFee,
              platform_share: platformFee,
              gateway_fee: gatewayFee,
              net_platform_profit: netProfit,
              payment_method: "razorpay",
              settlement_status: "completed",
              created_at: new Date().toISOString()
            });
          } else {
            console.log(`[Razorpay Webhook] Settlement already exists for invoice ${invoiceId}, skipping duplicate insert.`);
          }

          // 3. Confirm appointment in database & assign token
          if (invoice.appointment_id) {
            await supabase.from("appointments").update({
              status: "confirmed",
              payment_status: "cleared"
            }).eq("id", invoice.appointment_id);
          }

          // 4. Update WhatsApp session state & send confirmation message via Edge Notifier
          const patientId = invoice.patient_id || invoice.patientId;
          const { data: patient } = await supabase
            .from("patient_registry")
            .select("phone, name")
            .eq("id", patientId)
            .single();

          if (patient?.phone) {
            const tokenCode = (invoice.appointment_id || invoiceId).substring(0, 4).toUpperCase();
            const confirmMsg = `🎉 *RAZORPAY PAYMENT VERIFIED & APPOINTMENT CONFIRMED!* 🟢\n\nHi ${patient.name || 'Patient'}!\n • Payment Status: Cleared (Razorpay)\n • Token Number: #${tokenCode}\n • Amount Paid: ₹${amountPaid.toFixed(2)}\n\nPhysical visit token is active at Patna Clinic counter. Thank you for choosing VitalSync! 🩺`;

            await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-dispatch`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
              },
              body: JSON.stringify({
                phone: patient.phone,
                message: confirmMsg
              })
            }).catch(err => console.warn("[Razorpay Webhook] WhatsApp dispatch notification error:", err));
          }
        }
      }
    }

    return new Response(JSON.stringify({ status: "success" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[Razorpay Webhook] Exception:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
