import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getIstDateString, getIstDateDisplay } from "../_shared/istDate.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-verify',
};

const PHONEPE_SALT_KEY = Deno.env.get("PHONEPE_SALT_KEY") || "099eb0cd-02cf-4e2a-8aca-3e6d6aff0399";
const PHONEPE_SALT_INDEX = Deno.env.get("PHONEPE_SALT_INDEX") || "1";

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
    const rawBody = await req.text();
    const xVerifyHeader = req.headers.get("x-verify") || "";

    let bodyObj: any = {};
    try {
      bodyObj = JSON.parse(rawBody);
    } catch {
      /* ignore */
    }

    const responseBase64 = bodyObj.response || "";
    if (responseBase64 && xVerifyHeader) {
      const calculatedHash = await cryptoSha256Hex(responseBase64 + PHONEPE_SALT_KEY);
      const expectedVerify = `${calculatedHash}###${PHONEPE_SALT_INDEX}`;

      if (xVerifyHeader !== expectedVerify) {
        console.warn("[PhonePe Webhook] Invalid X-VERIFY signature header mismatch.");
        return new Response(JSON.stringify({ status: "ERROR", error: "Invalid signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      console.warn("[PhonePe Webhook] Missing X-VERIFY signature or payload.");
      return new Response(JSON.stringify({ status: "ERROR", error: "Missing signature or payload" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decode response payload
    let decodedData: any = {};
    if (responseBase64) {
      try {
        decodedData = JSON.parse(atob(responseBase64));
      } catch (err) {
        console.error("[PhonePe Webhook] Error decoding response base64:", err);
        return new Response(JSON.stringify({ status: "ERROR", error: "Malformed payload" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      decodedData = bodyObj;
    }

    const isSuccess = decodedData.success === true && (decodedData.code === "PAYMENT_SUCCESS" || decodedData.data?.state === "COMPLETED");
    const merchantTransactionId = decodedData.data?.merchantTransactionId || bodyObj.merchantTransactionId;
    const amountPaid = (decodedData.data?.amount || 0) / 100;
    const phonepeTransactionId = decodedData.data?.transactionId || `PAY_${Date.now()}`;

    if (isSuccess && merchantTransactionId) {
      console.log(`[PhonePe Webhook] PAYMENT_SUCCESS verified for TxID: ${merchantTransactionId}, Amount: ₹${amountPaid}`);

      // 1. Resolve unified invoice with prefix fallback
      let invRow = null;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const isUuid = uuidRegex.test(merchantTransactionId);

      if (isUuid) {
        const { data: exactInv } = await supabase
          .from("unified_invoices")
          .select("id, patient_id, payment_status, appointment_id")
          .eq("id", merchantTransactionId)
          .maybeSingle();
        invRow = exactInv;
      }

      if (!invRow) {
        const cleanSnippet = String(merchantTransactionId).replace("inv-wa-", "").substring(0, 8);
        const { data: prefixInvs } = await supabase
          .rpc("find_invoice_by_prefix", { p_prefix: cleanSnippet });
        if (prefixInvs && prefixInvs.length > 0) {
          invRow = prefixInvs[0];
        }
      }

      const targetInvoiceId = invRow?.id;
      const patientId = invRow?.patient_id;

      if (!targetInvoiceId) {
        console.error(`[PhonePe Webhook] Invoice not found for merchantTransactionId: ${merchantTransactionId}`);
        return new Response(JSON.stringify({ status: "ERROR", error: "Invoice not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (invRow.payment_status === "cleared") {
        console.log(`[PhonePe Webhook] ⏭️ Duplicate event skipped: Invoice ${targetInvoiceId} is already cleared.`);
        return new Response(JSON.stringify({ status: "SUCCESS", message: "Duplicate event ignored" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        if (targetInvoiceId) {
          // Execute Atomic Payment Settlement RPC
          const { error: rpcError } = await supabase.rpc('process_invoice_settlement', {
            p_invoice_id: targetInvoiceId,
            p_payment_method: 'phonepe',
            p_amount_paid: amountPaid || 500,
            p_gateway_reference_id: phonepeTransactionId
          });

          if (rpcError) {
            throw new Error(`RPC Settlement Failed: ${rpcError.message}`);
          }

          // Update appointment status to scheduled & payment_status to cleared
          if (invRow?.appointment_id) {
            await supabase
              .from("appointments")
              .update({ status: "ready_for_consult", payment_status: "cleared" })
              .eq("id", invRow.appointment_id);
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
              if (sessData.pendingInvoiceId === targetInvoiceId) {
                tokenNumber = sessData.tokenNumber || tokenNumber;
                approxTime = sessData.approxTime || approxTime;
                selectedDisplay = sessData.selectedDateDisplay || sessData.selectedDate || selectedDisplay;
                doctorName = sessData.doctorName || doctorName;
                clinicName = sessData.clinicName || clinicName;

                if (targetInvoiceId) {
                  try {
                    const { data: dbInv } = await supabase.from("unified_invoices").select("encounter_id").eq("id", targetInvoiceId).maybeSingle();
                    if (dbInv?.encounter_id) {
                      const { data: dbAppt } = await supabase.from("appointments").select("virtual_date, appointment_time, token_number").eq("encounter_id", dbInv.encounter_id).maybeSingle();
                      if (dbAppt?.virtual_date) {
                        selectedDisplay = dbAppt.virtual_date;
                      } else if (dbAppt?.appointment_time) {
                        try {
                          selectedDisplay = getIstDateString(new Date(dbAppt.appointment_time));
                        } catch {
                          selectedDisplay = String(dbAppt.appointment_time).split('T')[0];
                        }
                      }
                      if (dbAppt?.token_number) tokenNumber = dbAppt.token_number;
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
                    const confirmText = `🎉 *PAYMENT VERIFIED & APPOINTMENT SCHEDULED!* 🟢\n\n*Appointment Details*:\n• Doctor: ${doctorName}\n• Clinic: ${clinicName}\n• Token Number: ${tokenNumber}\n• Date: ${selectedDisplay}\n• Approximate Time: ${approxTime}\n• Fee Paid: ₹${(amountPaid || 500).toFixed(2)}\n• Status: Confirmed ✅\n\nTime par clinic pahuchein aur counter par token number (${tokenNumber}) show karein. Thank you for choosing VitalSync! 😊`;
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
                    console.error("[PhonePe Webhook] Failed to dispatch WhatsApp confirmation:", metaErr);
                  }
                }
              }
            }
          }
        }
      } catch (e: any) {
        console.error("[PhonePe Webhook] Settlement exception:", e);
      }
    }

    return new Response(
      JSON.stringify({ status: "SUCCESS", message: "PhonePe webhook processed" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error("[PhonePe Webhook] Error processing webhook:", error);
    return new Response(
      JSON.stringify({ status: "ERROR", error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
