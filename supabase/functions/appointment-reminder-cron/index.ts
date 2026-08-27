import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getIstDateString } from "../_shared/istDate.ts";

// =============================================================================
// Mediflow — appointment-reminder-cron Edge Function
// AGENTS.md USPs #1, #4, #5 & Rule 29: Automated appointment greetings,
// daily dosage reminders, evening lab report 2-Touchpoint dispatch.
//
// Pass = 'morning' (8:00 AM IST, 02:30 UTC):
//   - Morning appointment greetings + token confirmation
//   - Daily dosage reminder for all active chronic patients
//
// Pass = 'evening' (4:00 PM IST, 10:30 UTC):
//   - Lab report 2-Touchpoint review nudge (approved reports not yet dispatched)
//   - Virtual video consult meeting link for 4-6 PM virtual slots
//
// Idempotency: `morning_greeting_dispatched` and `whatsapp_dispatched` columns
//              prevent duplicate sends on re-invocations.
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
    console.error(`[appt-cron] WABA decrypt error for ${phoneId}:`, error?.message);
    return null;
  }
  return data[0]?.decrypted_token ?? null;
}

async function sendTextMessage(
  toPhone: string,
  body: string,
  wabaToken: string,
  wabaPhoneId: string
): Promise<boolean> {
  const e164 = `91${toPhone.replace(/\D/g, "").slice(-10)}`;
  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/${wabaPhoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${wabaToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: e164,
        type: "text",
        text: { body, preview_url: false },
      }),
    });
    if (!res.ok) { console.error(`[appt-cron] Meta error for ${toPhone}:`, await res.text()); return false; }
    return true;
  } catch (e) { console.error(`[appt-cron] fetch error for ${toPhone}:`, e); return false; }
}

async function sendInteractiveButtons(
  toPhone: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>,
  wabaToken: string,
  wabaPhoneId: string
): Promise<boolean> {
  const e164 = `91${toPhone.replace(/\D/g, "").slice(-10)}`;
  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/${wabaPhoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${wabaToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: e164,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: bodyText },
          action: {
            buttons: buttons.map((b) => ({
              type: "reply",
              reply: { id: b.id, title: b.title.substring(0, 20) },
            })),
          },
        },
      }),
    });
    if (!res.ok) { console.error(`[appt-cron] Interactive btn error for ${toPhone}:`, await res.text()); return false; }
    return true;
  } catch (e) { console.error(`[appt-cron] fetch error for ${toPhone}:`, e); return false; }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const url = new URL(req.url);
  const pass = url.searchParams.get("pass") ?? "morning";

  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  const todayIST = istNow.toISOString().split("T")[0];

  console.log(`[appt-cron] Running pass=${pass} for IST date: ${todayIST}`);

  const results: Record<string, number> = { sent: 0, failed: 0, skipped: 0 };

  try {
    if (pass === "morning") {
      // ── MORNING PASS: Appointment Greetings + Daily Dosage Reminders ──────

      // 1. Query all confirmed appointments for today (not yet greeted)
      const { data: appointments } = await supabase
        .from("appointments")
        .select("id, patient_id, patient_name, patient_phone, token_number, status, source, pod_id, is_emergency")
        .gte("appointment_time", `${todayIST}T00:00:00Z`)
        .lt("appointment_time", `${todayIST}T23:59:59Z`)
        .in("status", ["confirmed", "scheduled"])
        .eq("morning_greeting_dispatched", false);

      const appts = (appointments ?? []).filter(
        (a: any) => a.status !== "pending_payment" && a.status !== "cancelled"
      );

      // Load WABA per pod
      const apptPodIds = [...new Set<string>(appts.map((a: any) => a.pod_id).filter(Boolean))];
      const { data: apptWabaConns } = await supabase
        .from("waba_connections").select("pod_id, phone_number_id").in("pod_id", apptPodIds).eq("status", "active");
      const apptWabaMap = new Map<string, { phoneNumberId: string; token: string }>();
      for (const conn of apptWabaConns ?? []) {
        const token = await decryptWabaToken(supabase, conn.phone_number_id);
        if (token) apptWabaMap.set(conn.pod_id, { phoneNumberId: conn.phone_number_id, token });
      }

      // Load clinic names
      const { data: apptPods } = await supabase.from("pods").select("id, name, doctor_name").in("id", apptPodIds);
      const apptPodMap = new Map<string, { name: string; doctorName: string }>(
        (apptPods ?? []).map((p: any) => [p.id, { name: p.name ?? "Clinic", doctorName: p.doctor_name ?? "Doctor" }])
      );

      // Send morning greeting to each appointment
      for (const appt of appts) {
        if (!(appt.patient_phone || "").replace(/\D/g, "").length) {
          results.skipped++;
          continue;
        }
        const waba = apptWabaMap.get(appt.pod_id);
        const pod = apptPodMap.get(appt.pod_id) ?? { name: "Clinic", doctorName: "Doctor" };
        const tokenNum = appt.token_number ?? "#TK-001";
        const isEmergency = Boolean(appt.is_emergency);

        let msg = isEmergency
          ? `🚨 *EMERGENCY SOS APPOINTMENT CONFIRMED!* 🚨\n\nNamaste *${appt.patient_name}*! Aapka Emergency slot Priority #1 par register ho gaya hai.\n\n`
          : `🎫 *${pod.name} Checkup Booking Confirmed!* 🟢\n\nNamaste *${appt.patient_name}*! Aapka appointment aaj ke liye confirmed hai.\n\n`;

        msg += `📋 *Appointment Details:*\n`;
        msg += `• *Token Number:* ${tokenNum}\n`;
        msg += `• *Doctor:* Dr. ${pod.doctorName}\n`;
        msg += `• *Clinic:* ${pod.name}\n`;
        msg += `• *Mode:* Physical OPD Visit 🏥\n\n`;
        msg += `🩺 Kripya clinic counter par ye token show kijiye. Vitals (BP, Pulse, SpO2) check hoga. Stay healthy! 🟢`;

        if (waba) {
          const ok = await sendTextMessage(appt.patient_phone, msg, waba.token, waba.phoneNumberId);
          if (ok) {
            results.sent++;
            // Mark as dispatched (idempotency)
            await supabase.from("appointments").update({ morning_greeting_dispatched: true }).eq("id", appt.id);
          } else {
            results.failed++;
          }
        } else {
          results.skipped++;
        }
        await sleep(67);
      }

      // 2. Daily dosage reminders for all active chronic patients
      const { data: cohorts } = await supabase
        .from("chronic_care_cohorts")
        .select("patient_id, patient_name, patient_phone, pod_id, condition_name, medications")
        .eq("status", "active")
        .not("patient_phone", "is", null);

      for (const cohort of cohorts ?? []) {
        if (!(cohort.patient_phone || "").replace(/\D/g, "").length) continue;
        const waba = apptWabaMap.get(cohort.pod_id);
        const pod = apptPodMap.get(cohort.pod_id) ?? { name: "Clinic", doctorName: "Doctor" };
        const meds = (cohort.medications ?? []) as Array<{ medicineName?: string; name?: string; dosage?: string }>;
        const morningMeds = meds.filter((_m, i) => i < 5); // top 5 meds for morning reminder

        if (morningMeds.length === 0) continue;

        const medLines = morningMeds.map((m, i) => `${i + 1}. *${m.medicineName ?? m.name ?? "Medicine"}*${m.dosage ? ` — ${m.dosage}` : ""}`).join("\n");
        const msg =
          `⏰ *${pod.name} Morning Dose Reminder* 💊\n\n` +
          `Namaste *${cohort.patient_name}*! Subah ka dawa lene ka samay ho gaya hai.\n\n` +
          `📋 *Aaj ki dawaiyan (Subah):*\n${medLines}\n\n` +
          `💧 Kripya taaza paani ke sath dawa lein. Swasth rahein! 🟢`;

        if (waba) {
          const ok = await sendTextMessage(cohort.patient_phone, msg, waba.token, waba.phoneNumberId);
          if (ok) results.sent++; else results.failed++;
        } else {
          results.skipped++;
        }
        await sleep(67);
      }

    } else if (pass === "evening") {
      // ── EVENING PASS: Lab Report 2-Touchpoint + Virtual Meeting Links ────

      // 1. Query approved lab reports not yet dispatched
      const { data: labReports } = await supabase
        .from("lab_reports")
        .select("id, patient_id, patient_name, patient_phone, test_name, loinc_code, report_pdf_url, pod_id")
        .eq("status", "approved")
        .eq("whatsapp_dispatched", false)
        .gte("approved_at", `${todayIST}T00:00:00Z`);

      // Load WABA per pod for evening
      const labPodIds = [...new Set<string>((labReports ?? []).map((r: any) => r.pod_id).filter(Boolean))];
      const { data: labWabaConns } = await supabase
        .from("waba_connections").select("pod_id, phone_number_id").in("pod_id", labPodIds).eq("status", "active");
      const labWabaMap = new Map<string, { phoneNumberId: string; token: string }>();
      for (const conn of labWabaConns ?? []) {
        const token = await decryptWabaToken(supabase, conn.phone_number_id);
        if (token) labWabaMap.set(conn.pod_id, { phoneNumberId: conn.phone_number_id, token });
      }

      // Load pod details for evening
      const { data: labPods } = await supabase.from("pods").select("id, name, doctor_name").in("id", labPodIds);
      const labPodMap = new Map<string, { name: string; doctorName: string }>(
        (labPods ?? []).map((p: any) => [p.id, { name: p.name ?? "Clinic", doctorName: p.doctor_name ?? "Doctor" }])
      );

      // Send 2-Touchpoint lab report review nudge
      for (const report of labReports ?? []) {
        if (!(report.patient_phone || "").replace(/\D/g, "").length) { results.skipped++; continue; }
        const waba = labWabaMap.get(report.pod_id);
        const pod = labPodMap.get(report.pod_id) ?? { name: "Clinic", doctorName: "Doctor" };

        const bodyText =
          `🔬 *${pod.name} Lab Report Ready!* 📋\n\n` +
          `Namaste *${report.patient_name}*! Aapka *${report.test_name}* report verify ho gaya hai.\n\n` +
          (report.report_pdf_url ? `📥 *PDF Report:* ${report.report_pdf_url}\n\n` : "") +
          `Dr. ${pod.doctorName} ke saath review ke liye ek option choose kijiye:`;

        const buttons = [
          { id: "CLINIC_REVIEW", title: "🏥 Physical Review" },
          { id: "VIRTUAL_REVIEW", title: "💻 Virtual Video Call" },
        ];

        if (waba) {
          const ok = await sendInteractiveButtons(report.patient_phone, bodyText, buttons, waba.token, waba.phoneNumberId);
          if (ok) {
            results.sent++;
            await supabase.from("lab_reports").update({ whatsapp_dispatched: true }).eq("id", report.id);
          } else {
            results.failed++;
          }
        } else {
          results.skipped++;
        }
        await sleep(67);
      }

      // 2. Virtual video consult links for 4-6 PM virtual appointments
      const { data: virtualAppts } = await supabase
        .from("appointments")
        .select("id, patient_id, patient_name, patient_phone, token_number, pod_id, virtual_meeting_url")
        .gte("appointment_time", `${todayIST}T10:00:00Z`) // 3:30 PM IST = 10:00 UTC
        .lt("appointment_time", `${todayIST}T12:30:00Z`) // 6:00 PM IST = 12:30 UTC
        .eq("source", "whatsapp_virtual")
        .eq("status", "confirmed")
        .not("virtual_meeting_url", "is", null);

      const vPodIds = [...new Set<string>((virtualAppts ?? []).map((a: any) => a.pod_id).filter(Boolean))];
      const { data: vWabaConns } = await supabase
        .from("waba_connections").select("pod_id, phone_number_id").in("pod_id", vPodIds).eq("status", "active");
      const vWabaMap = new Map<string, { phoneNumberId: string; token: string }>();
      for (const conn of vWabaConns ?? []) {
        const token = await decryptWabaToken(supabase, conn.phone_number_id);
        if (token) vWabaMap.set(conn.pod_id, { phoneNumberId: conn.phone_number_id, token });
      }

      for (const appt of virtualAppts ?? []) {
        if (!(appt.patient_phone || "").replace(/\D/g, "").length) continue;
        const waba = vWabaMap.get(appt.pod_id);
        if (!waba || !appt.virtual_meeting_url) { results.skipped++; continue; }

        const msg =
          `💻 *Virtual Video Consult Ready!* 🟢\n\n` +
          `Namaste *${appt.patient_name}*! Aapka video consult link active ho gaya hai:\n\n` +
          `🔗 *1-Click Join:* ${appt.virtual_meeting_url}\n\n` +
          `📱 Link par click karein, camera allow karein, aur doctor se baat karein. Kisi app ki zaroorat nahi!`;

        const ok = await sendTextMessage(appt.patient_phone, msg, waba.token, waba.phoneNumberId);
        if (ok) results.sent++; else results.failed++;
        await sleep(67);
      }
    }

    console.log(`[appt-cron] pass=${pass} complete:`, JSON.stringify(results));
    return new Response(JSON.stringify({ ok: true, pass, date: todayIST, ...results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error(`[appt-cron] Fatal error (pass=${pass}):`, err?.message ?? err);
    return new Response(JSON.stringify({ error: err?.message ?? "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

