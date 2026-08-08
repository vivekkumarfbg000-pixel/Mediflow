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

      // 1. Resolve unified invoice (Strictly match provided merchantTransactionId = invoice.id)
      const { data: invRow } = await supabase
        .from("unified_invoices")
        .select("id, patient_id, payment_status, appointment_id")
        .eq("id", merchantTransactionId)
        .maybeSingle();

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
        }
      } catch (e: any) {
        throw e;
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
