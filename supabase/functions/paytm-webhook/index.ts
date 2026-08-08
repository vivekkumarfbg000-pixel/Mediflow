import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

      // 1. Resolve unified invoice
      const { data: invRows } = await supabase
        .from("unified_invoices")
        .select("*")
        .or(`id.eq.${ORDERID},encounter_id.eq.${ORDERID}`)
        .maybeSingle();

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
        // Update Unified Invoice to cleared
        await supabase
          .from("unified_invoices")
          .update({
            payment_status: "cleared",
            payment_method: "paytm",
            settled_at: new Date().toISOString()
          })
          .eq("id", targetInvoiceId);

        // Update Appointment status to confirmed (Strict 1:1 binding)
        if (invRows?.appointment_id) {
          const tokenCode = targetInvoiceId.substring(0, 5).toUpperCase();
          await supabase
            .from("appointments")
            .update({
              status: "confirmed",
              payment_status: "cleared",
              token_number: `#TK-${tokenCode}`
            })
            .eq("id", invRows.appointment_id)
            .eq("status", "pending_payment");
        }

        // 2. Log idempotency settlement in vitalsync_pool_settlements
        const { data: existingSettlement } = await supabase
          .from("vitalsync_pool_settlements")
          .select("id")
          .eq("gateway_reference_id", TXNID)
          .maybeSingle();

        if (!existingSettlement) {
          await supabase.from("vitalsync_pool_settlements").insert({
            invoice_id: targetInvoiceId,
            gateway_reference_id: TXNID,
            payment_mode: "paytm_upi",
            amount: TXNAMOUNT || 500,
            settlement_status: "completed",
            created_at: new Date().toISOString()
          });
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
