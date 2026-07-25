import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { getCorsHeaders } from "../_shared/cors.ts";

interface AuditPackageRequest {
  packages?: Record<string, string>;
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

    const body: AuditPackageRequest = await req.json().catch(() => ({}));
    const packagesToAudit = body.packages || {
      "axios": "^1.6.0",
      "react": "^18.2.0",
      "@supabase/supabase-js": "^2.39.0",
      "express": "^4.18.2",
    };

    const auditResults: Array<{ pkg: string; current_version: string; latest_version: string; status: string }> = [];

    // Query NPM registry for latest versions
    for (const [pkg, currentVer] of Object.entries(packagesToAudit)) {
      try {
        const npmResp = await fetch(`https://registry.npmjs.org/${pkg}/latest`, {
          headers: { Accept: "application/json" },
        });
        if (npmResp.ok) {
          const npmData = await npmResp.json();
          const latestVer = npmData.version || "unknown";
          const cleanCurrent = currentVer.replace(/[\^~>=]/g, "");
          const isOutdated = latestVer !== cleanCurrent;

          auditResults.push({
            pkg,
            current_version: currentVer,
            latest_version: latestVer,
            status: isOutdated ? "OUTDATED" : "UP_TO_DATE",
          });
        }
      } catch (_err) {
        auditResults.push({
          pkg,
          current_version: currentVer,
          latest_version: "error",
          status: "UNKNOWN",
        });
      }
    }

    const outdatedCount = auditResults.filter((r) => r.status === "OUTDATED").length;

    // Log to ci_healer_log table
    await supabase.from("ci_healer_log").insert({
      workflow_name: "npm-security-audit",
      job_name: "weekly-cve-scan",
      failure_reason: outdatedCount > 0 ? `${outdatedCount} dependencies outdated` : "None",
      fix_applied: "NPM Registry API audit completed",
      fix_succeeded: true,
    }).catch(() => {/* non-blocking */});

    return new Response(
      JSON.stringify({
        success: true,
        audited_at: new Date().toISOString(),
        total_audited: auditResults.length,
        outdated_count: outdatedCount,
        report: auditResults,
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
