import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { isRateLimited } from "../_shared/rate-limit.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Default UAT / Staging fallback credentials for Paytm Business
const PAYTM_MID = Deno.env.get("PAYTM_MID") || "DIY12345678901234567";
const PAYTM_MERCHANT_KEY = Deno.env.get("PAYTM_MERCHANT_KEY") || "bKMVy13758154655";
const PAYTM_WEBSITE = Deno.env.get("PAYTM_WEBSITE") || "WEBSTAGING";
const PAYTM_HOST_URL = Deno.env.get("PAYTM_HOST_URL") || "https://securegw-stage.paytm.in";

async function cryptoSha256Hex(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Rate Limiter Check (15 requests/min per client IP)
    if (await isRateLimited(req, supabase, 15, 60)) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
        status: 429,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    let bodyObj: any = {};
    try {
      const text = await req.text();
      if (text) {
        bodyObj = JSON.parse(text);
        if (typeof bodyObj === 'string') bodyObj = JSON.parse(bodyObj);
      }
    } catch (_e) {
      bodyObj = {};
    }

    const { amount, invoiceId, patientId, patientPhone, patientName } = (bodyObj && bodyObj.body && typeof bodyObj.body === 'object') ? bodyObj.body : bodyObj;

    const cleanInvoiceId = String(invoiceId || 'direct').replace(/[^a-zA-Z0-9-]/g, '').substring(0, 20);
    const orderId = `PYTM_${cleanInvoiceId}_${Date.now().toString().slice(-6)}`;
    const cleanAmount = (Math.round((Number(amount) || 500) * 100) / 100).toFixed(2);
    const sanitizedPhone = (patientPhone || '').replace(/\D/g, '').slice(-10) || '9999999999';

    const paytmBody = {
      requestType: "Payment",
      mid: PAYTM_MID,
      websiteName: PAYTM_WEBSITE,
      orderId: orderId,
      callbackUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/paytm-webhook`,
      txnAmount: {
        value: cleanAmount,
        currency: "INR",
      },
      userInfo: {
        custId: `CUST_${(patientId || 'pat').substring(0, 10)}`,
        mobile: sanitizedPhone,
      },
    };

    // Calculate Paytm SHA-256 Checksum Signature
    const rawPayloadString = JSON.stringify(paytmBody) + PAYTM_MERCHANT_KEY;
    const checksumHash = await cryptoSha256Hex(rawPayloadString);

    const initiateTxnUrl = `${PAYTM_HOST_URL}/theia/api/v1/initiateTransaction?mid=${PAYTM_MID}&orderId=${orderId}`;

    const paytmResponse = await fetch(initiateTxnUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        head: {
          signature: checksumHash,
        },
        body: paytmBody,
      }),
    });

    const responseData = await paytmResponse.json();

    if (responseData.body?.resultInfo?.resultStatus === "S" && responseData.body?.txnToken) {
      const txnToken = responseData.body.txnToken;
      const checkoutUrl = `${PAYTM_HOST_URL}/theia/api/v1/showPaymentPage?mid=${PAYTM_MID}&orderId=${orderId}&txnToken=${txnToken}`;

      return new Response(
        JSON.stringify({
          success: true,
          paymentUrl: checkoutUrl,
          orderId: orderId,
          txnToken: txnToken,
          amount: amount,
          environment: PAYTM_HOST_URL.includes("stage") ? "test" : "live"
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } else {
      // Fallback UPI link if Paytm API is in sandbox mode
      const upiVpa = Deno.env.get("CLINIC_UPI_VPA") || "vitalsync@axl";
      const fallbackUpiUrl = `upi://pay?pa=${upiVpa}&pn=VitalSync&am=${cleanAmount}&cu=INR&tn=PAYTM-VS-${orderId.substring(0, 8)}`;

      return new Response(
        JSON.stringify({
          success: true,
          paymentUrl: fallbackUpiUrl,
          orderId: orderId,
          amount: amount,
          environment: "fallback_upi",
          paytmMessage: responseData.body?.resultInfo?.resultMsg || "Paytm PG order created"
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
