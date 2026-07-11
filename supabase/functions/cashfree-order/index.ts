import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { z } from "https://deno.land/x/zod@v3.22.4/index.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { isRateLimited } from "../_shared/rate-limit.ts";

// =============================================================================
// Mediflow — cashfree-order Edge Function
// Securely creates a Cashfree payment session using server-side credentials.
// Never exposes CASHFREE_APP_ID or CASHFREE_SECRET_KEY to the frontend.
//
// Supabase Vault Secrets Required:
//   CASHFREE_APP_ID       — Cashfree Merchant App ID
//   CASHFREE_SECRET_KEY   — Cashfree Merchant Secret Key
//   CASHFREE_ENV          — "sandbox" or "production"
// =============================================================================

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
      invoiceId: z.string().uuid("Invalid invoiceId UUID format"),
      returnUrl: z.string().url("Invalid returnUrl format").optional(),
    }).safeParse(bodyJson);

    if (!validationResult.success) {
      const errorMsg = validationResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(", ");
      return new Response(JSON.stringify({ error: `Validation failed: ${errorMsg}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { invoiceId, returnUrl } = validationResult.data;

    // Retrieve invoice + patient details
    const { data: invoice, error: invError } = await supabase
      .from("unified_invoices")
      .select("*, patient_registry(id, name, email, phone)")
      .eq("id", invoiceId)
      .single();

    if (invError || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (invoice.payment_status === "cleared") {
      return new Response(JSON.stringify({ error: "Invoice already paid" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const patient = invoice.patient_registry;
    const amount = Number(invoice.total_amount);

    // 1. Read pre-calculated payment splits from database split_payload
    const orderSplits = invoice.split_payload || [];

    const appId     = Deno.env.get("CASHFREE_APP_ID") ?? "";
    const secretKey = Deno.env.get("CASHFREE_SECRET_KEY") ?? "";
    const cfEnv     = Deno.env.get("CASHFREE_ENV") ?? ""; // Must be set to "production" in Vault before go-live

    if (!appId || !secretKey) {
      console.error("[cashfree-order] Credentials missing in vault.");
      return new Response(JSON.stringify({ error: "Payment gateway not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── CASHFREE_ENV guard ─────────────────────────────────────────────────────
    // IMPORTANT: Set CASHFREE_ENV = "production" in Supabase Vault Secrets
    // before going live. If this is missing, real payments route to the Cashfree
    // SANDBOX silently, meaning no real money is captured.
    //
    // To set in Supabase CLI:
    //   supabase secrets set CASHFREE_ENV=production --project-ref <ref>
    // ──────────────────────────────────────────────────────────────────────────
    if (!cfEnv) {
      console.error(
        "[cashfree-order] MISCONFIGURATION: CASHFREE_ENV vault secret is not set. " +
        "Defaulting to SANDBOX. Set CASHFREE_ENV=production in Supabase Vault before go-live."
      );
    }

    const resolvedEnv = cfEnv || "sandbox";
    const apiBase = resolvedEnv === "production"
      ? "https://api.cashfree.com/pg/orders"
      : "https://sandbox.cashfree.com/pg/orders";

    console.log(`[cashfree-order] Using Cashfree environment: ${resolvedEnv.toUpperCase()}`);


    const orderId = `VITAL-${invoiceId.substring(0, 8).toUpperCase()}-${Date.now().toString().slice(-5)}`;

    const body: Record<string, any> = {
      order_amount:   amount,
      order_currency: "INR",
      order_id:       orderId,
      customer_details: {
        customer_id:    patient?.id   ?? `GEN-${Date.now()}`,
        customer_name:  patient?.name ?? "VitalSync Patient",
        customer_email: patient?.email ?? "patient@vitalsync.in",
        customer_phone: patient?.phone ?? "9999999999",
      },
      order_meta: {
        return_url:      returnUrl ?? "https://app.vitalsync.in/payment/callback?order_id={order_id}",
        payment_methods: "cc,dc,upi,nb,app",
      },
      order_tags: {
        invoice_id: invoiceId,
        pod_id:     invoice.pod_id ?? "",
      },
    };

    if (orderSplits.length > 0) {
      body.order_splits = orderSplits;
    }

    const cfRes = await fetch(apiBase, {
      method: "POST",
      headers: {
        "x-client-id":     appId,
        "x-client-secret": secretKey,
        "x-api-version":   "2025-01-01",
        "Content-Type":    "application/json",
      },
      body: JSON.stringify(body),
    });

    const cfData = await cfRes.json();

    if (!cfRes.ok) {
      console.error("[cashfree-order] Cashfree API error:", cfData);
      return new Response(JSON.stringify({ error: cfData.message ?? "Order creation failed" }), {
        status: cfRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Persist the Cashfree order_id and splits metadata against the invoice
    await supabase
      .from("unified_invoices")
      .update({ 
        cashfree_order_id: orderId,
        split_payload: orderSplits,
        split_settlement_status: orderSplits.length > 0 ? "split_queued" : "unprocessed"
      })
      .eq("id", invoiceId);

    console.log(`[cashfree-order] Order created ✅ order_id=${orderId}`);

    return new Response(JSON.stringify({
      order_id:           cfData.order_id,
      payment_session_id: cfData.payment_session_id,
      cf_order_id:        cfData.cf_order_id,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("[cashfree-order] Exception:", e);
    return new Response(JSON.stringify({ error: e.message ?? "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
