import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// =============================================================================
// Mediflow — 24/7 Supabase Keep-Alive Health Ping Microservice
// Public endpoint used by UptimeRobot / Better Stack / GitHub Actions to keep Supabase awake.
// URL: https://<PROJECT_REF>.supabase.co/functions/v1/ping
// Executes a live SQL query on Postgres to ensure the DB engine never goes to sleep.
// =============================================================================

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Cache-Control": "no-cache, no-store, must-revalidate"
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let dbActive = false;
  let dbError = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://kguupaybvbngyzyofjun.supabase.co";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");

    if (supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data, error } = await supabase.from("appointments").select("id").limit(1);
      if (!error) {
        dbActive = true;
      } else {
        dbError = error.message;
      }
    }
  } catch (err: any) {
    dbError = err?.message || "DB query failed";
  }

  return new Response(
    JSON.stringify({
      status: "ok",
      db_active: dbActive,
      db_error: dbError,
      timestamp: new Date().toISOString()
    }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    }
  );
});

