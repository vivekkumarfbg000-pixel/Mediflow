import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// Health check endpoint for uptime monitoring
// Returns 200 OK with system status, or 503 if critical dependencies down

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  checks: {
    database: { status: "up" | "down"; latencyMs: number; error?: string };
    realtime: { status: "up" | "down"; latencyMs: number; error?: string };
    storage: { status: "up" | "down"; latencyMs: number; error?: string };
    auth: { status: "up" | "down"; latencyMs: number; error?: string };
    edgeFunctions: { status: "up" | "down"; latencyMs: number; error?: string };
  };
  metrics: {
    activePods: number;
    pendingInvoices: number;
    queueLength: number;
    uptimeSeconds: number;
  };
}

const VERSION = "2.0.0";
const START_TIME = Date.now();

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const checks: HealthStatus["checks"] = {
    database: { status: "down", latencyMs: 0 },
    realtime: { status: "down", latencyMs: 0 },
    storage: { status: "down", latencyMs: 0 },
    auth: { status: "down", latencyMs: 0 },
    edgeFunctions: { status: "down", latencyMs: 0 },
  };

  // 1. Database connectivity & basic query
  const dbStart = Date.now();
  try {
    const { error } = await supabase
      .from("pods")
      .select("id")
      .limit(1)
      .maybeSingle();
    checks.database = {
      status: error ? "down" : "up",
      latencyMs: Date.now() - dbStart,
      error: error?.message,
    };
  } catch (e) {
    checks.database = { status: "down", latencyMs: Date.now() - dbStart, error: String(e) };
  }

  // 2. Realtime connectivity (check if we can create a channel)
  const rtStart = Date.now();
  try {
    const channel = supabase.channel("health-check-" + Date.now());
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Realtime timeout")), 3000);
      channel
        .on("broadcast", { event: "health" }, () => {})
        .subscribe((status) => {
          clearTimeout(timeout);
          if (status === "SUBSCRIBED") resolve();
          else reject(new Error(`Realtime status: ${status}`));
        });
    });
    supabase.removeChannel(channel);
    checks.realtime = { status: "up", latencyMs: Date.now() - rtStart };
  } catch (e) {
    checks.realtime = { status: "down", latencyMs: Date.now() - rtStart, error: String(e) };
  }

  // 3. Storage connectivity
  const storageStart = Date.now();
  try {
    const { error } = await supabase.storage.listBuckets();
    checks.storage = {
      status: error ? "down" : "up",
      latencyMs: Date.now() - storageStart,
      error: error?.message,
    };
  } catch (e) {
    checks.storage = { status: "down", latencyMs: Date.now() - storageStart, error: String(e) };
  }

  // 4. Auth service
  const authStart = Date.now();
  try {
    const { error } = await supabase.auth.getSession();
    checks.auth = {
      status: error ? "down" : "up",
      latencyMs: Date.now() - authStart,
      error: error?.message,
    };
  } catch (e) {
    checks.auth = { status: "down", latencyMs: Date.now() - authStart, error: String(e) };
  }

  // 5. Edge Functions (test a lightweight one)
  const efStart = Date.now();
  try {
    const resp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/health`, {
      method: "GET",
      headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}` },
      signal: AbortSignal.timeout(3000),
    });
    checks.edgeFunctions = {
      status: resp.ok ? "up" : "down",
      latencyMs: Date.now() - efStart,
      error: resp.ok ? undefined : `HTTP ${resp.status}`,
    };
  } catch (e) {
    checks.edgeFunctions = { status: "down", latencyMs: Date.now() - efStart, error: String(e) };
  }

  // Determine overall status
  const statuses = Object.values(checks).map((c) => c.status);
  const overallStatus = statuses.every((s) => s === "up")
    ? "healthy"
    : statuses.some((s) => s === "down")
    ? "unhealthy"
    : "degraded";

  // Gather metrics
  let activePods = 0, pendingInvoices = 0, queueLength = 0;
  try {
    const [pods, invoices, queue] = await Promise.all([
      supabase.from("pods").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("unified_invoices").select("id", { count: "exact", head: true }).eq("payment_status", "pending"),
      supabase.from("patient_registry").select("id", { count: "exact", head: true }).eq("queue_status", "awaiting_consultation"),
    ]);
    activePods = pods.count ?? 0;
    pendingInvoices = invoices.count ?? 0;
    queueLength = queue.count ?? 0;
  } catch {
    // metrics optional
  }

  const response: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: VERSION,
    checks,
    metrics: {
      activePods,
      pendingInvoices,
      queueLength,
      uptimeSeconds: Math.floor((Date.now() - START_TIME) / 1000),
    },
  };

  const statusCode = overallStatus === "healthy" ? 200 : overallStatus === "degraded" ? 200 : 503;

  return new Response(JSON.stringify(response, null, 2), {
    status: statusCode,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});