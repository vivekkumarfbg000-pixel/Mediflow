import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { z } from "https://deno.land/x/zod@v3.22.4/index.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { isRateLimited } from "../_shared/rate-limit.ts";

// =============================================================================
// Mediflow — razorpay-order Edge Function
// Creates a Razorpay order securely using server-side key credentials.
//
// Supabase Vault Secrets Required:
//   RAZORPAY_KEY_ID      — Razorpay Key ID (rzp_test_... or rzp_live_...)
//   RAZORPAY_KEY_SECRET  — Razorpay Key Secret
// =============================================================================

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS" || req.method === "HEAD" || req.method === "GET") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
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

    let rawParsed: any = {};
    try {
      const text = await req.text();
      if (text) {
        rawParsed = JSON.parse(text);
        if (typeof rawParsed === 'string') {
          rawParsed = JSON.parse(rawParsed);
        }
      }
    } catch (_e) {
      rawParsed = {};
    }

    const bodyObj = (rawParsed && rawParsed.body && typeof rawParsed.body === 'object') ? rawParsed.body : rawParsed;
    const invoiceId = String(bodyObj?.invoiceId || bodyObj?.invoice_id || bodyObj?.id || `inv-wa-${Date.now()}`);
    const requestedAmount = Number(bodyObj?.amount || bodyObj?.totalAmount || bodyObj?.total_amount || 515);

    // Retrieve invoice details from Supabase Postgres with resilient prefix lookup
    let invoice: any = null;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(invoiceId);

    if (isUuid) {
      const { data: exactInv } = await supabase
        .from("unified_invoices")
        .select("*, patient_registry(id, name, email, phone)")
        .eq("id", invoiceId)
        .maybeSingle();
      invoice = exactInv;
    }

    if (!invoice) {
      const cleanSnippet = String(invoiceId).replace("inv-wa-", "").substring(0, 8);
      const { data: prefixInvs } = await supabase
        .rpc("find_invoice_by_prefix", { p_prefix: cleanSnippet });
      if (prefixInvs && prefixInvs.length > 0) {
        invoice = prefixInvs[0];
      }
    }

    if (invoice && !invoice.patient_registry && invoice.patient_id) {
      const { data: patient } = await supabase
        .from("patient_registry")
        .select("id, name, email, phone")
        .eq("id", invoice.patient_id)
        .maybeSingle();
      if (patient) {
        invoice.patient_registry = patient;
      }
    }

    const amountInRupees = requestedAmount || (invoice ? Number(invoice.total_amount) || Number(invoice.totalAmount) : 500);
    const amountInPaise = Math.round(amountInRupees * 100); // Razorpay requires amount in paise

    if (amountInPaise < 100) {
      return new Response(JSON.stringify({ error: "Minimum order amount must be at least 100 paise (₹1.00)." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID") || 
      Deno.env.get("razorpay_key_id") || 
      Deno.env.get("RAZORPAY_KEY") || 
      Deno.env.get("RZP_KEY_ID") || 
      Deno.env.get("VITE_RAZORPAY_KEY_ID");

    let razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET") || 
      Deno.env.get("razorpay_key_secret") || 
      Deno.env.get("RAZORPAY_SECRET") || 
      Deno.env.get("RZP_KEY_SECRET") || 
      Deno.env.get("VITE_RAZORPAY_KEY_SECRET");

    // Fallback: If not in Deno.env, attempt lookup in database table
    if (!razorpayKeyId || !razorpayKeySecret) {
      try {
        const { data: sopRecord } = await supabase
          .from('clinic_sops')
          .select('extracted_config')
          .limit(1)
          .maybeSingle();

        if (sopRecord?.extracted_config) {
          const cfg = sopRecord.extracted_config;
          if (!razorpayKeyId && (cfg.razorpay_key_id || cfg.razorpayKeyId)) {
            razorpayKeyId = cfg.razorpay_key_id || cfg.razorpayKeyId;
          }
          if (!razorpayKeySecret && (cfg.razorpay_key_secret || cfg.razorpayKeySecret)) {
            razorpayKeySecret = cfg.razorpay_key_secret || cfg.razorpayKeySecret;
          }
        }
      } catch (_dbErr) {
        console.warn("[Razorpay Order] DB config fallback lookup note:", _dbErr);
      }
    }

    if (!razorpayKeyId || !razorpayKeySecret) {
      return new Response(JSON.stringify({ 
        success: false,
        error: "Server misconfiguration: RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET are missing in Supabase Edge Functions Secrets." 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Razorpay API to create an order
    const authHeader = "Basic " + btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    const rzpResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: "INR",
        receipt: `inv_${invoiceId.substring(0, 20)}`,
        notes: {
          invoice_id: invoiceId,
          patient_name: invoice?.patient_registry?.name || "VitalSync Patient"
        }
      })
    });

    if (!rzpResponse.ok) {
      const rzpErr = await rzpResponse.json().catch(() => ({}));
      console.warn("[Razorpay Order] Razorpay API error:", rzpErr);
      return new Response(JSON.stringify({
        success: false,
        error: rzpErr.error?.description || "Razorpay API order creation failed."
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rzpData = await rzpResponse.json();

    return new Response(JSON.stringify({
      success: true,
      orderId: rzpData.id,
      amount: rzpData.amount,
      currency: rzpData.currency,
      keyId: razorpayKeyId
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[Razorpay Order] Exception:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
