import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

// =============================================================================
// DECOMMISSIONED: razorpay-webhook Edge Function
// Third-party Payment Aggregators decommissioned per RBI PSS Act & NMC Ethics §6.4.
// All payments settled directly via Counter Cash or Direct Clinic UPI.
// =============================================================================

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS" || req.method === "HEAD") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  return new Response(
    JSON.stringify({
      received: true,
      deprecated: true,
      status: "deprecated_no_op",
      message: "Razorpay webhook decommissioned. VitalSync operates on a 100% Direct Clinic Ledger."
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    }
  );
});
