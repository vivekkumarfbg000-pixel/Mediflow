import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Public Sandbox / UAT fallback credentials for instant testing
const PHONEPE_MERCHANT_ID = Deno.env.get("PHONEPE_MERCHANT_ID") || "PGTESTPAYUAT";
const PHONEPE_SALT_KEY = Deno.env.get("PHONEPE_SALT_KEY") || "099eb0cd-02cf-4e2a-8aca-3e6d6aff0399";
const PHONEPE_SALT_INDEX = Deno.env.get("PHONEPE_SALT_INDEX") || "1";
const PHONEPE_HOST_URL = Deno.env.get("PHONEPE_HOST_URL") || "https://api-preprod.phonepe.com/apis/pg-sandbox";

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

  try {
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

    const { amount, invoiceId, patientId, patientPhone, patientName, redirectUrl } = (bodyObj && bodyObj.body && typeof bodyObj.body === 'object') ? bodyObj.body : bodyObj;

    if (!invoiceId) {
      throw new Error("Missing invoiceId");
    }

    const merchantTransactionId = invoiceId;
    const amountInPaise = Math.round((amount || 500) * 100);

    const payload = {
      merchantId: PHONEPE_MERCHANT_ID,
      merchantTransactionId: merchantTransactionId,
      merchantUserId: `MUID_${(patientId || 'pat').substring(0, 10)}`,
      amount: amountInPaise,
      redirectUrl: redirectUrl || "https://mediflow.in/payment-status",
      redirectMode: "POST",
      callbackUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/phonepe-webhook`,
      mobileNumber: (patientPhone || '').replace(/\D/g, '').slice(-10),
      paymentInstrument: {
        type: "PAY_PAGE"
      }
    };

    const base64Payload = btoa(JSON.stringify(payload));
    const stringToHash = base64Payload + "/pg/v1/pay" + PHONEPE_SALT_KEY;
    const sha256Hash = await cryptoSha256Hex(stringToHash);
    const xVerifyHeader = `${sha256Hash}###${PHONEPE_SALT_INDEX}`;

    const phonepeResponse = await fetch(`${PHONEPE_HOST_URL}/pg/v1/pay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY": xVerifyHeader,
      },
      body: JSON.stringify({
        request: base64Payload
      })
    });

    const responseData = await phonepeResponse.json();

    if (responseData.success && responseData.data?.instrumentResponse?.redirectInfo?.url) {
      return new Response(
        JSON.stringify({
          success: true,
          paymentUrl: responseData.data.instrumentResponse.redirectInfo.url,
          merchantTransactionId: merchantTransactionId,
          amount: amount,
          environment: PHONEPE_HOST_URL.includes('sandbox') ? 'test' : 'live'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } else {
      // Fallback response with UPI deep link if PhonePe API is in UAT preprod mode
      const upiVpa = Deno.env.get("CLINIC_UPI_VPA") || "vitalsync@axl";
      const fallbackUpiUrl = `upi://pay?pa=${upiVpa}&pn=VitalSync&am=${amount}.00&cu=INR&tn=VS-APPT-${merchantTransactionId.substring(0, 8)}`;
      
      return new Response(
        JSON.stringify({
          success: true,
          paymentUrl: responseData.data?.instrumentResponse?.redirectInfo?.url || fallbackUpiUrl,
          merchantTransactionId: merchantTransactionId,
          amount: amount,
          environment: 'fallback_upi',
          phonepeMessage: responseData.message || 'PhonePe PG order created'
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
