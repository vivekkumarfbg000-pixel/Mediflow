import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getIstDateString, getIstDateDisplay } from "../_shared/istDate.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PAYTM_MERCHANT_KEY = Deno.env.get("PAYTM_MERCHANT_KEY") || "bKMVy13758154655";

async function cryptoSha256Hex(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    let payload: any = {};

    if (req.headers.get("content-type")?.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      formData.forEach((value, key) => {
        payload[key] = value;
      });
    } else {
      payload = await req.json().catch(() => ({}));
    }

    const STATUS = payload.STATUS || payload.STATUS_CODE || payload.resultInfo?.resultStatus;
    const ORDERID = payload.ORDERID || payload.orderId;
    const TXNID = payload.TXNID || payload.txnId || `PYTM_${Date.now()}`;
    const TXNAMOUNT = parseFloat(payload.TXNAMOUNT || payload.txnAmount || "500.00");

    const isSuccess = STATUS === "TXN_SUCCESS" || STATUS === "S" || payload.RESPCODE === "01";
    const CHECKSUMHASH = payload.CHECKSUMHASH;

    if (!CHECKSUMHASH) {
      console.error("[Paytm Webhook] ❌ Missing CHECKSUMHASH. Rejecting request.");
      return new Response(
        JSON.stringify({ status: "ERROR", message: "Missing cryptographic checksum" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── CRITICAL SECURITY: Actual HMAC-SHA256 Checksum Verification ──────────
    // Sort all payload keys alphabetically (excluding CHECKSUMHASH itself),
    // concatenate their values pipe-delimited, then HMAC-SHA256 with merchant key.
    // Without this, ANY attacker can POST a fake TXN_SUCCESS with CHECKSUMHASH: "garbage".
    const payloadKeysForChecksum = Object.keys(payload)
      .filter(k => k !== "CHECKSUMHASH")
      .sort();
    const checksumString = payloadKeysForChecksum.map(k => `${payload[k] ?? ""}`).join("|");

    const encoder = new TextEncoder();
    const keyData = encoder.encode(PAYTM_MERCHANT_KEY);
    const msgData = encoder.encode(checksumString);
    const cryptoKey = await crypto.subtle.importKey(
      "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
    const computedChecksumHex = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
    const computedChecksumBase64 = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

    // Compare against both hex and base64 encodings for maximum compatibility
    if (CHECKSUMHASH !== computedChecksumHex && CHECKSUMHASH !== computedChecksumBase64) {
      console.error(`[Paytm Webhook] ❌ CHECKSUMHASH verification FAILED. Computed: ${computedChecksumHex.substring(0, 16)}..., Received: ${String(CHECKSUMHASH).substring(0, 16)}...`);
      return new Response(
        JSON.stringify({ status: "ERROR", message: "Invalid checksum signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log("[Paytm Webhook] ✅ CHECKSUMHASH cryptographically verified.");
    // ─────────────────────────────────────────────────────────────────────────

    if (isSuccess && ORDERID) {
      console.log(`[Paytm Webhook] TXN_SUCCESS verified for OrderID: ${ORDERID}, TxnID: ${TXNID}, Amount: ₹${TXNAMOUNT}`);

      // IDEMPOTENCY: Check if this payment event was already processed
      const idempotencyKey = `paytm_${TXNID}_${ORDERID}`;
      const { data: existingKey } = await supabase
        .from("webhook_idempotency_keys")
        .select("id")
        .eq("key", idempotencyKey)
        .maybeSingle();

      if (existingKey) {
        console.log(`[Paytm Webhook] ⏭️ Duplicate skipped: ${idempotencyKey}`);
        return new Response(JSON.stringify({ success: true, skipped: true }), { status: 200, headers: corsHeaders });
      }

      // 1. Resolve unified invoice
      let invRows = null;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const isUuid = uuidRegex.test(ORDERID);

      if (isUuid) {
        const { data: exactInv } = await supabase
          .from("unified_invoices")
          .select("*")
          .or(`id.eq.${ORDERID},encounter_id.eq.${ORDERID}`)
          .maybeSingle();
        invRows = exactInv;
      }

      if (!invRows) {
        const cleanSnippet = String(ORDERID).replace("inv-wa-", "").substring(0, 8);
        const { data: prefixInvs } = await supabase
          .rpc("find_invoice_by_prefix", { p_prefix: cleanSnippet });
        if (prefixInvs && prefixInvs.length > 0) {
          invRows = prefixInvs[0];
        }
      }

      let targetInvoiceId = invRows?.id;
      let patientId = invRows?.patient_id;

      if (!targetInvoiceId) {
        console.error(`[Paytm Webhook] ❌ Invoice lookup failed for ORDERID: ${ORDERID}. Hallucination prevention active. Dropping request.`);
        return new Response(
          JSON.stringify({ status: "ERROR", message: "Invoice not found or ORDERID mismatch" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      if (targetInvoiceId) {
        // 1. Execute Atomic Payment Settlement RPC (locks row, manages commission splits, refuels safety buffer)
        const { error: rpcError } = await supabase.rpc('process_invoice_settlement', {
          p_invoice_id: targetInvoiceId,
          p_payment_method: 'paytm',
          p_amount_paid: TXNAMOUNT,
          p_gateway_reference_id: TXNID
        });

        if (rpcError) {
          throw new Error(`process_invoice_settlement RPC Failed: ${rpcError.message}`);
        }

        // Record idempotency key
        await supabase.from("webhook_idempotency_keys").insert({ key: idempotencyKey }).catch(() => {});

        // Update appointment status to scheduled & payment_status to cleared
        const apptIdToUpdate = invRows?.appointment_id || invRows?.encounter_id;
        if (apptIdToUpdate) {
          await supabase
            .from("appointments")
            .update({ status: "ready_for_consult", payment_status: "cleared" })
            .eq("id", apptIdToUpdate);
        } else if (patientId) {
          await supabase
            .from("appointments")
            .update({ status: "ready_for_consult", payment_status: "cleared" })
            .eq("patient_id", patientId)
            .eq("status", "pending_payment");
        }

        // 2. Resolve patient phone to update WhatsApp session if it was initiated via bot
        let patientPhone = "";
        if (patientId) {
          const { data: pat } = await supabase
            .from("patient_registry")
            .select("phone")
            .eq("id", patientId)
            .maybeSingle();
          if (pat?.phone) {
            patientPhone = pat.phone;
          }
        }

        const clean10 = String(patientPhone).replace(/\D/g, "").slice(-10);
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
              
              // Anti-Hijacking Guard: Only transition session if it strictly matches this invoice
              if (sessData.pendingInvoiceId === targetInvoiceId || !sessData.pendingInvoiceId) {
                tokenNumber = sessData.tokenNumber || tokenNumber;
                approxTime = sessData.approxTime || approxTime;
                selectedDisplay = sessData.selectedDateDisplay || sessData.selectedDate || selectedDisplay;
                doctorName = sessData.doctorName || doctorName;
                clinicName = sessData.clinicName || clinicName;

                const apptLookupId = sessData.pendingApptId;
                if (apptLookupId || sess.patient_id || targetInvoiceId) {
                  try {
                    let apptQ = supabase.from("appointments").select("virtual_date, virtual_time, appointment_time, token_number");
                    if (apptLookupId) {
                      apptQ = apptQ.eq("id", apptLookupId);
                    } else if (sess.patient_id) {
                      apptQ = apptQ.eq("patient_id", sess.patient_id).order("created_at", { ascending: false }).limit(1);
                    }
                    const { data: dbAppt } = await apptQ.maybeSingle();
                    if (dbAppt) {
                      if (dbAppt.virtual_date) {
                        selectedDisplay = /^\d{4}-\d{2}-\d{2}$/.test(dbAppt.virtual_date)
                          ? getIstDateDisplay(new Date(dbAppt.virtual_date + "T12:00:00+05:30"))
                          : dbAppt.virtual_date;
                      } else if (dbAppt.appointment_time) {
                        try {
                          selectedDisplay = getIstDateDisplay(new Date(dbAppt.appointment_time));
                        } catch {
                          selectedDisplay = String(dbAppt.appointment_time).split('T')[0];
                        }
                      }
                      if (dbAppt.token_number) tokenNumber = dbAppt.token_number;
                      if (dbAppt.virtual_time) {
                        approxTime = dbAppt.virtual_time.split("-")[0].trim();
                      } else if (dbAppt.appointment_time) {
                        try {
                          const dt = new Date(dbAppt.appointment_time);
                          approxTime = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true }).format(dt);
                        } catch {}
                      }
                    }
                  } catch (_e) {}
                }

                const updates = { isVerifiedPaid: true, pendingInvoiceId: targetInvoiceId };
                await supabase.rpc('atomic_update_whatsapp_session', {
                  p_patient_phone: sess.patient_phone,
                  p_patient_id: sess.patient_id || null,
                  p_pod_id: sess.pod_id || null,
                  p_entity_id: sess.pod_id || null,
                  p_current_state: "COMPLETED",
                  p_message: null,
                  p_session_data_updates: updates
                });

              // Direct Outbound Meta Graph API Dispatch (<200ms)
              const metaToken = Deno.env.get("OWNER_SYSTEM_TOKEN") || Deno.env.get("META_WHATSAPP_TOKEN") || Deno.env.get("META_ACCESS_TOKEN") || "";
              const phoneId = Deno.env.get("META_PHONE_NUMBER_ID") || Deno.env.get("OWNER_PHONE_NUMBER_ID") || "1168872099651441";
              const outboundPhone = sess?.patient_phone || patientPhone;

              if (metaToken && outboundPhone) {
                try {
                  const confirmText = `🎉 *PAYMENT VERIFIED & APPOINTMENT SCHEDULED!* 🟢\n\n*Appointment Details*:\n• Doctor: ${doctorName}\n• Clinic: ${clinicName}\n• Token Number: ${tokenNumber}\n• Date: ${selectedDisplay}\n• Approximate Time: ${approxTime}\n• Fee Paid: ₹${TXNAMOUNT.toFixed(2)}\n• Status: Confirmed ✅\n\nTime par clinic pahuchein aur counter par token number (${tokenNumber}) show karein. Thank you for choosing VitalSync! 😊`;
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
                } catch (metaErr) {
                  console.error("[Paytm Webhook] Failed to dispatch WhatsApp confirmation:", metaErr);
                }
              }
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ status: "SUCCESS", message: "Paytm webhook processed" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error("[Paytm Webhook] Error processing webhook:", error);
    return new Response(
      JSON.stringify({ status: "ERROR", error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  }
});
