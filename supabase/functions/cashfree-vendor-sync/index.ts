import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

// =============================================================================
// DECOMMISSIONED: cashfree-vendor-sync Edge Function
// Vendor marketplace split onboarding eradicated per NMC Ethics §6.4 & RBI PSS Act.
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
      message: "Marketplace vendor split onboarding decommissioned. 100% Direct Clinic Ledger active.",
      status: "direct_ledger_active"
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    }
  );
});
