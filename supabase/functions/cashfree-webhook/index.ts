import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { tryAcquirePaymentLock, releasePaymentLock, getInvoiceLockKey } from "../_shared/payment-lock.ts";

// =============================================================================
// Mediflow — cashfree-webhook Edge Function
// Receives asynchronous payment status events from Cashfree PG.
// Validates cryptographic signatures to guarantee payload integrity.
// Updates unified_invoices and dispatches transactional WhatsApp alerts.
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

    const secretKey = Deno.env.get("CASHFREE_SECRET_KEY") ?? "";
    if (!secretKey) {
      console.error("[cashfree-webhook] Server configuration error: CASHFREE_SECRET_KEY is not defined");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const signature = req.headers.get("x-webhook-signature");
    const timestamp = req.headers.get("x-webhook-timestamp") ?? "";

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
    const signedPayload = timestamp + rawBody;
    const messageData = encoder.encode(signedPayload);

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
    
    // Normalize order details FIRST
    const orderId = event.data?.order?.order_id || event.order_id || event.data?.order_id;
    const paymentStatus = event.data?.payment?.payment_status || event.payment_status || event.data?.payment_status;
    const totalAmount = event.data?.order?.order_amount || event.order_amount;
    
    console.log(`[cashfree-webhook] Processing event: ${eventType} for Order: ${orderId}, Status: ${paymentStatus}`);

    // IDEMPOTENCY: Check if this event has already been processed successfully
    const idempotencyKey = `cashfree_${eventType}_${orderId}`;
    const { data: existingKey } = await supabase
      .from("webhook_idempotency_keys")
      .select("id")
      .eq("key", idempotencyKey)
      .maybeSingle();

    if (existingKey) {
      console.log(`[cashfree-webhook] ⏭️ Duplicate skipped: ${idempotencyKey}`);
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (paymentStatus === "SUCCESS" || eventType === "PAYMENT_SUCCESS_WEBHOOK") {
      // 0. Fetch the current invoice status first
      const { data: existingInvoice, error: fetchErr } = await supabase
        .from("unified_invoices")
        .select("id, payment_status, pod_id, patient_id, total_amount, appointment_id")
        .eq("cashfree_order_id", orderId)
        .maybeSingle();

      if (fetchErr) {
        console.error(`[cashfree-webhook] Failed to query existing invoice for order_id: ${orderId}`, fetchErr);
        return new Response(JSON.stringify({ error: "Invoice lookup failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!existingInvoice) {
        console.error(`[cashfree-webhook] Invoice not found for order_id: ${orderId}`);
        return new Response(JSON.stringify({ error: "Invoice not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (existingInvoice.payment_status === "cleared") {
        console.log(`[cashfree-webhook] Idempotency intercepted: Invoice ${existingInvoice.id} is already CLEARED. Ignoring duplicate webhook event.`);
        return new Response(JSON.stringify({ success: true, message: "Duplicate event ignored. Invoice already cleared." }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // SECURITY check: Ensure the paid amount matches the invoice amount exactly (±0.01 tolerance for rounding)
      const paidAmount = Number(totalAmount);
      const expectedAmount = Number(existingInvoice.total_amount);
      if (Math.abs(paidAmount - expectedAmount) > 0.01) {
        console.error(`[cashfree-webhook] ❌ AMOUNT MISMATCH DETECTED: Paid ₹${paidAmount}, Expected ₹${expectedAmount}. Rejecting status update.`);
        return new Response(JSON.stringify({ error: `Amount mismatch: paid ${paidAmount}, expected ${expectedAmount}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // IDEMPOTENCY: Acquire advisory lock to prevent duplicate processing of same invoice
      const lockResult = await tryAcquirePaymentLock(supabase, getInvoiceLockKey(existingInvoice.id));
      if (!lockResult.acquired) {
        console.log(`[cashfree-webhook] ⏭️ Skipping duplicate processing for invoice ${existingInvoice.id} — lock held by another transaction`);
        return new Response(JSON.stringify({ status: "ok", skipped: true, reason: "lock_held" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.log(`[cashfree-webhook] 🔒 Lock acquired for invoice ${existingInvoice.id}`);
      try {
        // 1. Reconcile and update unified_invoices
        const { data: invoice, error: updateErr } = await supabase
          .from("unified_invoices")
          .update({ 
            payment_status: "cleared",  // DB constraint: only 'pending' | 'cleared' allowed
            payment_method: "cashfree",
            split_settlement_status: "settled"
          })
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

        // 3. Credit commission pool with platform fee earned on this payment
        // This replenishes the pool that cash billing draws from.
        try {
          const platformFee = existingInvoice.platform_fee ?? (totalAmount ? parseFloat((totalAmount * 0.03).toFixed(2)) : 0);
          if (platformFee > 0 && existingInvoice.pod_id) {
            await supabase.rpc("credit_commission_pool", {
              p_pod_id:       existingInvoice.pod_id,
              p_amount:       platformFee,
              p_reason:       `Online payment settled — order_id: ${orderId}`,
              p_reference_id: existingInvoice.id,
            });
            console.log(`[cashfree-webhook] Commission pool credited ₹${platformFee} for pod ${existingInvoice.pod_id} ✅`);
          }
        } catch (poolErr) {
          // Non-fatal — payment is already marked cleared
          console.warn("[cashfree-webhook] Pool credit failed (non-fatal):", poolErr);
        }

        // 4. Update appointment status to 'ready_for_consult' and patient queueStatus to 'awaiting_consultation'
        // This ensures the patient appears in the Doctor's consultation queue
        try {
          if (existingInvoice.appointment_id) {
            // Strict 1:1 binding to avoid queue corruption
            const { error: apptUpdateErr } = await supabase
              .from("appointments")
              .update({ 
                status: "ready_for_consult",
                payment_status: "cleared"
              })
              .eq("id", existingInvoice.appointment_id)
              .eq("status", "pending_payment");
            
            if (!apptUpdateErr) {
              console.log(`[cashfree-webhook] Appointment ${existingInvoice.appointment_id} updated to ready_for_consult ✅`);
            }
          }

          if (existingInvoice.patient_id) {

            // Update patient queue status in patient_registry
            const { error: patientUpdateErr } = await supabase
              .from("patient_registry")
              .update({ 
                queue_status: "awaiting_consultation",
                updated_at: new Date().toISOString()
              })
              .eq("id", existingInvoice.patient_id);

            if (!patientUpdateErr) {
              console.log(`[cashfree-webhook] Patient ${existingInvoice.patient_id} queue_status updated to awaiting_consultation ✅`);
            } else {
              console.warn("[cashfree-webhook] Failed to update patient queue_status:", patientUpdateErr);
            }
          }
        } catch (syncErr) {
          console.warn("[cashfree-webhook] Appointment/patient sync failed (non-fatal):", syncErr);
        }

        // 5. Dispatch secure transaction confirmation message to WhatsApp
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
              templateName: "payment_confirmation",
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
      } finally {
        await releasePaymentLock(supabase, getInvoiceLockKey(existingInvoice.id));
      }
    } else {
      console.log(`[cashfree-webhook] Payment not successful, ignoring status update. Status: ${paymentStatus}`);
    }

    // Record event idempotency key to prevent duplicate processing
    try {
      await supabase.from("webhook_idempotency_keys").insert({ key: idempotencyKey });
    } catch (idemErr) {
      console.warn(`[cashfree-webhook] ⚠️ Idempotency key insert failed (non-fatal): ${idemErr}`);
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
