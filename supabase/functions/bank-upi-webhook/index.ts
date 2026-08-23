import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getIstDateString, getIstDateDisplay } from "../_shared/istDate.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Security Check: Validate Secret Header to prevent unauthorized webhook spam
    const requestSecret = req.headers.get("x-webhook-secret");
    const systemSecret = Deno.env.get("BANK_SMS_SECRET");
    const isDevelopment = Deno.env.get("ENVIRONMENT") === "development";
    
    const isValidSecret = systemSecret 
      ? requestSecret === systemSecret 
      : (isDevelopment && requestSecret === "mediflow-bank-secret");

    if (!isValidSecret) {
      console.warn("[Bank SMS Webhook] Unauthorized request blocked: Invalid or missing secret key.");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = await req.json();
    const sender = payload.sender || payload.from || "BANK-ALERT";
    const rawMessage = payload.message || payload.body || payload.text || "";
    const podId = payload.podId || payload.pod_id || "dfb2a1a8-8e68-4f8a-929e-4a6c8e317001"; // Default clinic pod

    if (!rawMessage) {
      throw new Error("Message body is empty");
    }

    console.log(`[Bank SMS Webhook] Ingested raw message from ${sender}: "${rawMessage}"`);

    // 2. Parse UTR (12-digit UPI transaction reference starting with 3, 4, 5, 6, etc.)
    // Examples: "UPI Ref 620584739102", "Ref No. 620584739102", "Transaction ID 620584739102"
    let utr = "";
    const utrRegexes = [
      /\b([3-6]\d{11})\b/, // Looks for a 12-digit number starting with 3, 4, 5, or 6
      /ref(?:erence)?\s*(?:no)?\.?\s*(\d{12})/i,
      /txn\s*(?:id)?\.?\s*(\d{12})/i,
      /upi\s*ref\s*(\d{12})/i
    ];

    for (const regex of utrRegexes) {
      const match = rawMessage.match(regex);
      if (match && match[1]) {
        utr = match[1];
        break;
      }
    }

    // 3. Parse Amount
    // Examples: "credited with Rs 515.00", "Rs.515.00 credited", "Received Rs. 515.00"
    let amount = 0;
    const amountRegexes = [
      /rs\.?\s*(\d+(?:\.\d{2})?)/i,
      /inr\s*(\d+(?:\.\d{2})?)/i,
      /credited\s*(?:with)?\s*rs\.?\s*(\d+(?:\.\d{2})?)/i,
      /received\s*rs\.?\s*(\d+(?:\.\d{2})?)/i
    ];

    for (const regex of amountRegexes) {
      const match = rawMessage.match(regex);
      if (match && match[1]) {
        amount = parseFloat(match[1]);
        break;
      }
    }

    if (!utr || amount <= 0) {
      console.warn(`[Bank SMS Webhook] Skip: Non-transactional or unparseable alert. UTR: ${utr || "N/A"}, Amount: ₹${amount}`);
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Message ignored (not a valid UPI credit SMS)",
        parsed: { utr, amount }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Save parsed transaction into Postgres bank_upi_transactions
    const { data: insData, error: insErr } = await supabase
      .from("bank_upi_transactions")
      .insert({
        utr: utr,
        amount: amount,
        sender: sender,
        raw_message: rawMessage,
        pod_id: podId,
        is_reconciled: false
      })
      .select()
      .maybeSingle();

    if (insErr) {
      if (insErr.code === "23505") { // Unique violation: UTR already registered
        console.log(`[Bank SMS Webhook] Duplicate alert skipped: UTR ${utr} already registered.`);
        return new Response(JSON.stringify({ success: true, message: "Duplicate transaction ignored" }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw insErr;
    }

    console.log(`[Bank SMS Webhook] Successfully registered UPI Credit! UTR: ${utr}, Amount: ₹${amount}`);

    // 5. Look for WhatsApp session waiting for this UTR
    const { data: waitingSess, error: wsErr } = await supabase
      .from("whatsapp_sessions")
      .select("*")
      .eq("session_data->>pendingVerificationUtr", utr)
      .maybeSingle();

    if (!wsErr && waitingSess) {
      console.log(`[Bank SMS Webhook] Found waiting WhatsApp session for phone: ${waitingSess.patient_phone}`);
      const sessionData = waitingSess.session_data || {};
      const invoiceId = sessionData.pendingInvoiceId;
      const apptId = sessionData.pendingApptId;
      let tokenNumber = sessionData.tokenNumber || 1;
      let approxTime = sessionData.approxTime;
      let resolvedApptDate = sessionData.selectedDateDisplay || sessionData.selectedDate;
      if (apptId || waitingSess.patient_id) {
        try {
          let apptQ = supabase.from("appointments").select("virtual_date, virtual_time, appointment_time, token_number");
          if (apptId) {
            apptQ = apptQ.eq("id", apptId);
          } else if (waitingSess.patient_id) {
            apptQ = apptQ.eq("patient_id", waitingSess.patient_id).order("created_at", { ascending: false }).limit(1);
          }
          const { data: dbAppt } = await apptQ.maybeSingle();
          if (dbAppt) {
            if (dbAppt.virtual_date) {
              resolvedApptDate = dbAppt.virtual_date;
            } else if (dbAppt.appointment_time) {
              try {
                resolvedApptDate = getIstDateString(new Date(dbAppt.appointment_time));
              } catch {
                resolvedApptDate = String(dbAppt.appointment_time).split('T')[0];
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
      if (!approxTime) {
        approxTime = sessionData.selectedSlot ? sessionData.selectedSlot.split("-")[0].trim() : "10:00 AM";
      }
      const selectedDisplay = resolvedApptDate || getIstDateString();
      const doctorName = sessionData.doctorName || "Doctor";
      const clinicName = sessionData.clinicName || "Clinic";

      // Settle invoice and transaction atomically
      await supabase
        .from("bank_upi_transactions")
        .update({ is_reconciled: true, invoice_id: invoiceId })
        .eq("id", insData.id);

      if (invoiceId) {
        await supabase.rpc('process_invoice_settlement', {
          p_invoice_id: invoiceId,
          p_payment_method: 'upi',
          p_amount_paid: amount,
          p_gateway_reference_id: utr
        });
      }

      if (apptId) {
        const isVirtualSlot = sessionData.consultationType === "virtual";
        const finalStatus = isVirtualSlot ? "ready_for_consult" : "scheduled";
        await supabase
          .from("appointments")
          .update({ status: finalStatus, payment_status: "cleared" })
          .eq("id", apptId);
      }

      // Update session state to COMPLETED and remove pending UTR
      const nextSessData = { ...sessionData };
      delete nextSessData.pendingVerificationUtr;
      delete nextSessData.pendingVerificationAmount;

      await supabase.rpc('atomic_update_whatsapp_session', {
        p_patient_phone: waitingSess.patient_phone,
        p_patient_id: waitingSess.patient_id || null,
        p_pod_id: waitingSess.pod_id || null,
        p_entity_id: waitingSess.pod_id || null,
        p_current_state: "COMPLETED",
        p_message: {
          sender: "agent",
          text: `🎉 *PAYMENT VERIFIED (Bank Synced)!* 🟢\n\nAapka direct UPI payment successfully clear ho gaya hai.\n\n• Token Number: ${tokenNumber}\n• Date: ${selectedDisplay}\n• Approximate Time: ${approxTime}\n• Doctor: ${doctorName}\n• Clinic: ${clinicName}\n\nThank you for choosing VitalSync!`,
          timestamp: new Date().toISOString(),
          time: new Date().toISOString()
        },
        p_session_data_updates: nextSessData
      });

      // Send WhatsApp dispatch confirmation to Meta Graph API
      const metaToken = Deno.env.get("META_WHATSAPP_TOKEN") || Deno.env.get("META_ACCESS_TOKEN") || Deno.env.get("OWNER_SYSTEM_TOKEN") || "";
      const phoneId = Deno.env.get("META_PHONE_NUMBER_ID") || "549557451578330";
      const outboundPhone = waitingSess.patient_phone;

      if (metaToken && outboundPhone) {
        try {
          const confirmText = `🎉 *PAYMENT VERIFIED (Bank Synced)!* 🟢\n\nAapka direct UPI payment confirm ho gaya hai.\n\n*Appointment Details*:\n• Doctor: ${doctorName}\n• Clinic: ${clinicName}\n• Token Number: ${tokenNumber}\n• Date: ${selectedDisplay}\n• Approximate Time: ${approxTime}\n• Fee Paid: ₹${amount.toFixed(2)}\n• Status: Confirmed ✅\n\nTime par clinic pahuchein aur counter par token number (${tokenNumber}) show karein. Thank you!`;
          await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${metaToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: outboundPhone,
              type: "text",
              text: { body: confirmText }
            })
          });
        } catch (metaErr) {
          console.error("[Bank SMS Webhook] Failed to dispatch WhatsApp confirmation:", metaErr);
        }
      }
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: "Transaction logged successfully", 
      record: insData 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("[Bank SMS Webhook] Exception occurred:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
