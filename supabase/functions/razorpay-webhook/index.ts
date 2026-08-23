import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getIstDateString, getIstDateDisplay } from "../_shared/istDate.ts";

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
    if (event === "payment.captured" || event === "order.paid" || event === "payment_link.paid") {
      const payment = payload.payload?.payment?.entity || {};
      const order = payload.payload?.order?.entity || {};
      const paymentLink = payload.payload?.payment_link?.entity || {};
      const notes = {
        ...(paymentLink.notes || {}),
        ...(order.notes || {}),
        ...(payment.notes || {})
      };
      const invoiceId = notes.invoice_id || notes.invoiceId || paymentLink.reference_id || "";
      const apptId = notes.appointment_id || notes.appointmentId || "";
      const rawContact = payment.contact || paymentLink.customer?.contact || notes.phone || "";
      const clean10 = String(rawContact).replace(/\D/g, "").slice(-10);

      console.log(`[Razorpay Webhook] 🟢 Processing event ${event} for payment ${payment.id || order.id || paymentLink.id}, invoice: ${invoiceId}`);

      // IDEMPOTENCY: Check if this payment event was already processed
      const idempotencyKey = `razorpay_${event}_${payment.id || paymentLink.id || order.id}`;
      const { data: existingKey } = await supabase
        .from("webhook_idempotency_keys")
        .select("id")
        .eq("key", idempotencyKey)
        .maybeSingle();

      if (existingKey) {
        console.log(`[Razorpay Webhook] ⏭️ Duplicate skipped: ${idempotencyKey}`);
        return new Response(JSON.stringify({ success: true, skipped: true }), { status: 200 });
      }

      // Fetch invoice details with prefix fallback
      let invoice = null;
      if (invoiceId) {
        const { data: exactInv } = await supabase
          .from("unified_invoices")
          .select("*")
          .eq("id", invoiceId)
          .maybeSingle();

        if (exactInv) {
          invoice = exactInv;
        } else {
          const cleanSnippet = String(invoiceId).replace("inv-wa-", "").substring(0, 8);
          const { data: prefixInvs } = await supabase
            .rpc("find_invoice_by_prefix", { p_prefix: cleanSnippet });
          if (prefixInvs && prefixInvs.length > 0) {
            invoice = prefixInvs[0];
          }
        }
      }

      const resolvedInvoiceId = invoice?.id || invoiceId;
      const amountPaid = (payment.amount || paymentLink.amount_paid || 51500) / 100;
      const gatewayFee = (payment.fee || Math.round(amountPaid * 0.02 * 100)) / 100;
      const targetPatId = invoice?.patient_id || invoice?.patientId;

      try {
        // Execute Atomic Payment Settlement RPC
        if (resolvedInvoiceId) {
          const { error: rpcError } = await supabase.rpc('process_invoice_settlement', {
            p_invoice_id: resolvedInvoiceId,
            p_payment_method: 'razorpay',
            p_amount_paid: amountPaid,
            p_gateway_reference_id: payment.id || paymentLink.id
          });

          if (rpcError) {
            console.warn(`[Razorpay Webhook] RPC Settlement Warning: ${rpcError.message}`);
          }

          await supabase
            .from("unified_invoices")
            .update({ payment_status: "cleared", payment_method: "razorpay" })
            .eq("id", resolvedInvoiceId);
        }

        // Update appointments table explicitly
        if (apptId) {
          await supabase
            .from("appointments")
            .update({ status: "scheduled", payment_status: "cleared" })
            .eq("id", apptId);
        } else if (clean10) {
          const { data: pRec } = await supabase
            .from("patient_registry")
            .select("id")
            .ilike("phone", `%${clean10}%`)
            .maybeSingle();

          if (pRec?.id) {
            await supabase
              .from("appointments")
              .update({ status: "scheduled", payment_status: "cleared" })
              .eq("patient_id", pRec.id)
              .eq("status", "pending_payment");
          }
        }

        // 4. Update WhatsApp session & dispatch confirmation receipt directly to WhatsApp
        if (clean10) {
          const { data: sess } = await supabase
            .from("whatsapp_sessions")
            .select("id, patient_id, pod_id, patient_phone, session_data")
            .ilike("patient_phone", `%${clean10}%`)
            .limit(1)
            .maybeSingle();

          let tokenNumber = 1;
          let approxTime = "10:00 AM";
          let selectedDisplay = getIstDateString();
          let doctorName = "Doctor";
          let clinicName = "Connected Clinic";

            if (sess) {
            const sessData = sess.session_data || {};
            tokenNumber = sessData.tokenNumber || tokenNumber;
            approxTime = sessData.approxTime || approxTime;
            selectedDisplay = sessData.selectedDateDisplay || sessData.selectedDate || selectedDisplay;
            doctorName = sessData.doctorName || doctorName;
            clinicName = sessData.clinicName || clinicName;

            if (resolvedApptId) {
              try {
                const { data: dbAppt } = await supabase.from("appointments").select("virtual_date, appointment_time, token_number").eq("id", resolvedApptId).maybeSingle();
                if (dbAppt?.virtual_date) {
                  selectedDisplay = dbAppt.virtual_date;
                }
                if (dbAppt?.token_number) {
                  tokenNumber = dbAppt.token_number;
                }
              } catch (_e) {}
            }

            const updates = { ...sessData, isVerifiedPaid: true, pendingInvoiceId: resolvedInvoiceId };
            await supabase.rpc('atomic_update_whatsapp_session', {
              p_patient_phone: sess.patient_phone,
              p_patient_id: sess.patient_id || null,
              p_pod_id: sess.pod_id || null,
              p_entity_id: sess.pod_id || null,
              p_current_state: "COMPLETED",
              p_message: {
                sender: "bot",
                text: `🎉 *PAYMENT VERIFIED & APPOINTMENT SCHEDULED!* 🟢\n\n*Appointment Details*:\n• Doctor: ${doctorName}\n• Clinic: ${clinicName}\n• Token Number: ${tokenNumber}\n• Date: ${selectedDisplay}\n• Approximate Time: ${approxTime}\n• Fee Paid: ₹${amountPaid.toFixed(2)}\n• Status: Confirmed ✅\n\nTime par clinic pahuchein aur counter par token number (${tokenNumber}) show karein. Thank you! 😊`,
                timestamp: new Date().toISOString(),
                time: new Date().toISOString()
              },
              p_session_data_updates: updates
            });
          }

          // Direct Outbound Meta Graph API Dispatch (<200ms)
          const metaToken = Deno.env.get("META_WHATSAPP_TOKEN") || Deno.env.get("META_ACCESS_TOKEN") || Deno.env.get("OWNER_SYSTEM_TOKEN") || "";
          const phoneId = (sess?.session_data?.phoneId) || Deno.env.get("META_PHONE_NUMBER_ID") || "566416629883556";
          
          // Fallback to clean10 if sess.patient_phone is missing/hijacked
          const outboundPhone = sess?.patient_phone || clean10;
          
          if (metaToken && outboundPhone) {
            try {
              const confirmText = `🎉 *PAYMENT VERIFIED & APPOINTMENT SCHEDULED!* 🟢\n\n*Appointment Details*:\n• Doctor: ${doctorName}\n• Clinic: ${clinicName}\n• Token Number: ${tokenNumber}\n• Date: ${selectedDisplay}\n• Approximate Time: ${approxTime}\n• Fee Paid: ₹${amountPaid.toFixed(2)}\n• Status: Confirmed ✅\n\nTime par clinic pahuchein aur counter par token number (${tokenNumber}) show karein. Thank you for choosing VitalSync! 😊`;
              await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${metaToken}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  messaging_product: "whatsapp",
                  recipient_type: "individual",
                  to: outboundPhone,
                  type: "text",
                  text: { body: confirmText }
                })
              });
              console.log("[Razorpay Webhook] Dispatched confirmed WhatsApp receipt ✅");
            } catch (outboundErr) {
              console.warn("[Razorpay Webhook] Outbound WhatsApp receipt warning:", outboundErr);
            }
          }
        }

        // Record idempotency key INSIDE the event block to prevent:
        // 1. Writing `key: undefined` for non-payment events (scoping bug)
        // 2. Wrapped in try-catch so a DB failure doesn't crash the 200 response
        try {
          await supabase.from("webhook_idempotency_keys").insert({ key: idempotencyKey });
        } catch (idemErr) {
          console.warn(`[Razorpay Webhook] ⚠️ Idempotency key insert failed (non-fatal): ${idemErr}`);
        }
      } catch (procErr: any) {
        console.error("[Razorpay Webhook] Processing error:", procErr);
      }
    }

    return new Response(JSON.stringify({ status: "ok" }), {
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
