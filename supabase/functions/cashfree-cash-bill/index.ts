import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { z } from "https://deno.land/x/zod@v3.22.4/index.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { isRateLimited } from "../_shared/rate-limit.ts";

// =============================================================================
// Mediflow — cashfree-cash-bill Edge Function
// Records a cash sale billed through the Mediflow app by a compounder.
// Deducts platform commission (5% Lab, 2% Pharmacy) from the pod's commission pool.
// If pool balance < ₹200 threshold, defers the commission silently
// and notifies the clinic owner via activity log.
// =============================================================================

const POOL_LOW_THRESHOLD = 200; // ₹200 minimum before deferral

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

    // Rate limit: 30 requests/min per IP (compounder billing is frequent)
    if (await isRateLimited(req, supabase, 30, 60)) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bodyJson = await req.json().catch(() => ({}));

    // ── Input validation ────────────────────────────────────────────────────
    const validationResult = z.object({
      podId:      z.string().min(1, "podId is required"),
      entityId:   z.string().min(1, "entityId is required"),
      saleType:   z.enum(["pharmacy", "lab"], { errorMap: () => ({ message: 'saleType must be "pharmacy" or "lab"' }) }),
      grossAmount: z.number().positive("grossAmount must be a positive number"),
      items:      z.array(z.object({
        name:          z.string().min(1),
        quantity:      z.number().positive(),
        unit_price:    z.number().positive(),
        line_total:    z.number().positive(),
      })).min(1, "At least one item is required"),
      patientId:  z.string().min(1).optional(),
      notes:      z.string().max(500).optional(),
    }).safeParse(bodyJson);

    if (!validationResult.success) {
      const errorMsg = validationResult.error.issues
        .map(i => `${i.path.join(".")}: ${i.message}`)
        .join(", ");
      return new Response(JSON.stringify({ error: `Validation failed: ${errorMsg}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { podId, entityId, saleType, grossAmount, items, patientId, notes } = validationResult.data;

    // ── Resolve authenticated user (compounder) ──────────────────────────────
    const authHeader = req.headers.get("Authorization");
    let billedByUserId: string | null = null;
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      billedByUserId = user?.id ?? null;
    }

    // ── Verify pod is active + billing-enabled ───────────────────────────────
    const { data: pod, error: podErr } = await supabase
      .from("pods")
      .select("id, is_verified_for_billing, commission_pool_balance, pending_cash_balance")
      .eq("id", podId)
      .single();

    if (podErr || !pod) {
      return new Response(JSON.stringify({ error: "Pod not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pod.is_verified_for_billing) {
      return new Response(JSON.stringify({ error: "Pod is not verified for billing. Complete Cashfree onboarding first." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Pure SaaS Invariant: 0% Platform Commission (100% Direct Clinic Retention) ───
    const commissionRate = 0;
    const commissionAmount = 0.00;

    // ── Create cash_billing_session record ───────────────────────────────────
    const { data: session, error: sessionErr } = await supabase
      .from("cash_billing_sessions")
      .insert({
        pod_id:            podId,
        entity_id:         entityId,
        billed_by:         billedByUserId,
        patient_id:        patientId ?? null,
        sale_type:         saleType,
        gross_amount:      grossAmount,
        commission_rate:   0,
        commission_amount: 0,
        pool_status:       "direct_settled",
        items:             items,
        notes:             notes ?? null,
      })
      .select()
      .single();

    if (sessionErr || !session) {
      console.error("[cashfree-cash-bill] Failed to create billing session:", sessionErr);
      return new Response(JSON.stringify({ error: "Failed to record billing session" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const poolStatus = "direct_settled";
    const balanceAfter = pod.commission_pool_balance ?? 0;

    // ── Log to activity_logs ─────────────────────────────────────────────────
    await supabase.from("activity_logs").insert({
      pod_id:      podId,
      entity_id:   entityId,
      action_type: "CASH_BILLING_RECORDED",
      details: {
        session_id:        session.id,
        sale_type:         saleType,
        gross_amount:      grossAmount,
        commission_amount: 0,
        pool_status:       poolStatus,
        items_count:       items.length,
        note:              "100% direct hospital cash settlement - 0% platform fee"
      },
    });

    console.log(
      `[cashfree-cash-bill] ✅ Direct cash bill recorded — ` +
      `session_id=${session.id} sale_type=${saleType} ` +
      `gross=₹${grossAmount} (0% commission direct clinic retention)`
    );

    return new Response(JSON.stringify({
      success:           true,
      session_id:        session.id,
      gross_amount:      grossAmount,
      commission_amount: 0,
      commission_rate:   "0%",
      pool_status:       poolStatus,
      pool_balance:      balanceAfter,
      is_pool_low:       false,
      receipt: {
        items,
        subtotal:     grossAmount,
        platform_fee: 0,
        billed_at:    new Date().toISOString(),
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("[cashfree-cash-bill] Unhandled exception:", e);
    return new Response(JSON.stringify({ error: e.message ?? "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
