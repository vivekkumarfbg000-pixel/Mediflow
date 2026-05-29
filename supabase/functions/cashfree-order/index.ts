import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { invoiceId, returnUrl } = await req.json();

    if (!invoiceId) {
      return new Response(JSON.stringify({ error: "Missing invoiceId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    if (invoice.payment_status === "paid") {
      return new Response(JSON.stringify({ error: "Invoice already paid" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const patient = invoice.patient_registry;
    const amount = Number(invoice.total_amount);

    const appId     = Deno.env.get("CASHFREE_APP_ID") ?? "";
    const secretKey = Deno.env.get("CASHFREE_SECRET_KEY") ?? "";
    const cfEnv     = Deno.env.get("CASHFREE_ENV") ?? "sandbox";

    if (!appId || !secretKey) {
      console.error("[cashfree-order] Credentials missing in vault.");
      return new Response(JSON.stringify({ error: "Payment gateway not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiBase = cfEnv === "production"
      ? "https://api.cashfree.com/pg/orders"
      : "https://sandbox.cashfree.com/pg/orders";

    const orderId = `MEDIF-${invoiceId.substring(0, 8).toUpperCase()}-${Date.now().toString().slice(-5)}`;

    const body = {
      order_amount:   amount,
      order_currency: "INR",
      order_id:       orderId,
      customer_details: {
        customer_id:    patient?.id   ?? `GEN-${Date.now()}`,
        customer_name:  patient?.name ?? "Mediflow Patient",
        customer_email: patient?.email ?? "patient@mediflow.in",
        customer_phone: patient?.phone ?? "9999999999",
      },
      order_meta: {
        return_url:      returnUrl ?? "https://mediflow.vercel.app/payment/callback?order_id={order_id}",
        payment_methods: "cc,dc,upi,nb,app",
      },
      order_tags: {
        invoice_id: invoiceId,
        pod_id:     invoice.pod_id ?? "",
      },
    };

    const cfRes = await fetch(apiBase, {
      method: "POST",
      headers: {
        "x-client-id":     appId,
        "x-client-secret": secretKey,
        "x-api-version":   "2023-08-01",
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

    // Persist the Cashfree order_id against the invoice for webhook reconciliation
    await supabase
      .from("unified_invoices")
      .update({ cashfree_order_id: orderId })
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
