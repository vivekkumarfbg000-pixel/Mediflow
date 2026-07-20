import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const token = Deno.env.get("META_ACCESS_TOKEN") || Deno.env.get("OWNER_SYSTEM_TOKEN");
  const wabaId = Deno.env.get("META_WABA_ID") || Deno.env.get("OWNER_WABA_ID");

  if (!token || !wabaId) {
    return new Response(JSON.stringify({ error: "Missing META_ACCESS_TOKEN or META_WABA_ID in secrets" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const url = `https://graph.facebook.com/v21.0/${wabaId}/message_templates`;
  const payload = {
    name: "payment_receipt_template",
    category: "UTILITY",
    allow_category_change: true,
    language: "en_US",
    components: [
      {
        type: "BODY",
        text: "Namaste {{1}}! Aapka payment of ₹{{2}} successful raha for Invoice. VitalSync healthcare app checkup slots configure ho rahe hain. We look forward to serving you! 🟢",
        example: {
          body_text: [
            [
              "Aarav Sharma",
              "500"
            ]
          ]
        }
      }
    ]
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
