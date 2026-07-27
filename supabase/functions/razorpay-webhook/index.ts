import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { getCorsHeaders } from "../_shared/cors.ts";

// =============================================================================
// Mediflow — razorpay-webhook Edge Function
// Intercepts `payment.captured` webhooks from Razorpay, clears the invoice,
// assigns the OPD Token number, and logs commission pool splits in Postgres.
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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const payload = await req.json().catch(() => ({}));
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

        // 2. Insert into vitalsync_pool_settlements
        if (invoice) {
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
