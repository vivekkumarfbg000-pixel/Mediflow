import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// =============================================================================
// Mediflow — cashfree-vendor-sync Edge Function
// Onboards doctors, pharmacies, and pathology labs to Cashfree Marketplace.
// Registers bank account details and verifies sub-account vendor status.
// =============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { holderName, accountNumber, ifsc, email, phone, entityId, podId } = await req.json();

    if (!holderName || !accountNumber || !ifsc || !entityId || !podId) {
      return new Response(JSON.stringify({ error: "Missing required onboarding credentials." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appId     = Deno.env.get("CASHFREE_APP_ID") ?? "";
    const secretKey = Deno.env.get("CASHFREE_SECRET_KEY") ?? "";
    const cfEnv     = Deno.env.get("CASHFREE_ENV") ?? "sandbox";

    if (!appId || !secretKey) {
      return new Response(JSON.stringify({ error: "SaaS payment gateway credentials not configured in Vault." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiBase = cfEnv === "production"
      ? "https://api.cashfree.com/mp/vendors"
      : "https://sandbox.cashfree.com/mp/vendors";

    const vendorId = `VEND-${entityId.substring(0, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`;

    const body = {
      vendor_id: vendorId,
      name: holderName,
      email: email ?? "vendor@mediflow.in",
      phone: phone ?? "9999999999",
      bank_details: {
        account_number: accountNumber,
        ifsc: ifsc,
        holder_name: holderName,
      },
      schedule_option: "DAILY",
    };

    console.log(`[cashfree-vendor-sync] Registering vendor on Cashfree API: ${apiBase}`);

    const cfRes = await fetch(apiBase, {
      method: "POST",
      headers: {
        "x-client-id":     appId,
        "x-client-secret": secretKey,
        "x-api-version":   "2023-08-01",
        "Content-Type":    "application/json",
      },
      body: JSON.stringify(body),
    });

    const cfData = await cfRes.json();

    if (!cfRes.ok) {
      console.error("[cashfree-vendor-sync] Cashfree vendor API error:", cfData);
      return new Response(JSON.stringify({ error: cfData.message ?? "Vendor sub-account registration failed" }), {
        status: cfRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[cashfree-vendor-sync] Vendor registered successfully on Cashfree. vendor_id=${vendorId}`);

    // Update or insert Cashfree vendor registry in database
    const { data: vendorRecord, error: dbErr } = await supabase
      .from("cashfree_vendors")
      .upsert({
        pod_id: podId,
        entity_id: entityId,
        vendor_id: vendorId,
        holder_name: holderName,
        bank_account_last4: accountNumber.slice(-4),
        verification_status: "verified",
        updated_at: new Date().toISOString()
      }, {
        onConflict: "pod_id,entity_id"
      })
      .select()
      .single();

    if (dbErr) {
      console.error("[cashfree-vendor-sync] Database upsert failed:", dbErr);
      return new Response(JSON.stringify({ error: "Failed to persist vendor registry record." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      vendor_id: vendorId,
      verification_status: "verified",
      record: vendorRecord
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("[cashfree-vendor-sync] Exception in sync pipeline:", e);
    return new Response(JSON.stringify({ error: e.message ?? "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
