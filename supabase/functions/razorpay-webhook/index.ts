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
    if (event === "payment.captured" || event === "order.paid" || event === "payment_link.paid") {
      const payment = payload.payload?.payment?.entity || {};
      const order = payload.payload?.order?.entity || {};
      const paymentLink = payload.payload?.payment_link?.entity || {};
      const notes = payment.notes || order.notes || paymentLink.notes || {};
      const invoiceId = notes.invoice_id || notes.invoiceId || "";
      const rawContact = payment.contact || paymentLink.customer?.contact || notes.phone || "";
      const clean10 = rawContact.replace(/\D/g, "").slice(-10);

      console.log(`[Razorpay Webhook] 🟢 Processing event ${event} for payment ${payment.id || order.id}, invoice: ${invoiceId}`);

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
          const cleanSnippet = invoiceId.replace("inv-wa-", "").substring(0, 8);
          const { data: prefixInv } = await supabase
            .from("unified_invoices")
            .select("*")
            .ilike("id", `${cleanSnippet}%`)
            .limit(1)
            .maybeSingle();
          if (prefixInv) invoice = prefixInv;
        }
      }

      const resolvedInvoiceId = invoice?.id || invoiceId;
      const amountPaid = (payment.amount || 51500) / 100;
      const gatewayFee = (payment.fee || Math.round(amountPaid * 0.02 * 100)) / 100;
      const targetPatId = invoice?.patient_id || invoice?.patientId;

      // 1. Mark invoice cleared in database
      if (resolvedInvoiceId) {
        await supabase
          .from("unified_invoices")
          .update({
            payment_status: "cleared",
            payment_method: "razorpay"
          })
          .eq("id", resolvedInvoiceId);
      }

      // 2. Insert into vitalsync_pool_settlements (with idempotency guard)
      if (resolvedInvoiceId) {
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
            patient_id: targetPatId || null,
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

      // 3. Confirm appointment in database & assign token
      if (invoice?.appointment_id) {
        await supabase.from("appointments").update({
          status: "scheduled",
          payment_status: "cleared"
        }).eq("id", invoice.appointment_id);
      } else if (targetPatId) {
        await supabase.from("appointments").update({
          status: "scheduled",
          payment_status: "cleared"
        }).eq("patient_id", targetPatId);
      } else if (clean10) {
        await supabase.from("appointments").update({
          status: "scheduled",
          payment_status: "cleared"
        }).eq("patient_phone", clean10);
      }

      // 4. Update WhatsApp session & dispatch confirmation receipt directly to WhatsApp
      if (clean10) {
        const { data: sess } = await supabase
          .from("whatsapp_sessions")
          .select("id, patient_phone, session_data")
          .ilike("patient_phone", `%${clean10}%`)
          .limit(1)
          .maybeSingle();

        if (sess) {
          const sessData = sess.session_data || {};
          const tokenNumber = sessData.tokenNumber || 1;
          const approxTime = sessData.approxTime || "10:00 AM";
          const selectedDisplay = sessData.selectedDateDisplay || new Date().toISOString().split("T")[0];
          const doctorName = sessData.doctorName || "Doctor";
          const clinicName = sessData.clinicName || "Connected Clinic";

          const updatedData = {
            ...sessData,
            isVerifiedPaid: true,
            pendingInvoiceId: resolvedInvoiceId
          };

          await supabase
            .from("whatsapp_sessions")
            .update({ current_state: "COMPLETED", session_data: updatedData })
            .eq("id", sess.id);

          // Direct Outbound Meta Graph API Dispatch (<200ms)
          const metaToken = Deno.env.get("META_WHATSAPP_TOKEN") || Deno.env.get("META_ACCESS_TOKEN") || Deno.env.get("OWNER_SYSTEM_TOKEN") || "";
          const phoneId = Deno.env.get("META_PHONE_NUMBER_ID") || "549557451578330";
          if (metaToken && sess.patient_phone) {
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
                  to: sess.patient_phone,
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
