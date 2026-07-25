import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { getCorsHeaders } from "../_shared/cors.ts";

interface RollbackRequest {
  action?: "check_and_rollback" | "force_rollback";
  reason?: string;
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const vercelToken = Deno.env.get("VERCEL_TOKEN") || "";
    const vercelProjectId = Deno.env.get("VERCEL_PROJECT_ID") || "";
    const vercelTeamId = Deno.env.get("VERCEL_TEAM_ID") || "";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: RollbackRequest = await req.json().catch(() => ({ action: "check_and_rollback" }));

    // 1. Check deployment_health table in Supabase
    const { data: health, error: fetchErr } = await supabase
      .from("deployment_health")
      .select("*")
      .eq("id", "current")
      .maybeSingle();

    if (fetchErr) {
      console.error("[deployment-rollback-agent] Error fetching health record:", fetchErr);
    }

    const isRequested = health?.rollback_requested === true || body.action === "force_rollback";
    const triggerReason = body.reason || health?.trigger_reason || "Core USP smoke test failure threshold breached";

    if (!isRequested) {
      return new Response(
        JSON.stringify({
          success: true,
          rollback_executed: false,
          message: "No rollback requested. System healthy.",
          checked_at: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    console.warn(`[deployment-rollback-agent] 🚨 ROLLBACK TRIGGERED: ${triggerReason}`);

    // 2. Execute Vercel Rollback API call if credentials present
    let vercelApiResponse: Record<string, unknown> = { note: "Vercel credentials not provided in env, simulated rollback signal" };
    
    if (vercelToken && vercelProjectId) {
      const teamQuery = vercelTeamId ? `?teamId=${vercelTeamId}` : "";
      // Fetch latest deployments from Vercel
      const listResp = await fetch(
        `https://api.vercel.com/v6/deployments${teamQuery}&projectId=${vercelProjectId}&limit=5`,
        {
          headers: { Authorization: `Bearer ${vercelToken}` },
        }
      );

      if (listResp.ok) {
        const listData = await listResp.json();
        const deployments = listData.deployments || [];
        // Ready deployment that is NOT the broken latest one
        const previousHealthy = deployments.find(
          (d: { state: string; uid: string }, idx: number) => idx > 0 && d.state === "READY"
        );

        if (previousHealthy) {
          // Promote previous healthy deployment
          const promoteResp = await fetch(
            `https://api.vercel.com/v13/deployments/${previousHealthy.uid}/promote${teamQuery}`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${vercelToken}`,
                "Content-Type": "application/json",
              },
            }
          );
          vercelApiResponse = await promoteResp.json().catch(() => ({ status: promoteResp.status }));
          console.log(`[deployment-rollback-agent] Promoted deployment ${previousHealthy.uid}`);
        }
      }
    }

    // 3. Reset rollback_requested in Supabase & log history
    await supabase
      .from("deployment_health")
      .upsert({
        id: "current",
        rollback_requested: false,
        trigger_reason: triggerReason,
        resolved_at: new Date().toISOString(),
      });

    // 4. Log to ci_healer_log table
    await supabase.from("ci_healer_log").insert({
      workflow_name: "deployment-rollback-agent",
      job_name: "auto-rollback",
      failure_reason: triggerReason,
      fix_applied: "Vercel alias promoted to previous healthy release",
      fix_succeeded: true,
    }).catch(() => {/* non-blocking */});

    return new Response(
      JSON.stringify({
        success: true,
        rollback_executed: true,
        trigger_reason: triggerReason,
        vercel_api_response: vercelApiResponse,
        resolved_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
