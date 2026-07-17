import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { z } from "https://deno.land/x/zod@v3.22.4/index.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { isRateLimited } from "../_shared/rate-limit.ts";

// =============================================================================
// Mediflow — cashfree-cash-bill Edge Function
// Records a cash sale billed through the Mediflow app by a compounder.
// Deducts 3% platform commission from the pod's commission pool.
// If pool balance < ₹200 threshold, defers the commission silently
// and notifies the clinic owner via activity log.
// =============================================================================

const COMMISSION_RATE = 0.03; // 3% — fixed for pilot
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
      podId:      z.string().uuid("Invalid podId UUID"),
      entityId:   z.string().uuid("Invalid entityId UUID"),
      saleType:   z.enum(["pharmacy", "lab"], { errorMap: () => ({ message: 'saleType must be "pharmacy" or "lab"' }) }),
      grossAmount: z.number().positive("grossAmount must be a positive number"),
      items:      z.array(z.object({
        name:          z.string().min(1),
        quantity:      z.number().positive(),
        unit_price:    z.number().positive(),
        line_total:    z.number().positive(),
      })).min(1, "At least one item is required"),
      patientId:  z.string().uuid().optional(),
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

    // ── Calculate 3% commission ─────────────────────────────────────────────
    const commissionAmount = parseFloat((grossAmount * COMMISSION_RATE).toFixed(2));

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
        commission_rate:   COMMISSION_RATE,
        commission_amount: commissionAmount,
        pool_status:       "debited", // will be updated if deferred
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

    // ── Debit commission pool via atomic RPC ─────────────────────────────────
    const { data: poolResult, error: poolErr } = await supabase.rpc(
      "debit_commission_pool",
      {
        p_pod_id:       podId,
        p_amount:       commissionAmount,
        p_reason:       `Cash ${saleType} sale — ${items.length} item(s) — ₹${grossAmount}`,
        p_reference_id: session.id,
      }
    );

    if (poolErr) {
      console.error("[cashfree-cash-bill] Pool debit RPC failed:", poolErr);
      // Non-fatal: session is already recorded, commission is just not deducted
    }

    const poolStatus = poolResult?.status ?? "deferred";
    const balanceAfter = poolResult?.balance_after ?? pod.commission_pool_balance;

    // ── Update session pool_status if deferred ────────────────────────────────
    if (poolStatus === "deferred") {
      await supabase
        .from("cash_billing_sessions")
        .update({ pool_status: "deferred" })
        .eq("id", session.id);
    }

    // ── Log to activity_logs ─────────────────────────────────────────────────
    await supabase.from("activity_logs").insert({
      pod_id:      podId,
      entity_id:   entityId,
      action_type: "CASH_BILLING_COMMISSION",
      details: {
        session_id:        session.id,
        sale_type:         saleType,
        gross_amount:      grossAmount,
        commission_amount: commissionAmount,
        pool_status:       poolStatus,
        balance_after:     balanceAfter,
        items_count:       items.length,
      },
    });

    // ── Low pool warning: log for owner visibility ────────────────────────────
    if (balanceAfter < POOL_LOW_THRESHOLD) {
      await supabase.from("activity_logs").insert({
        pod_id:      podId,
        entity_id:   entityId,
        action_type: "COMMISSION_POOL_LOW",
        details: {
          balance:   balanceAfter,
          threshold: POOL_LOW_THRESHOLD,
          message:   "Commission pool is below ₹200. Cash commissions are being deferred until pool is replenished via online payments.",
        },
      });
    }

    console.log(
      `[cashfree-cash-bill] ✅ Cash bill recorded — ` +
      `session_id=${session.id} sale_type=${saleType} ` +
      `gross=₹${grossAmount} commission=₹${commissionAmount} pool_status=${poolStatus}`
    );

    return new Response(JSON.stringify({
      success:           true,
      session_id:        session.id,
      gross_amount:      grossAmount,
      commission_amount: commissionAmount,
      commission_rate:   "3%",
      pool_status:       poolStatus,
      pool_balance:      balanceAfter,
      is_pool_low:       balanceAfter < POOL_LOW_THRESHOLD,
      receipt: {
        items,
        subtotal:     grossAmount,
        platform_fee: commissionAmount,
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
