import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

// =============================================================================
// DECOMMISSIONED: phonepe-order Edge Function
// Third-party Payment Aggregators decommissioned per RBI PSS Act 2007 & NMC Ethics §6.4.
// Mediflow operates exclusively as a Direct Clinic Operations Ledger:
//   1. Cash at Counter (Compounder POS)
//   2. Direct Clinic UPI QR (upi://pay?pa=... peer-to-peer into clinic account)
// =============================================================================

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS" || req.method === "HEAD") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  return new Response(
    JSON.stringify({
      success: true,
      deprecated: true,
      message: "Third-party payment aggregator decommissioned per RBI PSS Act 2007 & NMC Ethics §6.4. VitalSync operates as a 100% Direct Clinic Ledger. Use Direct Clinic UPI (upi://pay) or Cash at Counter.",
      payment_mode: "direct_ledger"
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    }
  );
});
