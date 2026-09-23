import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { getCorsHeaders } from "../_shared/cors.ts";

// ═══════════════════════════════════════════════════════════════════════════════
// VITALSYNC CANONICAL WHATSAPP TEMPLATES — PERMANENT IMMUTABLE REGISTRY
// Standardized against Category-Defining Triad SOP & Meta Graph API v21.0
// ═══════════════════════════════════════════════════════════════════════════════

export const CANONICAL_TEMPLATES = [
  {
    name: "patient_onboarding_welcome",
    category: "UTILITY",
    allow_category_change: true,
    language: "en_US",
    components: [
      {
        type: "BODY",
        text: "Namaste {{1}}! 🙏 {{2}} mein aapka swagat hai!\n\nAapka registration safaltapoorvak complete ho gaya hai. VitalSync Smart Clinic ecosystem ke saath aapko milti hain ye premium suvidhayein:\n\n1️⃣ 1 Free Virtual Consult (15-20 dinon ke bheetar) 🆓\n2️⃣ 10% Discount on Medicine Refills 💊\n3️⃣ Daily WhatsApp Reminders & Health Updates 📱\n4️⃣ Instant Digital Lab Reports & Prescriptions 📄\n\nSwasth rahein, surakshit rahein! 🩺✨",
        example: {
          body_text: [["Aarav Sharma", "VitalSync Smart PolyClinic"]]
        }
      },
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "🏥 Book Visit" },
          { type: "QUICK_REPLY", text: "💊 1-Click Refill" },
          { type: "QUICK_REPLY", text: "🚨 Emergency SOS" }
        ]
      }
    ]
  },
  {
    name: "main_welcome_menu_template",
    category: "UTILITY",
    allow_category_change: true,
    language: "en_US",
    components: [
      {
        type: "BODY",
        text: "Namaste {{1}}! 🙏 Welcome to {{2}}.\n\n🌟 SERVICES 🌟\n1️⃣ Book Physical Clinic Visit 🏥\n2️⃣ Book Virtual Video Consult 💻 (1 Free Consult)\n3️⃣ View Lab Reports & Hinglish Summary 🔬\n4️⃣ Emergency SOS Priority #1 Routing 🚨\n5️⃣ 1-Click Medicine Refill (10% OFF) 💊\n6️⃣ Refer a Patient & Earn 10% OFF 🎁\n\nService select karne ke liye button tap kijiye! 🩺",
        example: {
          body_text: [["Aarav Sharma", "Life Line Clinic"]]
        }
      },
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "🏥 Book Physical Visit" },
          { type: "QUICK_REPLY", text: "💻 Book Virtual Video" },
          { type: "QUICK_REPLY", text: "🚨 Emergency SOS" }
        ]
      }
    ]
  },
  {
    name: "appointment_slot_locked_template",
    category: "UTILITY",
    allow_category_change: true,
    language: "en_US",
    components: [
      {
        type: "BODY",
        text: "📅 Checkup Slot Selected!\n\n{{1}} ke liye checkup slot {{2}} ({{3}}) at {{4}} lock kar diya gaya hai.\n\n• Doctor Consultation Fee: ₹{{5}}\n\nPayment complete hone ke baad please PAY reply kijiye ya I Have Paid button tap kijiye! Turant token {{6}} issue ho jayega 📑",
        example: {
          body_text: [["Dr. Pankaj Kumar", "10:30 AM", "2026-09-18", "Life Line Clinic", "500", "#TK-01"]]
        }
      },
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "I Have Paid ✅" },
          { type: "QUICK_REPLY", text: "Pay via Direct UPI 💳" }
        ]
      }
    ]
  },
  {
    name: "appointment_confirmed_template",
    category: "UTILITY",
    allow_category_change: true,
    language: "en_US",
    components: [
      {
        type: "BODY",
        text: "🟢 APPOINTMENT CONFIRMED: Hi {{1}}! {{2}} ke saath aapka checkup confirm ho gaya hai:\n\n• Token Number: {{3}} 🎫\n• Queue Status: {{4}} Patients ahead of you (~{{5}} mins wait)\n• Live Clinic Turn Alert: Turn aane se 2 patient pehle alert aayega!\n• Clinic Location: {{6}}, Desk #1\n\nDoctor EMR aur Compounder Desk par aapki entry live sync ho chuki hai. Thank you! 😊",
        example: {
          body_text: [["Aarav Sharma", "Dr. Pankaj Kumar", "#TK-01", "2", "20", "Life Line Clinic"]]
        }
      }
    ]
  },
  {
    name: "lab_report_ready_template",
    category: "UTILITY",
    allow_category_change: true,
    language: "en_US",
    components: [
      {
        type: "BODY",
        text: "📄 Aapki Pathology Report Taiyar Hai! 🔬\n\n• Patient: {{1}}\n• Test: {{2}}\n• Status: Verified & Approved 🟢\n• AI Clinical Summary: {{3}}\n\nDr. {{4}} se report review ke liye option chuniye:\n(Physical Review chune par prescribed dawaiyan clinic pharmacy par reserve ho jayengi).",
        example: {
          body_text: [["Aarav Sharma", "HbA1c & Lipid Profile", "Sugar and cholesterol normal range mein hain.", "Kumar"]]
        }
      },
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "🏥 Physical Review" },
          { type: "QUICK_REPLY", text: "💻 Virtual Video" }
        ]
      }
    ]
  },
  {
    name: "chronic_refill_reminder_template",
    category: "UTILITY",
    allow_category_change: true,
    language: "en_US",
    components: [
      {
        type: "BODY",
        text: "Namaste {{1}} Ji! 🩺\nAapki {{2}} dawa agle 5 dino mein khatam hone wali hai.\n\nBlood pressure/sugar control mein gap na aaye, isliye {{3}} Pharmacy ne aapka 1 Month Refill Pack (10% OFF) ready rakha hai:\n\n• MRP: ~₹{{4}}~\n• Your Price (10% VIP Discount): ₹{{5}}\n• Delivery: Free Clinic Counter Pickup ya 24hr Home Delivery 💊",
        example: {
          body_text: [["Aarav Sharma", "Telmisartan 40mg", "Life Line Clinic", "350", "315"]]
        }
      },
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "📦 Confirm 1-Click Refill" },
          { type: "QUICK_REPLY", text: "👨‍⚕️ Speak to Doctor" }
        ]
      }
    ]
  },
  {
    name: "emergency_sos_priority_template",
    category: "UTILITY",
    allow_category_change: true,
    language: "en_US",
    components: [
      {
        type: "BODY",
        text: "🚨 EMERGENCY SOS PRIORITY #1 ACTIVATED! 🚨\n\n{{1}} ke dashboard par aapka case PRIORITY #1 position par alert ho gaya hai (Red Pulsing Alert 🔴)!\n\n• Emergency Token: {{2}}\n• Doctor: {{1}}\n• Clinic Desk: {{3}}\n• Status: Chamber Alerted (Top Priority) 🔴\n• Emergency Surcharge: ₹{{4}}\n\nKripya turant clinic emergency desk par pahuchein aur token {{2}} show karein! 🩺",
        example: {
          body_text: [["Dr. Pankaj Kumar", "#EM-01", "Life Line Clinic", "618"]]
        }
      }
    ]
  },
  {
    name: "family_health_desk_template",
    category: "UTILITY",
    allow_category_change: true,
    language: "en_US",
    components: [
      {
        type: "BODY",
        text: "👥 FAMILY HEALTH DESK — {{1}} 🏥\n\nNamaste {{2}}! Apne parivaar ke kisi sadasya ke liye checkup book kijiye:\n\n{{3}}\n0️⃣ Naye Family Member ko Add Karein ➕\n\nCheckup book karne ke liye member number reply kijiye! 🩺",
        example: {
          body_text: [["Life Line Clinic", "Aarav Sharma", "1️⃣ Sunita Sharma (Mother)\n2️⃣ Ramesh Sharma (Father)"]]
        }
      },
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "➕ Add New Member" },
          { type: "QUICK_REPLY", text: "🏠 Main Menu" }
        ]
      }
    ]
  },
  {
    name: "prescription_summary_template",
    category: "UTILITY",
    allow_category_change: true,
    language: "en_US",
    components: [
      {
        type: "BODY",
        text: "📋 PRESCRIPTION & DOCTOR NOTES SUMMARY 🩺\n\n• Patient: {{1}}\n• Doctor: {{2}}\n• Clinic: {{3}}\n• Date: {{4}}\n\nDoctor's Clinical Notes:\n\"{{5}}\"\n\nFollow-up Advice:\n{{2}} ne aapko {{6}} din baad follow-up ke liye bulaya hai.",
        example: {
          body_text: [["Aarav Sharma", "Dr. Pankaj Kumar", "Life Line Clinic", "2026-09-18", "Rest and take prescribed medications.", "14"]]
        }
      },
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "💊 1-Click Refill" },
          { type: "QUICK_REPLY", text: "🏠 Main Menu" }
        ]
      }
    ]
  },
  {
    name: "ai_clinical_assistant_template",
    category: "UTILITY",
    allow_category_change: true,
    language: "en_US",
    components: [
      {
        type: "BODY",
        text: "🤖 VITALSYNC AI CLINICAL ASSISTANT 💡\n\nNamaste {{1}}! Main {{2}} ka verified AI Clinical Assistant hoon.\n\nAap apna health question ya lakshan yahan likh kar bhej sakte hain. Main doctor-approved ICMR clinical guidelines ke anusaar immediate guidance doonga.\n\n⚠️ Emergency Warning: Kisi bhi gambhir takleef mein turant SOS reply karein ya clinic visit karein!\n\nAapka sawal kya hai? Kripya type kijiye: ✍️",
        example: {
          body_text: [["Aarav Sharma", "Dr. Pankaj Kumar"]]
        }
      },
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "🚨 Emergency SOS" },
          { type: "QUICK_REPLY", text: "🏠 Main Menu" }
        ]
      }
    ]
  },
  {
    name: "digital_health_locker_template",
    category: "UTILITY",
    allow_category_change: true,
    language: "en_US",
    components: [
      {
        type: "BODY",
        text: "📁 DIGITAL HEALTH LOCKER — {{1}} 🔐\n\nNamaste {{2}}! Aapka ABHA/VitalSync Health Locker secure cloud par active hai:\n\n• Consultations on File: {{3}}\n• Pathology Lab Reports: {{4}}\n• Last Prescribed Visit: {{5}}\n• Latest Pathology Test: {{6}} ({{7}})\n\nPrescription dekhne ke liye SUMMARY reply karein, report ke liye REPORT reply karein.",
        example: {
          body_text: [["Life Line Clinic", "Aarav Sharma", "4", "2", "2026-09-18", "HbA1c", "2026-09-15"]]
        }
      },
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "📋 Latest Rx" },
          { type: "QUICK_REPLY", text: "🔬 Lab Report" },
          { type: "QUICK_REPLY", text: "🏠 Main Menu" }
        ]
      }
    ]
  },
  {
    name: "payment_receipt_template",
    category: "UTILITY",
    allow_category_change: true,
    language: "en_US",
    components: [
      {
        type: "BODY",
        text: "Namaste {{1}}! Aapka payment of ₹{{2}} successful raha for Invoice #{{3}}. VitalSync healthcare app checkup slots configure ho rahe hain. We look forward to serving you! 🟢",
        example: {
          body_text: [["Aarav Sharma", "500", "INV-2026-001"]]
        }
      },
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "📄 View Receipt" },
          { type: "QUICK_REPLY", text: "🏠 Main Menu" }
        ]
      }
    ]
  },
  {
    name: "patient_review_request_template",
    category: "UTILITY",
    allow_category_change: true,
    language: "en_US",
    components: [
      {
        type: "BODY",
        text: "Namaste {{1}}! 🙏 Aaj {{2}} par aapka experience kaisa raha?\n\nAapki feedback humein behtar care provide karne mein madad karti hai.",
        example: {
          body_text: [["Aarav Sharma", "Life Line Clinic"]]
        }
      },
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "🌟 Excellent (5/5)" },
          { type: "QUICK_REPLY", text: "👍 Good (4/5)" },
          { type: "QUICK_REPLY", text: "📝 Needs Improvement" }
        ]
      }
    ]
  }
];

// Initialize Supabase Client
function getSupabaseClient() {
  const url = Deno.env.get("SUPABASE_URL") || "https://kguupaybvbngyzyofjun.supabase.co";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return createClient(url, key);
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS" || req.method === "HEAD") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  const token = Deno.env.get("META_ACCESS_TOKEN") || Deno.env.get("OWNER_SYSTEM_TOKEN");
  const wabaId = Deno.env.get("META_WABA_ID") || Deno.env.get("OWNER_WABA_ID");

  // GET: List existing templates from Meta WABA and database
  if (req.method === "GET") {
    try {
      const supabase = getSupabaseClient();
      const { data: dbTemplates, error: dbErr } = await supabase
        .from("canonical_templates")
        .select("*")
        .order("created_at", { ascending: true });

      let metaTemplates: any[] = [];
      if (token && wabaId) {
        try {
          const res = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/message_templates?limit=100`, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          const data = await res.json();
          metaTemplates = data.data || [];
        } catch (_mErr) {
          console.warn("[create-template] Meta API fetch error:", _mErr);
        }
      }

      return new Response(JSON.stringify({
        database_templates: dbTemplates || [],
        database_count: dbTemplates?.length || 0,
        meta_registered_templates: metaTemplates,
        canonical_fallback_count: CANONICAL_TEMPLATES.length,
        immutability_governance: "LOCKED_ADMIN_ONLY"
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }

  // POST: Synchronize and Register Canonical Templates
  try {
    if (!token || !wabaId) {
      return new Response(JSON.stringify({
        error: "Missing META_ACCESS_TOKEN or META_WABA_ID in environment secrets",
        governance_status: "Canonical templates locked in database only"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const url = `https://graph.facebook.com/v21.0/${wabaId}/message_templates`;
    let requestedTemplates = CANONICAL_TEMPLATES;

    try {
      const body = await req.json();
      if (body && body.template_name) {
        const matched = CANONICAL_TEMPLATES.find(t => t.name === body.template_name);
        if (matched) requestedTemplates = [matched];
      }
      // Safety guard: Reject modification if template is locked
      if (body && body.action === "update" && body.is_locked !== false) {
        return new Response(JSON.stringify({
          error: "PERMISSION DENIED: Canonical templates are permanently locked under Admin Governance and cannot be modified."
        }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    } catch (_e) {
      // Empty body = full canonical sync
    }

    const syncResults: Record<string, any>[] = [];

    for (const tpl of requestedTemplates) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(tpl)
        });

        const data = await res.json();
        syncResults.push({
          template: tpl.name,
          status: res.status,
          success: res.ok || data?.error?.code === 100 || (data?.error?.message || '').includes('already exists'),
          response: data
        });
      } catch (postErr: any) {
        syncResults.push({
          template: tpl.name,
          status: 500,
          success: false,
          error: postErr.message
        });
      }
    }

    return new Response(JSON.stringify({
      message: "Canonical WhatsApp templates synchronized and registered successfully",
      waba_id: wabaId,
      total_processed: requestedTemplates.length,
      immutability: "LOCKED_ADMIN_GOVERNANCE",
      results: syncResults
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
