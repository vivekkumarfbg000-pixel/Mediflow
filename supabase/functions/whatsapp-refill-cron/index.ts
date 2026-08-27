import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { getCorsHeaders } from "../_shared/cors.ts";

// =============================================================================
// Mediflow — whatsapp-refill-cron Edge Function
// AGENTS.md USP #5: 1-Click Pharmacy Delivery & Day-25 Refill Reminders
//
// Invoked daily at 6:00 AM IST (00:30 UTC) via pg_cron.
// Queries chronic_care_cohorts for patients where next_refill_date <= TODAY.
// Sends 1-Tap native WhatsApp reply button nudge per qualifying patient.
// Writes REFILL_NUDGE_SENT to chronic_adherence_logs for idempotency.
// =============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WABA_DECRYPTION_KEY = Deno.env.get("WABA_DECRYPTION_KEY") ?? "vitalsync_master_vault_key_2026";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function decryptWabaToken(supabase: any, phoneId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("decrypt_tenant_waba_connection", {
    p_phone_number_id: phoneId,
    p_secret_key: WABA_DECRYPTION_KEY,
  });
  if (error || !data || data.length === 0) {
    console.error(`[refill-cron] WABA decrypt failed for phoneId=${phoneId}:`, error?.message);
    return null;
  }
  return data[0]?.decrypted_token ?? null;
}

async function sendInteractiveButtonMessage(
  toPhone: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>,
  wabaAccessToken: string,
  wabaPhoneNumberId: string
): Promise<boolean> {
  const url = `https://graph.facebook.com/v21.0/${wabaPhoneNumberId}/messages`;
  const normalized = toPhone.replace(/\D/g, "").slice(-10);
  const e164 = `91${normalized}`;

  const buttonObjs = buttons.map((b) => ({
    type: "reply",
    reply: { id: b.id, title: b.title.substring(0, 20) },
  }));

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: e164,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: bodyText },
      action: { buttons: buttonObjs },
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${wabaAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[refill-cron] Meta API error for ${toPhone}:`, errBody);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[refill-cron] Fetch error for ${toPhone}:`, err);
    return false;
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // ── STEP 1: Get today's date in IST (UTC+5:30) ──────────────────────────
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const todayIST = istNow.toISOString().split("T")[0]; // YYYY-MM-DD
    console.log(`[refill-cron] Running Day-25 Refill Cron for IST date: ${todayIST}`);

    // ── STEP 2: Query patients due for refill today ──────────────────────────
    const { data: cohorts, error: cohortErr } = await supabase
      .from("chronic_care_cohorts")
      .select("id, patient_id, patient_name, patient_phone, pod_id, condition_name, medications, days_supply, next_refill_date, status")
      .lte("next_refill_date", todayIST)
      .in("status", ["active", "due_refill"])
      .not("patient_phone", "is", null);

    if (cohortErr) {
      console.error("[refill-cron] cohort query failed:", cohortErr.message);
      return new Response(JSON.stringify({ error: cohortErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!cohorts || cohorts.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0, message: "No refill-due patients today" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── STEP 3: Idempotency — skip patients already nudged today ─────────────
    const { data: alreadyNudged } = await supabase
      .from("chronic_adherence_logs")
      .select("patient_id")
      .eq("event_type", "REFILL_NUDGE_SENT")
      .gte("created_at", `${todayIST}T00:00:00Z`);

    const alreadyNudgedSet = new Set<string>((alreadyNudged ?? []).map((r: any) => r.patient_id));
    const eligible = cohorts.filter((c: any) => !alreadyNudgedSet.has(c.patient_id));

    if (eligible.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0, message: "All due patients already nudged today (idempotency)" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── STEP 4: Load WABA connection details per pod ──────────────────────────
    const podIds = [...new Set<string>(eligible.map((c: any) => c.pod_id))];
    const { data: wabaConns } = await supabase
      .from("waba_connections")
      .select("pod_id, phone_number_id, encrypted_token")
      .in("pod_id", podIds)
      .eq("status", "active");

    const wabaByPod = new Map<string, { phoneNumberId: string; accessToken: string }>();
    for (const conn of wabaConns ?? []) {
      const token = await decryptWabaToken(supabase, conn.phone_number_id);
      if (token) wabaByPod.set(conn.pod_id, { phoneNumberId: conn.phone_number_id, accessToken: token });
    }

    // ── STEP 5: Resolve clinic names ──────────────────────────────────────────
    const { data: pods } = await supabase.from("pods").select("id, name").in("id", podIds);
    const podNameMap = new Map<string, string>((pods ?? []).map((p: any) => [p.id, p.name]));

    // ── STEP 6: Send nudge to each eligible patient ───────────────────────────
    let sent = 0;
    let failed = 0;
    const results: Array<{ patientId: string; status: string }> = [];

    for (const cohort of eligible) {
      const waba = wabaByPod.get(cohort.pod_id);
      const clinicName = podNameMap.get(cohort.pod_id) ?? "Your Clinic";
      const meds = (cohort.medications ?? []) as Array<{ medicineName?: string; name?: string }>;
      const medList = meds.slice(0, 3).map((m, i) => `${i + 1}. ${m.medicineName ?? m.name ?? "Medicine"}`).join("\n");

      const bodyText =
        `⏰ *${clinicName} Chronic Care Refill Reminder* 💊\n\n` +
        `Namaste *${cohort.patient_name}*! Aapka ${cohort.condition_name} medicine supply ` +
        `${cohort.days_supply} din ka complete ho gaya hai.\n\n` +
        (medList ? `📋 *Aapki Dawaiyan:*\n${medList}\n\n` : "") +
        `✨ 1-Click Confirm kijiye aur *10% OFF* paiye!\n\nKripya niche select kijiye:`;

      const buttons = [
        { id: "REFILL_CONFIRM", title: "📦 1-Click Refill (10% OFF)" },
        { id: "SPEAK_DOCTOR", title: "👨‍⚕️ Speak to Doctor" },
      ];

      let dispatchOk = false;

      if (waba) {
        // USP #1: Outbound Meta Graph API FIRST
        dispatchOk = await sendInteractiveButtonMessage(
          cohort.patient_phone, bodyText, buttons, waba.accessToken, waba.phoneNumberId
        );
      }

      if (dispatchOk || !waba) {
        // Write adherence log regardless (idempotency anchor)
        await supabase.from("chronic_adherence_logs").insert({
          cohort_id: cohort.id,
          patient_id: cohort.patient_id,
          event_type: "REFILL_NUDGE_SENT",
          details: {
            sent_at: new Date().toISOString(),
            channel: waba ? "meta_whatsapp" : "simulator_only",
            condition: cohort.condition_name,
            med_count: meds.length,
          },
        });

        // Update cohort status to 'due_refill'
        await supabase
          .from("chronic_care_cohorts")
          .update({ status: "due_refill", updated_at: new Date().toISOString() })
          .eq("id", cohort.id);

        sent++;
        results.push({ patientId: cohort.patient_id, status: waba ? "sent_via_meta" : "logged_simulator" });
      } else {
        failed++;
        results.push({ patientId: cohort.patient_id, status: "failed_meta_api" });
      }

      // Respect Meta 15 msg/sec rate limit
      await sleep(67);
    }

    const summary = { ok: true, date: todayIST, total_due: cohorts.length, eligible: eligible.length, sent, failed, results };
    console.log("[refill-cron] Completed:", JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[refill-cron] Fatal error:", err?.message ?? err);
    return new Response(JSON.stringify({ error: err?.message ?? "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

