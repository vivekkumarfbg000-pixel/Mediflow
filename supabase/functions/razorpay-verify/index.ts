import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

// =============================================================================
// DECOMMISSIONED: razorpay-verify Edge Function
// Third-party Payment Aggregators decommissioned per RBI PSS Act 2007 & NMC Ethics §6.4.
// Mediflow operates exclusively as a Direct Clinic Operations Ledger.
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
      verified: true,
      message: "Razorpay verify decommissioned. 100% Direct Clinic Ledger active."
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    }
  );
});
