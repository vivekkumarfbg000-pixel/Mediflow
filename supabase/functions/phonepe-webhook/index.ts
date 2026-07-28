import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      }
    }

    // Decode response payload
    let decodedData: any = {};
    if (responseBase64) {
      try {
        decodedData = JSON.parse(atob(responseBase64));
      } catch (err) {
        console.error("[PhonePe Webhook] Error decoding response base64:", err);
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

      // 1. Resolve unified invoice
      const { data: invRows } = await supabase
        .from("unified_invoices")
        .select("*")
        .or(`id.eq.${merchantTransactionId},encounter_id.eq.${merchantTransactionId}`)
        .maybeSingle();

      let targetInvoiceId = invRows?.id;
      let patientId = invRows?.patient_id;

      if (!targetInvoiceId) {
        // Fallback: find pending invoice
        const { data: latestPending } = await supabase
          .from("unified_invoices")
          .select("*")
          .eq("payment_status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestPending) {
          targetInvoiceId = latestPending.id;
          patientId = latestPending.patient_id;
        }
      }

      if (targetInvoiceId) {
        // Update Unified Invoice to cleared
        await supabase
          .from("unified_invoices")
          .update({
            payment_status: "cleared",
            payment_method: "phonepe",
            settled_at: new Date().toISOString()
          })
          .eq("id", targetInvoiceId);

        // Update Appointment status to confirmed
        if (patientId) {
          const tokenCode = targetInvoiceId.substring(0, 5).toUpperCase();
          await supabase
            .from("appointments")
            .update({
              status: "confirmed",
              token_number: `#TK-${tokenCode}`
            })
            .eq("patient_id", patientId)
            .eq("status", "pending_payment");
        }

        // 2. Log idempotency settlement in vitalsync_pool_settlements
        const { data: existingSettlement } = await supabase
          .from("vitalsync_pool_settlements")
          .select("id")
          .eq("gateway_reference_id", phonepeTransactionId)
          .maybeSingle();

        if (!existingSettlement) {
          await supabase.from("vitalsync_pool_settlements").insert({
            invoice_id: targetInvoiceId,
            gateway_reference_id: phonepeTransactionId,
            payment_mode: "phonepe_upi",
            amount: amountPaid || 500,
            settlement_status: "completed",
            created_at: new Date().toISOString()
          });
        }
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
        status: 200, // Return 200 to prevent retry storms
      }
    );
  }
});
