import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// System-wide environment variables loaded from Supabase Vault/Secrets
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const wabaSecretKey = Deno.env.get("WABA_DECRYPTION_KEY") ?? "mediflow_vault_key_2026";

// Initialize Supabase Client with service key to bypass RLS for administrative routing
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

serve(async (req) => {
  const url = new URL(req.url);

  // 1. Meta Webhook Hub Handshake Verification (GET request)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    // Retrieve global webhook verification token
    const systemVerifyToken = Deno.env.get("META_VERIFY_TOKEN") ?? "mediflow_handshake_secret";

    if (mode === "subscribe" && token === systemVerifyToken) {
      console.log("[Meta Webhook] GET Handshake Verification Succeeded!");
      return new Response(challenge, { status: 200 });
    }
    console.warn("[Meta Webhook] GET Handshake Verification Failed: Token Mismatch.");
    return new Response("Forbidden", { status: 403 });
  }

  // 2. Meta Message Event Ingestion (POST request)
  if (req.method === "POST") {
    try {
      const payload = await req.json();
      console.log("[Meta Webhook] Ingested message event payload:", JSON.stringify(payload));

      const entry = payload.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;

      if (!value || !value.messages) {
        // Meta requires HTTP 200 OK for status updates (sent, delivered, read) to avoid webhook retries
        return new Response("Payload received (No action required)", { status: 200 });
      }

      const message = value.messages[0];
      const patientPhone = message.from;
      const messageText = message.text?.body ?? "";
      const phoneId = value.metadata?.phone_number_id;

      if (!phoneId) {
        console.warn("[Meta Webhook] Missing phone_number_id inside payload metadata.");
        return new Response("Missing metadata", { status: 400 });
      }

      // 3. Resolve Tenant Pod Context & Decrypt API System User Token
      // Use our compiled database decryption function
      const { data: wabaConn, error: wabaErr } = await supabase
        .rpc("decrypt_tenant_waba_connection", {
          p_phone_number_id: phoneId,
          p_secret_key: wabaSecretKey
        });

      if (wabaErr || !wabaConn || wabaConn.length === 0) {
        console.error(`[Meta Webhook] Tenant not found or decryption failed for phoneId: ${phoneId}`, wabaErr);
        return new Response("Tenant connection lookup failure", { status: 200 }); // Return 200 to acknowledge Meta
      }

      const connection = wabaConn[0]; // { pod_id, entity_id, decrypted_token }
      const tenantToken = connection.decrypted_token;

      // 4. Retrieve or Initialize Active WhatsApp Session for patient
      let { data: session, error: sessErr } = await supabase
        .from("whatsapp_sessions")
        .select("*")
        .eq("patient_phone", patientPhone)
        .single();

      const currentTime = new Date().toISOString();

      if (sessErr || !session) {
        // Find patient in registry to link profile
        const { data: patient } = await supabase
          .from("patient_registry")
          .select("id")
          .eq("phone", patientPhone)
          .single();

        const newId = crypto.randomUUID();
        const { data: newSess, error: createSessErr } = await supabase
          .from("whatsapp_sessions")
          .insert({
            id: newId,
            patient_phone: patientPhone,
            patient_id: patient?.id ?? null,
            current_state: "AWAITING_WELCOME",
            last_interaction: currentTime,
            session_data: {
              chatHistory: [{ sender: "patient", text: messageText, timestamp: currentTime }],
              humanOverride: false,
              podId: connection.pod_id,
              entityId: connection.entity_id
            }
          })
          .select()
          .single();

        if (createSessErr) {
          console.error("[Meta Webhook] Failed to initialize patient session:", createSessErr);
          return new Response("Database write failure", { status: 500 });
        }
        session = newSess;
      } else {
        // Session exists. Update history log.
        const sessionData = session.session_data ?? {};
        const chatHistory = sessionData.chatHistory ?? [];
        chatHistory.push({ sender: "patient", text: messageText, timestamp: currentTime });

        const updatedData = {
          ...sessionData,
          chatHistory,
          podId: connection.pod_id,
          entityId: connection.entity_id
        };

        const { data: nextSess, error: updateSessErr } = await supabase
          .from("whatsapp_sessions")
          .update({
            session_data: updatedData,
            last_interaction: currentTime
          })
          .eq("id", session.id)
          .select()
          .single();

        if (updateSessErr) {
          console.error("[Meta Webhook] Failed to update chat history:", updateSessErr);
          return new Response("Database update failure", { status: 500 });
        }
        session = nextSess;
      }

      // 5. Route to AI chatbot pipeline OR notify Human Team Inbox
      const sessionData = session.session_data ?? {};
      const isHumanOverride = sessionData.humanOverride === true;

      // Log activity
      await supabase.from("activity_logs").insert({
        pod_id: connection.pod_id,
        action_type: "WHATSAPP_INCOMING_MESSAGE",
        details: {
          phone: patientPhone,
          message: messageText,
          humanOverride: isHumanOverride,
          currentState: session.current_state
        },
        session_id: session.id
      });

      if (isHumanOverride) {
        console.log(`[Meta Webhook] humanOverride is active for patient ${patientPhone}. Broadcasted event via Supabase Realtime.`);
        // Message is committed to db, Supabase Realtime notifies the Team Inbox UI automatically
        return new Response("Broadcasted to agent", { status: 200 });
      }

      // If AI is active, trigger automated conversational router flow
      // (This will call the live multi-LLM RAG diagnosis scribe engine and respond to Graph API)
      await triggerBotReplyPipeline({
        session,
        incomingText: messageText,
        decryptedToken: tenantToken,
        phoneId
      });

      return new Response("Success", { status: 200 });

    } catch (e: any) {
      console.error("[Meta Webhook] Critical failure processing payload:", e);
      return new Response("Server Error", { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});

// Mock helper pipeline that invokes multi-LLM capabilities and pushes response back via Meta Graph API
async function triggerBotReplyPipeline(ctx: {
  session: any;
  incomingText: string;
  decryptedToken: string;
  phoneId: string;
}) {
  const { session, incomingText, decryptedToken, phoneId } = ctx;
  const patientPhone = session.patient_phone;
  const state = session.current_state;

  let replyText = "";

  if (state === "AWAITING_WELCOME") {
    replyText = `Welcome to Mediflow Integrated Clinic Automated Support! 🩺\n\nTo allow Doctor and AI-RAG agents to securely analyze historical diagnostic indicators and process e-prescriptions, please reply with *1* to grant consent.`;
  } else if (state === "AWAITING_CONFIRMATION") {
    if (incomingText.trim() === "1") {
      replyText = `Consent granted! Thank you. Your medical data is securely partitioned. We have initialized active pre-consultation worksheets for the Doctor session. 🟢`;
    } else {
      replyText = `Please reply with *1* to verify consent and proceed with secure medical data synthesis.`;
    }
  } else {
    // Default fallback routing using conversational state
    replyText = `Thank you for your message. An administrative agent or AI CDSS scribe has received your update and will reconcile your profile shortly.`;
  }

  const currentTime = new Date().toISOString();

  // Update DB session state
  const sessionData = session.session_data ?? {};
  const chatHistory = sessionData.chatHistory ?? [];
  chatHistory.push({ sender: "bot", text: replyText, timestamp: currentTime });

  let nextState = state;
  if (state === "AWAITING_WELCOME" && incomingText.trim() === "1") {
    nextState = "AWAITING_CONFIRMATION";
  }

  await supabase
    .from("whatsapp_sessions")
    .update({
      current_state: nextState,
      session_data: { ...sessionData, chatHistory },
      last_interaction: currentTime
    })
    .eq("id", session.id);

  // Send Outbound Graph API message
  try {
    const metaUrl = `https://graph.facebook.com/v21.0/${phoneId}/messages`;
    const response = await fetch(metaUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${decryptedToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: patientPhone,
        type: "text",
        text: { body: replyText }
      })
    });

    const result = await response.json();
    console.log("[Meta Outbound] Dispatched reply success:", result);
  } catch (err) {
    console.error("[Meta Outbound] Failed to dispatch API message:", err);
  }
}
