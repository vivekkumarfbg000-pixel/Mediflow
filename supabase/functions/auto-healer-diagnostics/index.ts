import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { getCorsHeaders } from "../_shared/cors.ts";

interface DiagnosticPayload {
  error_code?: string;
  error_stack?: string;
  subsystem?: string;
  trace_id?: string;
  pod_id?: string;
  client_info?: Record<string, unknown>;
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: DiagnosticPayload = await req.json().catch(() => ({}));
    const startTime = performance.now();

    // 1. Measure DB ping & health
    let dbStatus = "healthy";
    let dbLatencyMs = 0;
    try {
      const dbPingStart = performance.now();
      const { error } = await supabase.from("system_health_telemetry").select("id").limit(1);
      dbLatencyMs = Math.round(performance.now() - dbPingStart);
      if (error) dbStatus = `degraded: ${error.message}`;
    } catch (e: unknown) {
      dbStatus = `error: ${e instanceof Error ? e.message : String(e)}`;
    }

    const durationMs = Math.round(performance.now() - startTime);

    // 2. Log enriched server telemetry
    if (body.error_code || body.subsystem) {
      await supabase.from("system_health_telemetry").insert({
        pod_id: body.pod_id || "global",
        subsystem: body.subsystem || "backend",
        severity: "warning",
        error_code: body.error_code || "SERVER_DIAGNOSTIC",
        error_stack: body.error_stack || `Enriched by auto-healer-diagnostics edge fn (Trace: ${body.trace_id || "N/A"})`,
        status: "healed",
        healing_attempts: 1,
      }).catch(() => {/* non-blocking log */});
    }

    const responsePayload = {
      success: true,
      timestamp: new Date().toISOString(),
      server_diagnostics: {
        db_status: dbStatus,
        db_latency_ms: dbLatencyMs,
        edge_execution_ms: durationMs,
        recommended_action: dbLatencyMs > 500 ? "RETRY_WITH_BACKOFF" : "NONE",
      },
      received_trace_id: body.trace_id || null,
    };

    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
