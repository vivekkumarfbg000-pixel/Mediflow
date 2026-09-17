import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const CANONICAL_TEMPLATES = [
  {
    name: "payment_receipt_template",
    category: "UTILITY",
    allow_category_change: true,
    language: "en_US",
    components: [
      {
        type: "BODY",
        text: "Namaste {{1}}! Aapka payment of ₹{{2}} successful raha for Invoice. VitalSync healthcare app checkup slots configure ho rahe hain. We look forward to serving you! 🟢",
        example: {
          body_text: [["Aarav Sharma", "500"]]
        }
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
        text: "🟢 APPOINTMENT CONFIRMED: Namaste {{1}}! {{2}} ke saath aapka checkup confirm ho gaya hai. Token Number: {{3}}, Date: {{4}}, Time: {{5}} at {{6}}. Clinic pahuchein aur desk par token dikhayein! 🙏",
        example: {
          body_text: [["Aarav Sharma", "Dr. Pankaj Kumar", "#TK-01", "2026-09-18", "10:00 AM", "Life Line Clinic"]]
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
        text: "📄 PATHOLOGY REPORT READY: Namaste {{1}}! Aapka {{2}} test report verified aur taiyar hai. Doctor review ke liye clinic visit karein ya PDF download karein. 🔬",
        example: {
          body_text: [["Aarav Sharma", "HbA1c & Lipid Profile"]]
        }
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
        text: "Namaste {{1}} Ji! 🩺 Aapki {{2}} dawa agle 5 dino mein khatam hone wali hai. {{3}} Pharmacy ne aapka 1 Month Refill Pack (10% OFF) ready rakha hai: ₹{{4}}. 💊",
        example: {
          body_text: [["Aarav Sharma", "Thyronorm 50mcg", "Life Line Clinic", "450"]]
        }
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
        text: "🚨 EMERGENCY SOS PRIORITY #1 ACTIVATED! {{1}} ke liye Emergency Token {{2}} doctor chamber par alert ho gaya hai at {{3}}. Kripya turant emergency desk par pahuchein! 🩺",
        example: {
          body_text: [["Aarav Sharma", "#EM-01", "Life Line Clinic"]]
        }
      }
    ]
  }
];

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS" || req.method === "HEAD") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  const token = Deno.env.get("META_ACCESS_TOKEN") || Deno.env.get("OWNER_SYSTEM_TOKEN");
  const wabaId = Deno.env.get("META_WABA_ID") || Deno.env.get("OWNER_WABA_ID");

  if (!token || !wabaId) {
    return new Response(JSON.stringify({ error: "Missing META_ACCESS_TOKEN or META_WABA_ID in secrets" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const url = `https://graph.facebook.com/v21.0/${wabaId}/message_templates`;

  // GET: List existing templates from Meta WABA
  if (req.method === "GET") {
    try {
      const res = await fetch(`${url}?limit=100`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }

  // POST: Sync canonical Meta templates to WABA
  try {
    let requestedTemplates = CANONICAL_TEMPLATES;
    try {
      const body = await req.json();
      if (body && body.template_name) {
        const matched = CANONICAL_TEMPLATES.find(t => t.name === body.template_name);
        if (matched) requestedTemplates = [matched];
      }
    } catch (_e) {
      // Use full canonical set if empty body
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
      message: "Meta WhatsApp templates synchronized successfully",
      waba_id: wabaId,
      total_processed: requestedTemplates.length,
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
