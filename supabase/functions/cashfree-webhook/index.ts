import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// =============================================================================
// Mediflow — cashfree-webhook Edge Function
// Receives asynchronous payment status events from Cashfree PG.
// Validates cryptographic signatures to guarantee payload integrity.
// Updates unified_invoices and dispatches transactional WhatsApp alerts.
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

    const secretKey = Deno.env.get("CASHFREE_SECRET_KEY") ?? "";
    const signature = req.headers.get("x-webhook-signature");

    if (!signature) {
      console.warn("[cashfree-webhook] Missing x-webhook-signature header");
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawBody = await req.text();

    // Verify Cashfree webhook signature using HMAC-SHA256
    // Works with both Base64 and Hex encoding for absolute resilience
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);
    const messageData = encoder.encode(rawBody);

    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign("HMAC", key, messageData);

    const computedBase64Signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
    const computedHexSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (signature !== computedBase64Signature && signature !== computedHexSignature) {
      console.error("[cashfree-webhook] Webhook signature verification failed!");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[cashfree-webhook] Signature verified successfully ✅");

    const event = JSON.parse(rawBody);
    const eventType = event.type;
    
    // Normalize order details
    const orderId = event.data?.order?.order_id || event.order_id || event.data?.order_id;
    const paymentStatus = event.data?.payment?.payment_status || event.payment_status || event.data?.payment_status;
    const totalAmount = event.data?.order?.order_amount || event.order_amount;

    console.log(`[cashfree-webhook] Processing event: ${eventType} for Order: ${orderId}, Status: ${paymentStatus}`);

    if (paymentStatus === "SUCCESS" || eventType === "PAYMENT_SUCCESS_WEBHOOK") {
      // 1. Reconcile and update unified_invoices
      const { data: invoice, error: updateErr } = await supabase
        .from("unified_invoices")
        .update({ payment_status: "paid" })
        .eq("cashfree_order_id", orderId)
        .select("*, patient_registry(id, name, phone)")
        .single();

      if (updateErr || !invoice) {
        console.error(`[cashfree-webhook] Failed to update invoice for order_id: ${orderId}`, updateErr);
        return new Response(JSON.stringify({ error: "Invoice reconciliation failed" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`[cashfree-webhook] Invoice ${invoice.id} marked as PAID ✅`);

      // 2. Insert into immutable audit log
      await supabase.from("activity_logs").insert({
        pod_id: invoice.pod_id,
        action_type: "CASHFREE_PAYMENT_SUCCESS",
        details: {
          order_id: orderId,
          invoice_id: invoice.id,
          amount: totalAmount,
          patient_id: invoice.patient_id,
          reconciled_at: new Date().toISOString()
        }
      });

      // 3. Dispatch secure transaction confirmation message to WhatsApp
      try {
        const dispatchUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-dispatch`;
        const dispatchRes = await fetch(dispatchUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            patientId: invoice.patient_id,
            templateName: "appointment_confirmation",
            templateParams: {
              patient_name: invoice.patient_registry?.name || "Valued Patient",
              amount: totalAmount?.toString() || invoice.total_amount?.toString() || "0",
              invoice_id: invoice.id.substring(0, 8).toUpperCase()
            },
            podId: invoice.pod_id
          })
        });

        if (!dispatchRes.ok) {
          const errText = await dispatchRes.text();
          console.warn(`[cashfree-webhook] WhatsApp dispatch failed: ${errText}`);
        } else {
          console.log("[cashfree-webhook] WhatsApp payment notification triggered successfully.");
        }
      } catch (wsErr) {
        console.error("[cashfree-webhook] Error calling whatsapp-dispatch:", wsErr);
      }
    } else {
      console.log(`[cashfree-webhook] Payment not successful, ignoring status update. Status: ${paymentStatus}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("[cashfree-webhook] Critical error processing webhook:", e);
    return new Response(JSON.stringify({ error: e.message ?? "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
