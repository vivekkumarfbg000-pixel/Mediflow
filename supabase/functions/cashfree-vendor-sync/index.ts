import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { z } from "https://deno.land/x/zod@v3.22.4/index.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { isRateLimited } from "../_shared/rate-limit.ts";

// =============================================================================
// Mediflow — cashfree-vendor-sync Edge Function
// Onboards doctors, pharmacies, and pathology labs to Cashfree Marketplace.
// Registers bank account details and verifies sub-account vendor status.
// =============================================================================

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Rate Limiter Check (10 requests/min per client IP for vendor onboarding)
    if (await isRateLimited(req, supabase, 10, 60)) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bodyJson = await req.json().catch(() => ({}));
    const validationResult = z.object({
      holderName: z.string().min(2, "Holder name must be at least 2 characters"),
      accountNumber: z.string().min(9, "Account number must be at least 9 digits").max(18, "Account number cannot exceed 18 digits"),
      ifsc: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid Indian Financial System Code (IFSC) format"),
      email: z.string().email("Invalid email address format").optional(),
      phone: z.string().regex(/^[0-9]{10}$/, "Phone number must be exactly 10 digits").optional(),
      entityId: z.string().uuid("Invalid entityId UUID format"),
      podId: z.string().uuid("Invalid podId UUID format"),
    }).safeParse(bodyJson);

    if (!validationResult.success) {
      const errorMsg = validationResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(", ");
      return new Response(JSON.stringify({ error: `Validation failed: ${errorMsg}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { holderName, accountNumber, ifsc, email, phone, entityId, podId } = validationResult.data;

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
      email: email ?? "vendor@vitalsync.in",
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
