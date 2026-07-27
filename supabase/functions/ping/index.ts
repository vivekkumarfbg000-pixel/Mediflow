import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// =============================================================================
// Mediflow — 24/7 Supabase Keep-Alive Health Ping Microservice
// Public endpoint used by UptimeRobot / Better Stack to keep Supabase awake.
// URL: https://<PROJECT_REF>.supabase.co/functions/v1/ping
// Returns HTTP 200 OK to HEAD, GET, OPTIONS & POST without auth requirements.
// =============================================================================

serve(async (req) => {
  return new Response("OK", {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
      "Cache-Control": "no-cache, no-store, must-revalidate"
    }
  });
});
