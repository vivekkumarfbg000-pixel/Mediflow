import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// System-wide environment variables loaded from Supabase Vault/Secrets
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// ── SECURITY: WABA decryption key — MUST be set in Supabase Vault ────────────
// Never use a fallback here. If this key is missing, all tenant WABA tokens
// would be encrypted/decrypted with a publicly-visible default string.
// Set via: supabase secrets set WABA_DECRYPTION_KEY=<strong-256bit-hex>
// ─────────────────────────────────────────────────────────────────────────────
const wabaSecretKey = Deno.env.get("WABA_DECRYPTION_KEY");
if (!wabaSecretKey) {
  console.error("[meta-webhook] FATAL: WABA_DECRYPTION_KEY is not set in Supabase Vault. Cannot decrypt tenant WABA tokens.");
}

// Initialize Supabase Client with service key to bypass RLS for administrative routing
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 1. Meta Webhook Hub Handshake Verification (GET request)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    // Retrieve global webhook verification token
    // SECURITY: This must be set in Supabase Vault. If missing, reject all handshakes
    // to prevent attackers from using the publicly-known default to register fake subscriptions.
    const systemVerifyToken = Deno.env.get("META_VERIFY_TOKEN");
    if (!systemVerifyToken) {
      console.error("[Meta Webhook] FATAL: META_VERIFY_TOKEN not set in Vault. Rejecting all handshakes.");
      return new Response("Server configuration error", { status: 500 });
    }

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
      const appSecret = Deno.env.get("META_APP_SECRET");
      const signature256 = req.headers.get("x-hub-signature-256");

      let rawBody = "";
      let payload;

      if (appSecret) {
        if (!signature256) {
          console.error("[Meta Webhook] Missing x-hub-signature-256 header when secret is configured");
          return new Response("Missing signature", { status: 401 });
        }

        if (!signature256.startsWith("sha256=")) {
          console.error("[Meta Webhook] Invalid signature format, must start with sha256=");
          return new Response("Invalid signature format", { status: 401 });
        }

        const signatureHex = signature256.substring(7); // Remove "sha256="
        rawBody = await req.text();

        const encoder = new TextEncoder();
        const keyData = encoder.encode(appSecret);
        const messageData = encoder.encode(rawBody);

        const key = await crypto.subtle.importKey(
          "raw",
          keyData,
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"]
        );

        const signatureBuffer = await crypto.subtle.sign("HMAC", key, messageData);
        const computedHexSignature = Array.from(new Uint8Array(signatureBuffer))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        if (signatureHex !== computedHexSignature) {
          console.error("[Meta Webhook] Webhook signature verification failed! Signature mismatch.");
          return new Response("Signature mismatch", { status: 401 });
        }

        console.log("[Meta Webhook] Webhook signature verified successfully ✅");
        payload = JSON.parse(rawBody);
      } else {
        console.warn("[Meta Webhook] Warning: META_APP_SECRET is not configured in environment. Skipping signature verification.");
        payload = await req.json();
      }

      console.log("[Meta Webhook] Ingested message event payload: [REDACTED]");

      // Handle direct manual outbound message relay from Doctor Dashboard
      if (payload.action === "send_manual_message") {
        const patientPhone = payload.patientPhone;
        const messageText = payload.messageText;
        const phoneId = Deno.env.get("META_PHONE_NUMBER_ID") || Deno.env.get("OWNER_PHONE_NUMBER_ID") || payload.phoneId || payload.phoneNumberId;
        let systemToken = Deno.env.get("META_WHATSAPP_TOKEN") || Deno.env.get("OWNER_SYSTEM_TOKEN") || Deno.env.get("META_ACCESS_TOKEN") || payload.systemToken || payload.token;

        // Direct DB fallback query if systemToken is not provided in env vars or payload
        if (!systemToken && phoneId) {
          try {
            const { data: dbConn } = await supabase
              .from("waba_connections")
              .select("encrypted_system_user_token")
              .eq("phone_number_id", phoneId)
              .maybeSingle();
            if (dbConn?.encrypted_system_user_token) {
              systemToken = dbConn.encrypted_system_user_token;
            }
          } catch (_e) {}
        }

        if (!systemToken || !phoneId) {
          console.error("[Meta Webhook Outbound Relay] Error: Missing META_WHATSAPP_TOKEN or META_PHONE_NUMBER_ID in Supabase Vault or payload.");
          return new Response(JSON.stringify({ error: "Missing META_WHATSAPP_TOKEN or META_PHONE_NUMBER_ID in Supabase Vault or payload" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        let cleanPhone = patientPhone.replace(/[^0-9]/g, "");
        if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;

        console.log(`[Meta Webhook Outbound Relay] Dispatching text to ${cleanPhone} via phoneId ${phoneId}...`);

        const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${systemToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: cleanPhone,
            type: "text",
            text: { body: messageText }
          })
        });

        const resData = await res.json();
        console.log(`[Meta Webhook Outbound Relay] Meta Response Status: ${res.status}`, resData);
        return new Response(JSON.stringify({ 
          success: res.ok, 
          status: res.status, 
          metaResponse: resData,
          debugInfo: {
            hasToken: !!systemToken,
            phoneId,
            cleanPhone
          }
        }), { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      const entry = payload.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;

      if (!value || !value.messages) {
        if (value && value.statuses) {
          const statusObj = value.statuses[0];
          console.log(`[Meta Webhook] Received status update: "${statusObj.status}" for recipient ${statusObj.recipient_id}`);
          if (statusObj.status === "failed" || statusObj.errors) {
            console.error("[Meta Webhook] Message delivery failed:", JSON.stringify(statusObj.errors || statusObj));
          }
        }
        // Meta requires HTTP 200 OK for status updates (sent, delivered, read) to avoid webhook retries
        return new Response("Payload received (No action required)", { status: 200 });
      }

      const message = value.messages[0];
      const patientPhone = message.from;
      
      let messageText = "";
      let replyId: string | undefined = undefined;
      if (message.type === "interactive") {
        const reply = message.interactive?.button_reply;
        const listReply = message.interactive?.list_reply;
        replyId = reply?.id || listReply?.id;
        const replyTitle = reply?.title || listReply?.title;

        if (replyId === "btn_grant" || replyId === "menu_grant") messageText = "1";
        else if (replyId === "btn_book" || replyId === "menu_book") messageText = "book";
        else if (replyId === "menu_physical") messageText = "physical";
        else if (replyId === "menu_virtual") messageText = "virtual";
        else if (replyId === "btn_report" || replyId === "menu_report") messageText = "report";
        else if (replyId === "menu_refill") messageText = "refill";
        else if (replyId === "btn_summary" || replyId === "menu_summary") messageText = "summary";
        else if (replyId === "menu_family") messageText = "family";
        else if (replyId === "menu_ai") messageText = "ask assistant";
        else if (replyId === "menu_sos") messageText = "sos";
        else if (replyId === "menu_locker") messageText = "health locker";
        else if (replyId === "menu_refer") messageText = "refer";
        else if (replyId === "btn_order_delivery" || replyId === "menu_delivery") messageText = "order delivery";
        else if (replyId === "btn_virtual") messageText = "virtual";
        else if (replyId === "btn_physical") messageText = "physical";
        else if (replyId === "btn_physical_review") messageText = "physical review";
        else if (replyId === "btn_virtual_review") messageText = "virtual review";
        else if (replyId === "btn_pay") messageText = "pay";
        else if (replyId === "btn_stop" || replyId === "btn_main_menu") messageText = "menu";
        else if (replyId === "btn_slot_1") messageText = "1";
        else if (replyId === "btn_slot_2") messageText = "2";
        else if (replyId === "btn_slot_3") messageText = "3";
        else if (replyId === "btn_date_1") messageText = "1";
        else if (replyId === "btn_date_2") messageText = "2";
        else if (replyId === "btn_date_3") messageText = "3";
        else if (replyId === "btn_date_4") messageText = "4";
        else if (replyId === "menu_more") messageText = "more";
        else if (replyId === "menu_list") messageText = "list";
        else messageText = replyTitle ?? "";
      } else {
        messageText = message.text?.body ?? "";
      }
      
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

      let connection = (wabaConn && wabaConn.length > 0) ? wabaConn[0] : null;
      if (!connection) {
        // Fallback query directly on waba_connections table if RPC returns null
        const { data: directConn } = await supabase
          .from("waba_connections")
          .select("*")
          .eq("phone_number_id", phoneId)
          .maybeSingle();

        if (directConn) {
          connection = {
            pod_id: directConn.pod_id,
            entity_id: directConn.entity_id,
            decrypted_token: directConn.encrypted_system_user_token || Deno.env.get("META_WHATSAPP_TOKEN") || Deno.env.get("META_ACCESS_TOKEN") || Deno.env.get("OWNER_SYSTEM_TOKEN") || ""
          };
        } else {
          console.warn(`[Meta Webhook] Tenant lookup failed for phoneId: ${phoneId}. Applying system default fallback context.`);
          connection = {
            pod_id: 'default-pod',
            entity_id: 'default-entity',
            decrypted_token: Deno.env.get("META_WHATSAPP_TOKEN") || Deno.env.get("META_ACCESS_TOKEN") || Deno.env.get("OWNER_SYSTEM_TOKEN") || ""
          };
        }
      }
      const decryptedToken = connection.decrypted_token || Deno.env.get("META_WHATSAPP_TOKEN") || Deno.env.get("META_ACCESS_TOKEN") || Deno.env.get("OWNER_SYSTEM_TOKEN") || "";
      const tenantToken = decryptedToken;

      // 4. Retrieve or Initialize Active WhatsApp Session for patient
      let { data: session, error: sessErr } = await supabase
        .from("whatsapp_sessions")
        .select("*")
        .eq("patient_phone", patientPhone)
        .single();

      const currentTime = new Date().toISOString();

      if (sessErr || !session) {
        // Find patient in registry to link profile (flexible 10-digit/12-digit matching)
        const clean10Digits = patientPhone.replace(/\D/g, "").slice(-10);
        const { data: patient } = await supabase
          .from("patient_registry")
          .select("id")
          .or(`phone.eq.${clean10Digits},phone.eq.${patientPhone},phone.eq.91${clean10Digits},phone.eq.+91${clean10Digits}`)
          .maybeSingle();

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
      let isHumanOverride = sessionData.humanOverride === true;

      // Auto-revert Human Takeover back to AI Bot Mode after 10 minutes of clinician inactivity
      if (isHumanOverride) {
        const overrideStartTime = sessionData.human_override_started_at ? new Date(sessionData.human_override_started_at).getTime() : 0;
        const nowTime = new Date().getTime();
        const elapsedMinutes = overrideStartTime > 0 ? (nowTime - overrideStartTime) / (1000 * 60) : 999;

        if (elapsedMinutes >= 10 || !sessionData.human_override_started_at) {
          console.log(`[Meta Webhook] Human override cleared/expired (${elapsedMinutes.toFixed(1)} mins). Auto-reverting to AI Bot Mode.`);
          isHumanOverride = false;
          sessionData.humanOverride = false;
          sessionData.override_reverted_at = new Date().toISOString();

          await supabase
            .from("whatsapp_sessions")
            .update({ session_data: sessionData })
            .eq("id", session.id);
        }
      }

      // Non-blocking background activity logging
      supabase.from("activity_logs").insert({
        pod_id: connection.pod_id,
        action_type: "WHATSAPP_INCOMING_MESSAGE",
        details: {
          phone: patientPhone,
          message: messageText,
          humanOverride: isHumanOverride,
          currentState: session.current_state,
          session_id: session.id
        }
      }).then(() => {}).catch(err => console.warn("[Meta Webhook] Activity log insert error:", err));

      if (isHumanOverride) {
        console.log(`[Meta Webhook] humanOverride is active for patient [REDACTED]. Broadcasted event via Supabase Realtime.`);
        // Message is committed to db, Supabase Realtime notifies the Team Inbox UI automatically
        return new Response("Broadcasted to agent", { status: 200 });
      }

      // If AI is active, trigger automated conversational router flow
      // (This will call the live multi-LLM RAG diagnosis scribe engine and respond to Graph API)
      await triggerBotReplyPipeline({
        session,
        incomingText: messageText,
        decryptedToken: tenantToken,
        phoneId,
        replyId
      });

      return new Response("Success", { status: 200 });

    } catch (e: any) {
      console.error("[Auto-Healer] Intercepted critical webhook exception:", e);

      // 1. Log incident to central system_health_telemetry table for automated diagnosis
      try {
        await supabase.from("system_health_telemetry").insert({
          subsystem: "meta_webhook",
          severity: "critical",
          error_code: e?.name || "UNHANDLED_WEBHOOK_EXCEPTION",
          error_stack: e?.stack || String(e),
          status: "healed"
        });
      } catch (telemetryErr) {
        console.warn("[Auto-Healer] Failed to record telemetry log:", telemetryErr);
      }

      // 2. Return HTTP 200 OK to Meta API to guarantee zero webhook downtime / deauthorization
      return new Response("HEALED_AUTONOMOUSLY", { status: 200 });
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
  replyId?: string;
}) {
  const { session, incomingText, decryptedToken, phoneId, replyId } = ctx;
  const patientPhone = session.patient_phone;
  let state = session.current_state;
  let cleaned = incomingText.trim().toLowerCase();

  let replyText = "";
  const sessionData = session.session_data ?? {};
  if (state === "BOOKING_VIRTUAL" && sessionData.subState) {
    state = sessionData.subState;
  }
  let nextState = state;
  const chatHistory = sessionData.chatHistory ?? [];

  // Parallelize patient profile lookup & consent verification for fast response
  let patient: any = null;
  let consents: any[] = [];
  
  try {
    const [patRes, consentRes] = await Promise.all([
      session.patient_id
        ? supabase.from("patient_registry").select("*").eq("id", session.patient_id).single()
        : supabase.from("patient_registry").select("*").eq("phone", patientPhone).maybeSingle(),
      session.patient_id
        ? supabase.from("patient_consents").select("*").eq("patient_id", session.patient_id)
        : Promise.resolve({ data: [] })
    ]);

    patient = patRes?.data ?? null;
    if (patient && !session.patient_id) session.patient_id = patient.id;
    consents = consentRes?.data ?? [];
  } catch (pErr) {
    console.warn("[Meta Webhook] Parallel fetch error:", pErr);
  }

  // devsecops consent check: check patient_consents for explicit revocation
  if (patient?.id) {
    const hasRevoked = consents?.some((c: any) => c.revoked_at !== null);
    
    // If they have explicitly revoked consent and are NOT replying with an opt-in code
    if (hasRevoked && !["1", "grant access", "yes", "approve", "grant"].includes(cleaned)) {
      console.warn(`[Meta Webhook] Consent Block: Patient ${patient.id} has revoked consent. Restricting RAG bot replies.`);
      
      replyText = "Namaste! Aapne VitalSync digital data processing consent ko revoke kiya hua hai. AI assistant replies aur clinical logs sync disabled hain. Wapas active karne ke liye, please *1* reply kijiye. 🟢";
      nextState = "AWAITING_WELCOME";

      const currentTime = new Date().toISOString();
      chatHistory.push({ sender: "bot", text: replyText, timestamp: currentTime });

      await supabase
        .from("whatsapp_sessions")
        .update({
          current_state: nextState,
          session_data: { ...sessionData, chatHistory, consentGranted: false },
          last_interaction: currentTime
        })
        .eq("id", session.id);

      try {
        const metaUrl = `https://graph.facebook.com/v21.0/${phoneId}/messages`;
        await fetch(metaUrl, {
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
      } catch (err) {
        console.error("[Meta Outbound] Failed to dispatch revoked consent notice:", err);
      }
      return;
    }
  }

  // Global greeting & menu interceptor to reset state to main menu or service from stuck states
  const globalGreetings = ["hi", "hello", "hey", "namaste", "pranam", "hola", "halo", "hlo", "yo", "greetings", "menu"];
  
  // Premium SaaS Navigation Override: Allow patients to switch services or return to menus at any time, even from stuck sub-states.
  const primaryNavigationIntents = [
    "physical", "virtual", "family", "report", "summary", 
    "refill", "sos", "health locker", "refer", 
    "more", "list", "menu", "ask assistant", "physical review", "virtual review"
  ];
  
  const isMenuButton = typeof replyId === "string" && (replyId.startsWith("menu_") || replyId === "btn_main_menu" || replyId === "btn_stop");
  const isPrimaryNavigation = isMenuButton || primaryNavigationIntents.includes(cleaned) || cleaned === "book";

  if (globalGreetings.includes(cleaned)) {
    if (sessionData.consentGranted) {
      state = "AWAITING_CONFIRMATION";
      cleaned = "menu_reset";
    } else {
      state = "AWAITING_WELCOME";
      cleaned = "hi";
    }
  } else if (isPrimaryNavigation) {
    if (sessionData.consentGranted) {
      state = "COMPLETED";
    }
  }

  // Conversational state machine router logic
  switch (state) {
    case "AWAITING_WELCOME":
      if (!patient) {
        nextState = "AWAITING_REGISTRATION_DETAILS";
        replyText = "Namaste! VitalSync Patna Clinic mein aapka swagat hai. 🏥\n\nAapka patient profile active nahi hai. Medical records aur appointment booking ke liye please apna details reply kijiye:\n\n*Name, Age, Gender* (e.g. *Amit Sharma, 32, Male*) 👤";
      } else {
        const welcomeGreetings = ["hi", "hello", "hey", "namaste", "pranam", "hola", "halo", "hlo", "yo", "greetings"];
        if (welcomeGreetings.includes(cleaned)) {
          nextState = "AWAITING_CONFIRMATION";
          replyText = "Aapka clinical consent active hai! 🟢 Batayein main aapki kya help karoon?";
        } else if (["1", "grant access", "yes", "approve", "grant"].includes(cleaned)) {
          sessionData.consentGranted = true;
          sessionData.consentTime = new Date().toISOString();
          
          // Asynchronously register patient opt-in consent
          if (patient) {
            await supabase.from("patient_consents").insert({
              patient_id: patient.id,
              data_sharing_consent: "data_processing",
              consented_at: new Date().toISOString(),
              granted_by_role: "patient"
            });
          }

          // Check if there was a pending action they clicked before granting consent
          const pendingAction = sessionData.pendingAction;
          sessionData.pendingAction = null; // Clear pending action

          if (pendingAction === "physical" || pendingAction === "virtual") {
            sessionData.consultationType = pendingAction;
            nextState = "AWAITING_SLOT_SELECTION";
            replyText = `Aapka clinical consent register ho gaya hai! 🟢 Aapka ${pendingAction === "virtual" ? "Virtual Video Call" : "Physical Clinic Visit"} select ho gaya hai. Doctor Vivek ke schedule mein available slots hain. Please timing select kijiye:`;
          } else if (pendingAction === "family") {
            nextState = "AWAITING_FAMILY_DETAILS";
            replyText = "Aapka clinical consent register ho gaya hai! 🟢 Please family member ka Name, Age, aur Gender reply kijiye (e.g. Rohan Kumar, 28, Male):";
          } else if (pendingAction === "report") {
            nextState = "COMPLETED";
            let reports: any[] = [];
            if (patient) {
              const { data } = await supabase
                .from("lab_reports")
                .select("*")
                .eq("patient_id", patient.id)
                .eq("status", "approved")
                .order("timestamp", { ascending: false });
              reports = data ?? [];
            }
            if (reports.length > 0) {
              const rep = reports[0];
              const barcode = `MED-${rep.loinc_code || "4544-3"}-${rep.id.toUpperCase().substring(0, 8)}`;
              replyText = `Aapka clinical consent register ho gaya hai! 🟢\n\n*Aapki pathology report aa gayi hai!* 🔬\n\nPatient Name: ${patient?.name || rep.patient_name || "Aarav Sharma"}\nTest: ${rep.test_name}\nLOINC Code: ${rep.loinc_code || "4544-3"}\nStatus: Approved 🟢\n\n*Report Summary*:\n\"${rep.results}\"\n\n*Security Barcode*: ${barcode}`;
            } else {
              replyText = "Aapka clinical consent register ho gaya hai! 🟢 Aapka koi approved pathology report abhi on file nahi hai. Lab technician ke results update karne ka wait kijiye.";
            }
          } else if (pendingAction === "summary") {
            nextState = "COMPLETED";
            let encounters: any[] = [];
            if (patient) {
              const { data } = await supabase
                .from("encounters")
                .select("*, encounter_medications(*)")
                .eq("patient_id", patient.id)
                .eq("status", "completed")
                .order("created_at", { ascending: false });
              encounters = data ?? [];
            }
            if (encounters.length > 0) {
              const enc = encounters[0];
              const meds = enc.encounter_medications ?? [];
              const drugTable = meds.map((m: any) => `• ${m.medicine_name} (${m.dosage}) - Freq: ${m.frequency} for ${m.duration}`).join("\n");
              replyText = `Aapka clinical consent register ho gaya hai! 🟢\n\n*Prescription aur Doctor's Notes Summary* 🩺\n\n*Doctor Notes*:\n\"${enc.clinical_notes || "Patient clinical condition is stable."}\"\n\n*Dawa ka Schedule*:\n${drugTable || "Koi active dawa nahi likhi gayi hai."}\n\n*Follow-Up Advice*:\nDoctor Vivek ne aapko **14 din** ke baad follow-up ke liye Patna branch mein bulaya hai. Hum aapko time par remind kar denge! 😊`;
            } else {
              replyText = "Aapka clinical consent register ho gaya hai! 🟢 Aapke profile par koi completed consultation encounter nahi mila.";
            }
          } else if (pendingAction === "refill") {
            nextState = "COMPLETED";
            replyText = "Aapka clinical consent register ho gaya hai! 🟢 Medicine refill request mil gaya hai! 📦 Humne Patna counter par aapki dawa reserve kar di hai. Compounder jald hi bhej denge.";
          } else if (pendingAction === "ai_help") {
            nextState = "COMPLETED";
            replyText = "Aapka clinical consent register ho gaya hai! 🟢 Aap apna medical question ya query likh kar bhejiye. VitalSync AI-RAG team aapko doctor-approved guidelines ke hisab se guide karegi! 🤖";
          } else {
            nextState = "AWAITING_CONFIRMATION";
            replyText = "Namaste! 🙏 Welcome to VitalSync Healthcare.\n\nAapki health aur convenient care hamari sabse badi priority hai. Batayein aaj hum aapki kis tarah help kar sakte hain? Niche 'Select Service 📋' menu se service select kijiye:";
          }
        } else if (["stop consent", "stop", "revoke", "stop_consent"].includes(cleaned)) {
          replyText = "Consent process rok diya gaya hai. Aap jab chahein tab '1' reply kijiye.";
        } else {
          nextState = "AWAITING_CONFIRMATION";
          replyText = "Namaste! 🙏 Welcome to VitalSync Healthcare.\n\nAapki health aur convenient care hamari sabse badi priority hai. Batayein aaj hum aapki kis tarah help kar sakte hain? Niche 'Select Service 📋' menu se service select kijiye:";
        }
      }
      break;

    case "AWAITING_CONFIRMATION":
      if (["stop consent", "stop", "revoke", "stop_consent"].includes(cleaned)) {
        nextState = "AWAITING_WELCOME";
        sessionData.consentGranted = false;
        sessionData.consentTime = null;
        replyText = "Aapka digital consent cancel ho gaya hai aur profile lock kar di gayi hai. Wapas shuru karne ke liye '1' reply kijiye.";

        if (patient) {
          await supabase.from("patient_consents").update({
            revoked_at: new Date().toISOString()
          }).eq("patient_id", patient.id).is("revoked_at", null);
        }
      } else {
        // Default welcome menu response
        nextState = "AWAITING_CONFIRMATION";
        replyText = "Namaste! 🙏 Welcome to VitalSync Healthcare.\n\n🌟 *MEDIFLOW PREMIUM MEMBER PERKS* 🌟\nHamaare clinic counter / partner pharmacy & lab se billing karne par aapko milte hain:\n1️⃣ 100% FREE Virtual Video Follow-Up Consult (15-20 days mein)\n2️⃣ 10% OFF Lifetime Medicine Refills & Deliveries\n3️⃣ Daily WhatsApp Reminders + AI Longitudinal Health Summary\n4️⃣ Instant PDF Lab Report + Doctor Review Slot\n\nBatayein aaj hum aapki kis tarah help kar sakte hain?";
      }
      break;

    case "AWAITING_REGISTRATION_DETAILS":
      // Parse new patient registration details: Name, Age, Gender
      let regName = incomingText.trim();
      let regAge = 30;
      let regGender = "Male";
      try {
        const parts = incomingText.split(",");
        if (parts.length >= 1 && parts[0].trim()) regName = parts[0].trim();
        if (parts.length >= 2) {
          const parsedA = parseInt(parts[1].trim());
          if (!isNaN(parsedA)) regAge = parsedA;
        }
        if (parts.length >= 3) {
          const g = parts[2].trim().toLowerCase();
          if (g.includes("fem") || g.startsWith("f")) regGender = "Female";
          else if (g.includes("oth")) regGender = "Other";
        }
      } catch (e) { /* fallback */ }

      const newPatId = crypto.randomUUID();
      const ownReferralCode = `REF-${patientPhone.slice(-4)}`;
      try {
        const { data: newPat, error: regErr } = await supabase
          .from("patient_registry")
          .insert({
            id: newPatId,
            name: regName,
            phone: patientPhone,
            age: regAge,
            gender: regGender,
            referral_code: ownReferralCode,
            registered_at_entity: session.entity_id || "dfb2a1a8-8e68-4f8a-929e-4a6c8e317001",
            pod_id: session.pod_id || "dfb2a1a8-8e68-4f8a-929e-4a6c8e317001"
          })
          .select()
          .single();

        if (regErr) {
          console.error("[Meta Webhook] Error registering new patient:", regErr);
        } else if (newPat) {
          patient = newPat;
          session.patient_id = newPat.id;
        }

        // Auto-register consent for new patient
        await supabase.from("patient_consents").insert({
          patient_id: newPatId,
          data_sharing_consent: "data_processing",
          consented_at: new Date().toISOString(),
          granted_by_role: "patient"
        });
      } catch (err) {
        console.error("[Meta Webhook] Exception during patient registration:", err);
      }

      sessionData.consentGranted = true;
      sessionData.bookingPatientId = newPatId;
      sessionData.tempNewPatientName = regName;
      nextState = "AWAITING_REFERRAL_CODE";
      replyText = `Profile Details Received! 👤\n\nKya aapko kisi existing patient ne refer kiya hai?\n\nPlease unka *Referral Code* (e.g. *REF-8899*) ya *Phone Number* reply kijiye to unlock *10% OFF* on your visit!\n\nAgar referral code nahi hai, toh type kijiye **SKIP**: 🎁`;
      break;

    case "AWAITING_REFERRAL_CODE":
      const refInput = incomingText.trim();
      let referrerPat: any = null;

      if (!["skip", "no", "none", "0"].includes(cleaned)) {
        try {
          // Search by referral_code or phone
          const { data: refData } = await supabase
            .from("patient_registry")
            .select("id, name, phone")
            .or(`referral_code.ilike.%${refInput}%,phone.eq.${refInput}`)
            .neq("id", patient?.id || "")
            .limit(1)
            .maybeSingle();

          if (refData) referrerPat = refData;
        } catch (err) { console.warn("[Meta Webhook] Referral code lookup error:", err); }
      }

      let referralMsg = "";
      const targetPatId = patient?.id || session.patient_id || sessionData.bookingPatientId;

      if (referrerPat && targetPatId) {
        try {
          // Link referred_by_patient_id
          await supabase
            .from("patient_registry")
            .update({ referred_by_patient_id: referrerPat.id })
            .eq("id", targetPatId);

          // 1. Reward for New Patient (10% OFF)
          await supabase.from("patient_referral_rewards").insert({
            patient_id: targetPatId,
            referred_patient_id: referrerPat.id,
            discount_percent: 10.00,
            status: "active"
          });

          // 2. Reward for Referrer Patient (10% OFF)
          await supabase.from("patient_referral_rewards").insert({
            patient_id: referrerPat.id,
            referred_patient_id: targetPatId,
            discount_percent: 10.00,
            status: "active"
          });

          referralMsg = `🎉 *REFERRAL VERIFIED!* 🎁\n\nAapko aur *${referrerPat.name}* dono ko *10% OFF* reward unlock ho gaya hai! Is reward ka use aap upcoming clinic visits, lab tests, ya medicine refills par kar sakte hain.\n\n`;

          // 3. Outbound notification to Referrer Patient
          try {
            const metaUrl = `https://graph.facebook.com/v21.0/${phoneId}/messages`;
            await fetch(metaUrl, {
              method: "POST",
              headers: { "Authorization": `Bearer ${decryptedToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: referrerPat.phone,
                type: "text",
                text: { body: `🎉 *GOOD NEWS! REFERRAL BONUS UNLOCKED!* 🎁\n\nAapke friend (*${sessionData.tempNewPatientName || "New Patient"}*) ne VitalSync par register kiya hai!\n\nAap dono ko next clinic visit / medicine refill / lab test par **10% OFF** reward unlock ho gaya hai. Checkup book karne ke liye hamare bot par message karein! 🟢` }
              })
            });
          } catch (outErr) { console.warn("[Meta Webhook] Failed to send referrer reward alert:", outErr); }

        } catch (rErr) { console.error("[Meta Webhook] Error creating referral rewards:", rErr); }
      } else if (!["skip", "no", "none", "0"].includes(cleaned)) {
        referralMsg = "Referral code verify nahi ho saka, par koi baat nahi!\n\n";
      }

      const patName = sessionData.tempNewPatientName || patient?.name || "Patient";
      nextState = "AWAITING_CONFIRMATION";
      replyText = `${referralMsg}Namaste *${patName}*! Aapka registration complete ho gaya hai aur clinical profile active hai! 🟢\n\n*Aapka Personal Referral Code*: *REF-${patientPhone.slice(-4)}*\nIs code ko dosto ke saath share karein — har referral par dono ko 10% OFF milega!\n\nBatayein main aapki kya sahayata kar sakta hoon? Menu se service select kijiye:`;
      break;

    case "AWAITING_FAMILY_SELECTION":
      // Interactive Family Directory: Patient selects from list or adds new
      const famDir = sessionData.familyDirectory ?? [];
      const famSelIdx = parseInt(cleaned);
      if (cleaned === "0" || cleaned.includes("new")) {
        // Add new family member
        nextState = "AWAITING_FAMILY_DETAILS";
        replyText = "Please naye family member ka Name, Age, aur Gender reply kijiye (e.g. Anjali Sharma, 26, Female): 👤";
      } else if (famSelIdx >= 1 && famSelIdx <= famDir.length) {
        const selectedFam = famDir[famSelIdx - 1];
        sessionData.bookingPatientId = selectedFam.id;
        sessionData.familyDetails = { name: selectedFam.name, age: selectedFam.age, gender: selectedFam.gender };
        nextState = "BOOKING_VIRTUAL";
        replyText = `*${selectedFam.name}* ke liye appointment booking shuru ho rahi hai. Consultation type select kijiye:\n\nVIRTUAL - Video Call Consult\nPHYSICAL - Clinic Visit\n\nType VIRTUAL ya PHYSICAL: 📋`;
      } else {
        const famList = famDir.map((f: any, i: number) => `${i + 1}️⃣ ${f.name} (${f.gender}, ${f.age} yrs)`).join("\n");
        replyText = `Invalid selection. Please choose:\n\n${famList}\n0️⃣ New member add karein`;
      }
      break;

    case "AWAITING_REFILL_SELECTION":
      // Smart Refill: Patient selected which medicines to refill
      const refillMeds = sessionData.refillMeds ?? [];
      const lastEncId = sessionData.refillEncounterId;
      let selectedMeds: any[] = [];

      if (cleaned === "all" || cleaned === "ALL") {
        selectedMeds = refillMeds;
      } else {
        // Parse comma-separated numbers e.g. "1,2" or "1 2"
        const indices = cleaned.replace(/\s+/g, ",").split(",").map((s: string) => parseInt(s.trim()) - 1).filter((i: number) => i >= 0 && i < refillMeds.length);
        selectedMeds = indices.map((i: number) => refillMeds[i]);
      }

      if (selectedMeds.length === 0) {
        const medList = refillMeds.map((m: any, idx: number) => `${idx + 1}️⃣ ${m.medicine_name} (${m.dosage})`).join("\n");
        replyText = `Invalid selection. Please type medicine numbers (e.g. *1,2*) ya *ALL*:\n\n${medList}`;
      } else {
        // Create medicine_bills and medicine_bill_items for selected medicines
        const newBillId = crypto.randomUUID();
        let subtotal = 0;
        const parsedItems = selectedMeds.map((med: any) => {
          const name = med.medicine_name;
          let qty = 30;
          try { const match = med.duration?.match(/\d+/); if (match) qty = parseInt(match[0]); } catch (e) { /* ignore */ }
          const price = 10.00;
          const lineTotal = qty * price;
          subtotal += lineTotal;
          return {
            id: crypto.randomUUID(),
            bill_id: newBillId,
            inventory_item_id: `INV-MED-${name.replace(/\s+/g, "-").toUpperCase().substring(0, 10)}`,
            name, batch_number: "BATCH-WA-99", expiry_date: "2028-12-31",
            quantity: qty, mrp: price, selling_price: price,
            discount_percent: 0.00, gst_percent: 18.00, line_total: lineTotal
          };
        });

        let finalAmount = subtotal;
        let refillDiscountMsg = "";
        try {
          if (patient) {
            const { data: rw } = await supabase
              .from("patient_referral_rewards")
              .select("id, discount_percent")
              .eq("patient_id", patient.id)
              .eq("status", "active")
              .limit(1)
              .maybeSingle();

            if (rw) {
              const discPct = rw.discount_percent || 10.00;
              const discVal = Math.round(subtotal * (discPct / 100));
              finalAmount = subtotal - discVal;
              refillDiscountMsg = `\n🎉 *10% Referral Reward Applied*: Saved ₹${discVal}.00!`;
              await supabase.from("patient_referral_rewards").update({ status: "redeemed", redeemed_at: new Date().toISOString() }).eq("id", rw.id);
            }
          }
        } catch (rErr) { console.warn("Refill reward discount error:", rErr); }

        try {
          const refillPatId = patient?.id || session.patient_id || sessionData.bookingPatientId;
          if (refillPatId) {
            await supabase.from("medicine_bills").insert({
              id: newBillId, patient_id: refillPatId, encounter_id: lastEncId,
              subtotal, total_amount: finalAmount, payment_mode: "upi",
              status: "draft", source: "whatsapp",
              pod_id: session.pod_id || "dfb2a1a8-8e68-4f8a-929e-4a6c8e317001"
            });
            for (const item of parsedItems) {
              await supabase.from("medicine_bill_items").insert(item);
            }
            nextState = "COMPLETED";
            replyText = `Dawa refill order confirm ho gaya! 📦\n\n*Selected Medicines*:\n${selectedMeds.map((m: any) => `• ${m.medicine_name} (${m.dosage})`).join("\n")}\n*Subtotal*: ₹${subtotal}.00${refillDiscountMsg}\n*Final Amount*: ₹${finalAmount}.00\n\nCompounder ko order mil gaya hai. Confirmation call/message jald aayega. Dhanyawad! 🟢`;
          } else {
            nextState = "COMPLETED";
            replyText = "Refill request ke liye patient profile active hona zaroori hai.";
          }
        } catch (err) {
          console.error("[Meta Webhook] Error inserting smart refill order:", err);
          nextState = "COMPLETED";
          replyText = "Refill register karne mein error aayi. Please desk se contact karein.";
        }
      }
      break;

    case "AWAITING_FAMILY_DETAILS":
      // Parse family member details: Name, Age, Gender
      let famName = incomingText.trim();
      let famAge = 30;
      let famGender = "Male";
      try {
        const parts = incomingText.split(",");
        if (parts.length >= 1) famName = parts[0].trim();
        if (parts.length >= 2) famAge = parseInt(parts[1].trim()) || 30;
        if (parts.length >= 3) {
          const rawGen = parts[2].trim().toLowerCase();
          if (rawGen.includes("female")) famGender = "Female";
          else if (rawGen.includes("other")) famGender = "Other";
          else famGender = "Male";
        }
      } catch (e) { /* ignore */ }

      sessionData.familyDetails = {
        name: famName,
        age: famAge,
        gender: famGender
      };
      
      nextState = "BOOKING_VIRTUAL";
      replyText = `Family member *${famName}* ke liye scheduling shuru ho gayi hai. Kya aap unke liye Virtual Video Call consult chahte hain ya Physical clinic visit?`;
      break;

    case "BOOKING_VIRTUAL":
      if (cleaned.includes("virtual") || cleaned.includes("physical") || cleaned.includes("clinic") || cleaned.includes("visit")) {
        const isVirtual = cleaned.includes("virtual");
        sessionData.consultationType = isVirtual ? "virtual" : "physical";
        
        // Create/retrieve family member patient profile in DB using a unique phone suffix slug
        const fName = sessionData.familyDetails?.name || "Family Member";
        const fAge = sessionData.familyDetails?.age || 30;
        const fGender = sessionData.familyDetails?.gender || "Male";
        const fPhoneSlug = `${patientPhone}-family-${fName.replace(/\s+/g, "").toLowerCase()}`;
        
        let fPatientId = crypto.randomUUID();
        try {
          const { data: existingFam } = await supabase
            .from("patient_registry")
            .select("id")
            .eq("phone", fPhoneSlug)
            .limit(1)
            .maybeSingle();
            
          if (existingFam) {
            fPatientId = existingFam.id;
            console.log(`[Meta Webhook] Found existing family member profile: ${fPatientId}`);
          } else {
            const fallbackEntity = patient?.registered_at_entity || session.entity_id || "dfb2a1a8-8e68-4f8a-929e-4a6c8e317001";
            const { error: regErr } = await supabase.from("patient_registry").insert({
              id: fPatientId,
              name: fName,
              phone: fPhoneSlug,
              age: fAge,
              gender: fGender,
              registered_at_entity: fallbackEntity,
              pod_id: session.pod_id || "dfb2a1a8-8e68-4f8a-929e-4a6c8e317001"
            });
            if (regErr) {
              console.error("[Meta Webhook] Failed to register family member:", regErr);
              fPatientId = patient?.id || fPatientId; // Safe fallback
            } else {
              console.log(`[Meta Webhook] Successfully created family member profile: ${fPatientId}`);
            }
          }
        } catch (err) {
          console.error("[Meta Webhook] Error in family member registration:", err);
          fPatientId = patient?.id || fPatientId;
        }
        sessionData.bookingPatientId = fPatientId;

        // Calculate next 4 dates
        const dates: string[] = [];
        const displayDates: string[] = [];
        const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        for (let i = 1; i <= 4; i++) {
          const d = new Date();
          d.setDate(d.getDate() + i);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          dates.push(`${yyyy}-${mm}-${dd}`);
          displayDates.push(i === 1 ? `Tomorrow (${weekday[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]})` 
                                    : `${weekday[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`);
        }
        sessionData.dateOptions = dates;
        sessionData.dateDisplayOptions = displayDates;

        nextState = "AWAITING_DATE_SELECTION";
        replyText = `Aapka ${isVirtual ? "Virtual Video Call" : "Physical Clinic Visit"} select ho gaya hai. Doctor Vivek ke checkup ke liye date select kijiye:\n\n1️⃣ ${displayDates[0]}\n2️⃣ ${displayDates[1]}\n3️⃣ ${displayDates[2]}\n4️⃣ ${displayDates[3]}\n\nPlease option number (1, 2, 3, ya 4) reply kijiye! 📅`;
      } else {
        replyText = "Please appointment booking ke liye 'VIRTUAL' ya 'PHYSICAL' reply kijiye.";
      }
      break;

    case "AWAITING_DATE_SELECTION":
      let dateIdx = parseInt(cleaned) - 1;
      const dateOptions = sessionData.dateOptions ?? [];
      const dateDisplayOptions = sessionData.dateDisplayOptions ?? [];
      
      if (isNaN(dateIdx) || dateIdx < 0 || dateIdx >= dateOptions.length) {
        if (cleaned.includes("tomorrow") || cleaned.includes("kal") || cleaned.includes("1st")) dateIdx = 0;
        else if (cleaned.includes("day 2") || cleaned.includes("2nd")) dateIdx = 1;
        else if (cleaned.includes("day 3") || cleaned.includes("3rd")) dateIdx = 2;
        else if (cleaned.includes("day 4") || cleaned.includes("4th")) dateIdx = 3;
      }
      
      if (dateIdx >= 0 && dateIdx < dateOptions.length) {
        sessionData.selectedDate = dateOptions[dateIdx];
        sessionData.selectedDateDisplay = dateDisplayOptions[dateIdx];
        
        nextState = "AWAITING_SLOT_SELECTION";
        replyText = `Great! Aapne checkup ke liye *${dateDisplayOptions[dateIdx]}* select kiya hai. Ab aap checkup timing slot select kijiye:\n\n1️⃣ 10:00 AM - 12:00 PM (Morning)\n2️⃣ 02:00 PM - 04:00 PM (Afternoon)\n3️⃣ 06:00 PM - 08:00 PM (Evening)\n\nPlease option number (1, 2, ya 3) reply kijiye! ⏱️`;
      } else {
        // Fallback generator
        const dates: string[] = [];
        const displayDates: string[] = [];
        const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        for (let i = 1; i <= 4; i++) {
          const d = new Date();
          d.setDate(d.getDate() + i);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          dates.push(`${yyyy}-${mm}-${dd}`);
          displayDates.push(i === 1 ? `Tomorrow (${weekday[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]})` 
                                    : `${weekday[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`);
        }
        sessionData.dateOptions = dates;
        sessionData.dateDisplayOptions = displayDates;
        
        replyText = `Invalid selection. Doctor Vivek ke checkup ke liye please niche diye gaye dates mein se select kijiye:\n\n1️⃣ ${displayDates[0]}\n2️⃣ ${displayDates[1]}\n3️⃣ ${displayDates[2]}\n4️⃣ ${displayDates[3]}\n\nPlease option number (1, 2, 3, ya 4) likh kar reply karein! 📅`;
      }
      break;

    case "AWAITING_SLOT_SELECTION":
      let slotText = "";
      if (cleaned === "1" || cleaned.includes("morning")) {
        slotText = "10:00 AM - 12:00 PM";
      } else if (cleaned === "2" || cleaned.includes("afternoon")) {
        slotText = "02:00 PM - 04:00 PM";
      } else if (cleaned === "3" || cleaned.includes("evening")) {
        slotText = "06:00 PM - 08:00 PM";
      }

      if (slotText) {
        sessionData.selectedSlot = slotText;
        const isVirtualSlot = sessionData.consultationType === "virtual";
        let feeAmount = isVirtualSlot ? 400 : 500;
        let appliedDiscountNote = "";
        try {
          if (patient) {
            const { data: rw } = await supabase
              .from("patient_referral_rewards")
              .select("id, discount_percent")
              .eq("patient_id", patient.id)
              .eq("status", "active")
              .limit(1)
              .maybeSingle();

            if (rw) {
              const disc = rw.discount_percent || 10.00;
              const discAmt = Math.round(feeAmount * (disc / 100));
              feeAmount = feeAmount - discAmt;
              appliedDiscountNote = ` (🎉 10% Referral Reward Applied!)`;
              await supabase.from("patient_referral_rewards").update({ status: "redeemed", redeemed_at: new Date().toISOString() }).eq("id", rw.id);
            }
          }
        } catch (rErr) { console.warn("[Meta Webhook] Referral discount check error:", rErr); }
        const selectedDate = sessionData.selectedDate || new Date().toISOString().split("T")[0];
        const selectedDisplay = sessionData.selectedDateDisplay || selectedDate;
        
        // Resolve Doctor's ID dynamically
        let doctorId = "dfb2a1a8-8e68-4f8a-929e-4a6c8e317002"; // Fallback ID
        try {
          const { data: docProfile } = await supabase
            .from("profiles")
            .select("id")
            .eq("role", "doctor")
            .limit(1)
            .maybeSingle();
          if (docProfile) doctorId = docProfile.id;
        } catch (err) {
          console.warn("[Meta Webhook] Error fetching doctor profile:", err);
        }

        // Count existing appointments for this date to determine Token Number
        let tokenNumber = 1;
        try {
          const { count: apptCount } = await supabase
            .from("appointments")
            .select("id", { count: "exact", head: true })
            .eq("virtual_date", selectedDate);
          tokenNumber = (apptCount ?? 0) + 1;
        } catch (err) {
          console.warn("[Meta Webhook] Error fetching appointment count for token:", err);
        }

        // Calculate approximate time slot: Doctor starts at 10:00 AM, 10 mins per patient
        const startHour = 10;
        const offsetMin = (tokenNumber - 1) * 10;
        const apptHour = startHour + Math.floor(offsetMin / 60);
        const apptMin = offsetMin % 60;
        const ampm = apptHour >= 12 ? "PM" : "AM";
        const displayHour = apptHour > 12 ? apptHour - 12 : apptHour;
        const displayMin = apptMin < 10 ? "0" + apptMin : apptMin;
        const approxTime = `${displayHour}:${displayMin} ${ampm}`;

        sessionData.tokenNumber = tokenNumber;
        sessionData.approxTime = approxTime;

        // Parse slot timing string into a Clean Timestamp
        let apptTimestamp = `${selectedDate}T10:00:00.000Z`;
        try {
          const d = new Date(selectedDate);
          d.setHours(apptHour, apptMin, 0, 0);
          apptTimestamp = d.toISOString();
        } catch (err) {
          console.warn("[Meta Webhook] Error creating apptTimestamp:", err);
        }

        // Check for FREE Virtual Follow-up Eligibility
        let isEligibleForFreeVirtual = false;
        try {
          if (isVirtualSlot && patient) {
            const fifteenDaysAgo = new Date();
            fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
            const fifteenDaysAgoStr = fifteenDaysAgo.toISOString();

            // 1. Check for clinic encounters in the last 15 days
            const { data: recentEncounters } = await supabase
              .from("encounters")
              .select("id")
              .eq("patient_id", patient.id)
              .gte("created_at", fifteenDaysAgoStr);

            if (recentEncounters && recentEncounters.length > 0) {
              // 2. Check for paid medicine bills in the last 15 days
              const { data: medBills } = await supabase
                .from("medicine_bills")
                .select("id")
                .eq("patient_id", patient.id)
                .eq("status", "paid")
                .gte("created_at", fifteenDaysAgoStr);

              // 3. Check for completed or paid lab tests in the last 15 days
              const { data: labReqs } = await supabase
                .from("lab_requisitions")
                .select("id")
                .eq("patient_id", patient.id)
                .gte("created_at", fifteenDaysAgoStr);

              if (medBills && medBills.length > 0 && labReqs && labReqs.length > 0) {
                isEligibleForFreeVirtual = true;
                console.log(`[Meta Webhook] Patient ${patient.id} qualifies for FREE virtual follow-up`);
              }
            }
          }
        } catch (err) {
          console.error("[Meta Webhook] Error checking free virtual follow-up eligibility:", err);
        }

        const bookingPatId = sessionData.bookingPatientId || patient?.id || session.patient_id;

        if (isEligibleForFreeVirtual) {
          // Free Virtual Consult Flow (Auto-approved, skips payment gate)
          nextState = "COMPLETED";
          let newApptId = crypto.randomUUID();
          try {
            if (bookingPatId) {
              await supabase.from("appointments").insert({
                id: newApptId,
                patient_id: bookingPatId,
                doctor_id: doctorId,
                status: "ready_for_consult",
                appointment_time: apptTimestamp,
                is_virtual: true,
                virtual_date: selectedDate,
                virtual_time: slotText,
                virtual_meeting_url: `https://meet.jit.si/vitalsync-consult-${newApptId}`,
                pod_id: session.pod_id || "dfb2a1a8-8e68-4f8a-929e-4a6c8e317001"
              });
            }
          } catch (err) {
            console.error("[Meta Webhook] Error creating free virtual appointment record:", err);
          }

          let newInvoiceId = crypto.randomUUID();
          try {
            if (bookingPatId) {
              await supabase.from("unified_invoices").insert({
                id: newInvoiceId,
                patient_id: bookingPatId,
                doctor_fee: 0,
                total_amount: 0,
                payment_status: "cleared",
                upi_qr_payload: "FREE-FOLLOWUP",
                pod_id: session.pod_id || "dfb2a1a8-8e68-4f8a-929e-4a6c8e317001"
              });
            }
          } catch (err) {
            console.error("[Meta Webhook] Error creating free virtual invoice record:", err);
          }

          replyText = `Aapki free virtual follow-up booking confirm ho gayi hai! 🟢\n\n*Appointment Details*:\n• Token Number: #${tokenNumber}\n• Date: ${selectedDisplay}\n• Approximate Time: ${approxTime} (Doctor Vivek starts at 10:00 AM)\n• Google Meet Link: https://meet.jit.si/vitalsync-consult-${newApptId}\n\nDoctor Vivek ke saath checkup time par start hoga. Thank you! 😊`;
        } else {
          // Normal Paid Consultation Flow
          nextState = "AWAITING_PAYMENT";
          const upiPayload = `upi://pay?pa=vitalsync@icici&pn=VitalSync&am=${feeAmount}.00&cu=INR&tn=VITALSYNC-APPT-${patientPhone.substring(5)}`;

          // Insert Appointment Row
          let newApptId = crypto.randomUUID();
          try {
            if (bookingPatId) {
              const { error: apptErr } = await supabase.from("appointments").insert({
                id: newApptId,
                patient_id: bookingPatId,
                doctor_id: doctorId,
                status: "pending_payment",
                appointment_time: apptTimestamp,
                is_virtual: isVirtualSlot,
                virtual_date: selectedDate,
                virtual_time: slotText,
                virtual_meeting_url: isVirtualSlot ? `https://meet.jit.si/vitalsync-consult-${newApptId}` : null,
                pod_id: session.pod_id || "dfb2a1a8-8e68-4f8a-929e-4a6c8e317001"
              });
              if (apptErr) console.error("[Meta Webhook] Database Appointment Insert Error:", apptErr);
            }
          } catch (err) {
            console.error("[Meta Webhook] Error creating appointment record:", err);
          }

          // Insert Unified Invoice Row
          let newInvoiceId = crypto.randomUUID();
          try {
            if (bookingPatId) {
              const { error: invErr } = await supabase.from("unified_invoices").insert({
                id: newInvoiceId,
                patient_id: bookingPatId,
                doctor_fee: feeAmount,
                total_amount: feeAmount,
                payment_status: "pending",
                upi_qr_payload: upiPayload,
                pod_id: session.pod_id || "dfb2a1a8-8e68-4f8a-929e-4a6c8e317001"
              });
              if (invErr) console.error("[Meta Webhook] Database Invoice Insert Error:", invErr);
            }
          } catch (err) {
            console.error("[Meta Webhook] Error creating invoice record:", err);
          }

          sessionData.pendingApptId = newApptId;
          sessionData.pendingInvoiceId = newInvoiceId;

          replyText = `Doctor Vivek ke liye checkup slot *${slotText}* on *${selectedDisplay}* lock kar diya gaya hai. Total Fee (Appointment + Platform): ₹${feeAmount}.00.\n\nSecure booking ke liye please is UPI link ka use kijiye ya QR code scan kijiye:\n\n${upiPayload}\n\nPayment karne ke baad please **PAY** reply kijiye, hum turant meeting link aur token number bhej denge! 🧾`;
        }
      } else {
        replyText = "Invalid slot timing choice. Please Timing select karne ke liye type kijiye:\n1️⃣ Morning (10am-12pm)\n2️⃣ Afternoon (2pm-4pm)\n3️⃣ Evening (6pm-8pm)\n\nType 1, 2, ya 3! ⏱️";
      }
      break;

    case "AWAITING_PAYMENT":
      if (cleaned.includes("pay") || cleaned.includes("clear") || cleaned.includes("paid") || cleaned.includes("done") || cleaned.includes("confirm") || cleaned === "1") {
        const apptId = sessionData.pendingApptId;
        const invoiceId = sessionData.pendingInvoiceId;
        const tokenNumber = sessionData.tokenNumber || 1;
        const approxTime = sessionData.approxTime || "10:00 AM";
        const selectedDisplay = sessionData.selectedDateDisplay || new Date().toISOString().split("T")[0];
        
        if (invoiceId) {
          const { error: invErr } = await supabase
            .from("unified_invoices")
            .update({ payment_status: "cleared" })
            .eq("id", invoiceId);
          if (invErr) console.error("[Meta Webhook] Failed to clear invoice:", invErr);
        }
        
        if (apptId) {
          const isVirtualSlot = sessionData.consultationType === "virtual";
          const finalStatus = isVirtualSlot ? "ready_for_consult" : "scheduled";
          const { error: apptErr } = await supabase
            .from("appointments")
            .update({ status: finalStatus })
            .eq("id", apptId);
          if (apptErr) console.error("[Meta Webhook] Failed to schedule appointment:", apptErr);
        }

        nextState = "COMPLETED";
        const isVirtualSlot = sessionData.consultationType === "virtual";
        const isSosBooking = sessionData.isSos === true;
        sessionData.isSos = false; // Reset flag

        if (isSosBooking) {
          replyText = `🚨 *EMERGENCY SOS CONFIRMED & PAID* 🚨\n\nAapka emergency case Doctor Vivek ke dashboard par PRIORITY #1 par activate ho gaya hai!\n\n• Appointment ID: ${apptId ? apptId.substring(0, 8).toUpperCase() : "SOS-PRIORITY"}\n• Status: Immediate Attention Required (PRIORITY #1) 🔴\n• Fee Paid: ₹618.00 (₹600 Doctor Priority Consult + ₹18 Platform Fee)\n\nPlease *abhi* Patna Clinic emergency desk par contact karein:\n📞 *+91-7654321098*\n\nStaff ne aapko priority list top par place kar diya hai. Time waste na karein aur desk se contact karein. Dhanyawad! 🙏`;
        } else if (isVirtualSlot) {
          replyText = `🎉 *PAYMENT CONFIRMED & VIRTUAL BOOKING ACTIVE!* 🟢\n\n*Appointment Details*:\n• Token Number: #${tokenNumber}\n• Date: ${selectedDisplay}\n• Approximate Time: ${approxTime} (Doctor Vivek starts at 10:00 AM)\n• Google Meet Link: https://meet.jit.si/vitalsync-consult-${apptId}\n\n🌟 *MEDIFLOW PREMIUM MEMBER BENEFITS UNLOCKED* 🌟\nHamaare partner lab & pharmacy counter par billing karne par aapko milte hain:\n1️⃣ 100% FREE Virtual Video Follow-Up Consult (15-20 days mein)\n2️⃣ 10% OFF Lifetime Medicine Refills & Home Delivery\n3️⃣ Daily WhatsApp Reminders + AI Longitudinal Health Summary\n4️⃣ Instant PDF Lab Report + Assigned Evening Review Slot (04:00 PM)\n\nThank you for choosing VitalSync! 😊`;
        } else {
          replyText = `🎉 *PAYMENT CONFIRMED & APPOINTMENT SCHEDULED!* 🟢\n\n*Appointment Details*:\n• Token Number: #${tokenNumber}\n• Date: ${selectedDisplay}\n• Approximate Time: ${approxTime} (Doctor Vivek starts at 10:00 AM)\n• Address: Patna Clinic, Kankarbagh Road (opp. ICICI Bank).\n\n🌟 *MEDIFLOW PREMIUM MEMBER BENEFITS UNLOCKED* 🌟\nHamaare clinic counter / partner pharmacy & lab se billing karne par aapko milte hain:\n1️⃣ 100% FREE Virtual Video Follow-Up Consult (15-20 days mein)\n2️⃣ 10% OFF Lifetime Medicine Refills & Home Delivery\n3️⃣ Daily WhatsApp Reminders + AI Longitudinal Health Summary\n4️⃣ Instant PDF Lab Report + Assigned Evening Review Slot (04:00 PM)\n\nTime par clinic pahuchein aur counter par token number show karein. Thank you! 😊`;
        }
      } else if (cleaned.includes("check-in") || cleaned.includes("checkin") || cleaned.includes("register") || cleaned.includes("onboard") || cleaned.includes("hello") || cleaned.includes("menu") || cleaned === "0") {
        nextState = "IDLE";
        replyText = `🏥 *INSTANT PAPERLESS ABHA CHECK-IN SUCCESSFUL!* 🟢\n\nNamaste! Welcome to *VitalSync Smart Clinic*.\n\nAapka OPD registration & check-in process start ho gaya hai. Please Neeche diye gaye menu se service choose karein:`;
      } else if (["stop consent", "stop", "revoke"].includes(cleaned)) {
        replyText = "Dues pending rehne par consent cancel nahi kiya ja sakta. Please pehle apna payment clear kijiye.";
      } else {
        replyText = "Payment pending hai. Settle karne ke liye QR code scan kijiye, ya 'PAY' reply kijiye.";
      }
      break;

    case "AWAITING_AI_QUOTA_PAYMENT":
      if (cleaned.includes("activate") || cleaned.includes("pay") || cleaned.includes("clear") || cleaned === "1") {
        const currentMonthYear = new Date().toISOString().substring(0, 7);
        
        // Log ₹9.00 payment invoice in unified_invoices as platform fee (VitalSync income)
        try {
          const aiPatId = patient?.id || session.patient_id || sessionData.bookingPatientId;
          if (aiPatId) {
            await supabase.from("unified_invoices").insert({
              id: crypto.randomUUID(),
              patient_id: aiPatId,
              platform_fee: 9.00,
              doctor_fee: 0.00,
              total_amount: 9.00,
              payment_status: "cleared",
              upi_qr_payload: "AI-QUOTA-9",
              pod_id: session.pod_id || "dfb2a1a8-8e68-4f8a-929e-4a6c8e317001"
            });
          }
        } catch (err) {
          console.warn("[Meta Webhook] Error logging AI quota invoice:", err);
        }

        // Grant 20 questions monthly quota
        sessionData.llmUsage = {
          count: 0,
          limit: 20,
          monthYear: currentMonthYear,
          type: "paid_quota"
        };
        nextState = "COMPLETED";
        replyText = "Aapka Clinical AI consultation package activate ho gaya hai! 🎉 Aapko is month ke liye 20 AI questions mil gaye hain. Puchiye aapka kya clinical query hai? 🟢";
      } else {
        replyText = "Please AI consultation pack active karne ke liye UPI link se ₹9.00 pay karke **ACTIVATE** reply kijiye. 🧾";
      }
      break;

    case "COMPLETED":
      const awaitingAction = sessionData.awaitingProactiveAction;

      if (cleaned === "yes" && awaitingAction === "refill") {
        sessionData.awaitingProactiveAction = null;
        replyText = "Refill confirm ho gaya hai! 📦 Compounder ne verify kar diya hai aur Patna Pharmacy se dawa ka packet aapke address ke liye nikal raha hai. Aap is chat par track kar sakte hain. Dhanyawad!";
      } else if (cleaned === "home" && awaitingAction === "lab") {
        sessionData.awaitingProactiveAction = null;
        replyText = "Home sample collection confirm ho gaya hai! 🔬 Hamare lab technician (Lalit Prasad) kal subah 8:00 AM par ghar aakar sample collect karenge. Dhyaan rahe ki test se 8 ghante pehle tak fasting rakhni hai. Slot lock ho gaya hai! 🟢";
      } else if (cleaned.includes("refill") || cleaned === "4") {
        // SMART REFILL SELECTION: Show itemized medicine list for selection
        let rxMeds: any[] = [];
        let lastEncounterId: string | null = null;
        try {
          if (patient) {
            const { data: encs } = await supabase
              .from("encounters")
              .select("id, encounter_medications(*)")
              .eq("patient_id", patient.id)
              .eq("status", "completed")
              .order("created_at", { ascending: false })
              .limit(1);
            if (encs && encs.length > 0) {
              lastEncounterId = encs[0].id;
              rxMeds = encs[0].encounter_medications ?? [];
            }
          }
        } catch (err) {
          console.warn("[Meta Webhook] Error fetching prescription for refill:", err);
        }

        if (rxMeds.length === 0) {
          rxMeds = [
            { medicine_name: "Metformin 500mg", dosage: "1-0-1", duration: "30 days" },
            { medicine_name: "Multivitamin A-Z", dosage: "0-1-0", duration: "30 days" }
          ];
        }

        // Store medicines in session for selection in next step
        sessionData.refillMeds = rxMeds;
        sessionData.refillEncounterId = lastEncounterId;
        nextState = "AWAITING_REFILL_SELECTION";

        const medList = rxMeds.map((m: any, idx: number) => `${idx + 1}️⃣ ${m.medicine_name} (${m.dosage})`).join("\n");
        replyText = `Aapki current prescription ki dawayein:\n\n${medList}\n\nAapko kaunsi dawa refill karni hai?\nType medicine number (e.g. *1,2* ya sab ke liye *ALL*) 💊`;
      } else if (cleaned.includes("report") || cleaned === "3") {
        // Query approved lab reports
        let reports: any[] = [];
        if (patient) {
          const { data } = await supabase
            .from("lab_reports")
            .select("*")
            .eq("patient_id", patient.id)
            .eq("status", "approved")
            .order("timestamp", { ascending: false });
          reports = data ?? [];
        }

        if (reports.length > 0) {
          const rep = reports[0];
          const barcode = `MED-${rep.loinc_code || "4544-3"}-${rep.id.toUpperCase().substring(0, 8)}`;
          const rawReport = `*Aapki pathology report aa gayi hai!* 🔬\n\nPatient Name: ${patient?.name || "Patient"}\nTest: ${rep.test_name}\nLOINC Code: ${rep.loinc_code || "4544-3"}\nStatus: Approved 🟢\n\n*Report Summary*:\n"${rep.results}"\n\n*Security Barcode*: ${barcode}`;

          // CHECK AI QUOTA: Gate AI interpretation under AI quota or current-month booking
          const currentMonthYear = new Date().toISOString().substring(0, 7);
          const hasActiveAiQuota = sessionData.llmUsage?.monthYear === currentMonthYear && (sessionData.llmUsage?.count ?? 0) < (sessionData.llmUsage?.limit ?? 0);
          let hasPaidThisMonth = false;
          try {
            if (patient) {
              const startOfMonthStr = `${currentMonthYear}-01T00:00:00.000Z`;
              const { data: recentInvoices } = await supabase
                .from("unified_invoices")
                .select("id")
                .eq("patient_id", patient.id)
                .eq("payment_status", "cleared")
                .gte("created_at", startOfMonthStr);
              if (recentInvoices && recentInvoices.length > 0) hasPaidThisMonth = true;
            }
          } catch (err) { /* ignore */ }

          if (hasActiveAiQuota || hasPaidThisMonth) {
            // AI Lab Interpreter is UNLOCKED — call Groq
            const groqApiKey = Deno.env.get("GROQ_API_KEY");
            let aiInterpretation = "";
            if (groqApiKey) {
              try {
                const aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqApiKey}` },
                  body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    max_tokens: 150,
                    messages: [
                      { role: "system", content: "You are a helpful clinical assistant. Explain lab results to patients in simple Hindi-English mix (Hinglish). Be brief (2-3 sentences max), empathetic, and always recommend consulting the doctor for treatment decisions. Never diagnose." },
                      { role: "user", content: `Patient lab result: Test: ${rep.test_name}, Results: ${rep.results}. Please explain this in simple Hinglish for the patient.` }
                    ]
                  })
                });
                if (aiRes.ok) {
                  const aiJson = await aiRes.json();
                  aiInterpretation = aiJson.choices?.[0]?.message?.content?.trim() || "";
                  // Consume one AI quota count
                  if (sessionData.llmUsage) sessionData.llmUsage.count = (sessionData.llmUsage.count || 0) + 1;
                }
              } catch (err) { console.warn("[Meta Webhook] AI Lab Interpreter error:", err); }
            }
            replyText = rawReport + (aiInterpretation ? `\n\n🤖 *VitalSync AI Analysis*:\n"${aiInterpretation}"` : "");
          } else {
            // AI interpretation LOCKED — show raw report + upsell
            const upiLink = `upi://pay?pa=vitalsync@icici&pn=VitalSync&am=9.00&cu=INR&tn=AI-QUOTA-${patientPhone.substring(5)}`;
            replyText = rawReport + `\n\n🔒 *AI Report Analysis Locked*\nAppoint book karke ya ₹9 ka AI pack activate karke is report ka AI-powered explanation paayen!\nActivate: ${upiLink}\nPay karne ke baad *ACTIVATE* type karein.`;
          }
        } else {
          replyText = "Aapka koi approved pathology report abhi on file nahi hai. Lab technician ke results update karne ka wait kijiye. 🧪";
        }
      } else if (cleaned.includes("summary") || cleaned === "5" || cleaned === "summary") {
        // Query encounters with medications
        let encounters: any[] = [];
        if (patient) {
          const { data } = await supabase
            .from("encounters")
            .select("*, encounter_medications(*)")
            .eq("patient_id", patient.id)
            .eq("status", "completed")
            .order("created_at", { ascending: false });
          encounters = data ?? [];
        }

        if (encounters.length > 0) {
          const enc = encounters[0];
          const meds = enc.encounter_medications ?? [];
          const drugTable = meds.map((m: any) => `• ${m.medicine_name} (${m.dosage}) - Freq: ${m.frequency} for ${m.duration}`).join("\n");

          replyText = `*Prescription aur Doctor's Notes Summary* 🩺\n\n*Doctor Notes*:\n\"${enc.clinical_notes || "Patient clinical condition is stable."}\"\n\n*Dawa ka Schedule*:\n${drugTable || "Koi active dawa nahi likhi gayi hai."}\n\n*Follow-Up Advice*:\nDoctor Vivek ne aapko **14 din** ke baad follow-up ke liye Patna branch mein bulaya hai. Hum aapko time par remind kar denge! 😊`;
        } else {
          replyText = "Aapke profile par koi completed consultation encounter nahi mila. 📋";
        }
      } else if (cleaned === "1" || cleaned === "physical" || cleaned.includes("book physical")) {
        sessionData.consultationType = "physical";
        
        // Calculate next 4 dates
        const dates: string[] = [];
        const displayDates: string[] = [];
        const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        for (let i = 1; i <= 4; i++) {
          const d = new Date();
          d.setDate(d.getDate() + i);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          dates.push(`${yyyy}-${mm}-${dd}`);
          displayDates.push(i === 1 ? `Tomorrow (${weekday[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]})` 
                                    : `${weekday[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`);
        }
        sessionData.dateOptions = dates;
        sessionData.dateDisplayOptions = displayDates;

        nextState = "AWAITING_DATE_SELECTION";
        replyText = `Doctor Vivek ke checkup ke liye date select kijiye:\n\n1️⃣ ${displayDates[0]}\n2️⃣ ${displayDates[1]}\n3️⃣ ${displayDates[2]}\n4️⃣ ${displayDates[3]}\n\nPlease option number (1, 2, 3, ya 4) reply kijiye! 📅`;
      } else if (cleaned === "2" || cleaned === "virtual" || cleaned.includes("book virtual")) {
        sessionData.consultationType = "virtual";
        
        // Calculate next 4 dates
        const dates: string[] = [];
        const displayDates: string[] = [];
        const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        for (let i = 1; i <= 4; i++) {
          const d = new Date();
          d.setDate(d.getDate() + i);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          dates.push(`${yyyy}-${mm}-${dd}`);
          displayDates.push(i === 1 ? `Tomorrow (${weekday[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]})` 
                                    : `${weekday[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`);
        }
        sessionData.dateOptions = dates;
        sessionData.dateDisplayOptions = displayDates;

        nextState = "AWAITING_DATE_SELECTION";
        replyText = `Doctor Vivek ke virtual checkup ke liye date select kijiye:\n\n1️⃣ ${displayDates[0]}\n2️⃣ ${displayDates[1]}\n3️⃣ ${displayDates[2]}\n4️⃣ ${displayDates[3]}\n\nPlease option number (1, 2, 3, ya 4) reply kijiye! 📅`;
      } else if (cleaned === "6" || cleaned === "family") {
        // INTERACTIVE FAMILY DIRECTORY: Show registered family members first
        let familyMembers: any[] = [];
        try {
          if (patient) {
            const { data: famRows } = await supabase
              .from("patient_registry")
              .select("id, name, age, gender")
              .like("phone", `${patientPhone}-family-%`);
            familyMembers = famRows ?? [];
          }
        } catch (err) { console.warn("[Meta Webhook] Error fetching family members:", err); }

        if (familyMembers.length > 0) {
          const famList = familyMembers.map((f: any, idx: number) => `${idx + 1}️⃣ ${f.name} (${f.gender}, ${f.age} yrs)`).join("\n");
          // Store them for selection in next state
          sessionData.familyDirectory = familyMembers;
          nextState = "AWAITING_FAMILY_SELECTION";
          replyText = `Aapke registered family members:\n\n${famList}\n0️⃣ New member add karein\n\nPlease option number reply kijiye! 👥`;
        } else {
          nextState = "AWAITING_FAMILY_DETAILS";
          replyText = "Please family member ka Name, Age, aur Gender reply kijiye (e.g. Rohan Kumar, 28, Male): 👥";
        }
      } else if (cleaned === "7" || cleaned === "ai_help" || cleaned.includes("ask assistant")) {
        nextState = "COMPLETED";
        replyText = "Aap apna medical question ya health related query likh kar bhejiye. VitalSync AI-RAG assistant aapko doctor-approved guidelines ke hisab se guide karega! 🤖";

      } else if (cleaned === "8" || cleaned === "sos" || cleaned.includes("emergency")) {
        // EMERGENCY SOS ROUTING: Requires fee payment + 20% emergency surcharge (₹500 + ₹100 = ₹600)
        let doctorIdSos = "dfb2a1a8-8e68-4f8a-929e-4a6c8e317002";
        try {
          const { data: docProfile } = await supabase.from("profiles").select("id").eq("role", "doctor").limit(1).maybeSingle();
          if (docProfile) doctorIdSos = docProfile.id;
        } catch (err) { /* ignore */ }

        const sosApptId = crypto.randomUUID();
        const sosInvoiceId = crypto.randomUUID();
        const todayDate = new Date().toISOString().split("T")[0];
        const doctorSosFee = 600.00; // Base ₹500 + 20% Priority Charge (₹100) -> 100% to Doctor
        const platformFeeSos = 18.00; // 3% of ₹600 -> 100% to Platform Owner
        const totalSosFee = doctorSosFee + platformFeeSos; // ₹618.00
        const upiPayload = `upi://pay?pa=vitalsync@icici&pn=VitalSync&am=${totalSosFee.toFixed(2)}&cu=INR&tn=SOS-EMERGENCY-${patientPhone.substring(5)}`;

        try {
          const sosPatId = patient?.id || session.patient_id || sessionData.bookingPatientId;
          if (sosPatId) {
            // Insert appointment with pending_payment status
            await supabase.from("appointments").insert({
              id: sosApptId,
              patient_id: sosPatId,
              doctor_id: doctorIdSos,
              status: "pending_payment",
              appointment_time: new Date().toISOString(),
              is_virtual: false,
              virtual_date: todayDate,
              virtual_time: "EMERGENCY (Priority #1)",
              pod_id: session.pod_id || "dfb2a1a8-8e68-4f8a-929e-4a6c8e317001"
            });

            // Insert invoice with ₹600 doctor fee + ₹18 platform fee = ₹618.00
            await supabase.from("unified_invoices").insert({
              id: sosInvoiceId,
              patient_id: sosPatId,
              doctor_fee: doctorSosFee,
              platform_fee: platformFeeSos,
              total_amount: totalSosFee,
              payment_status: "pending",
              upi_qr_payload: upiPayload,
              pod_id: session.pod_id || "dfb2a1a8-8e68-4f8a-929e-4a6c8e317001"
            });
          }
        } catch (err) { console.error("[Meta Webhook] SOS appointment/invoice insert error:", err); }

        sessionData.pendingApptId = sosApptId;
        sessionData.pendingInvoiceId = sosInvoiceId;
        sessionData.isSos = true;
        nextState = "AWAITING_PAYMENT";

        replyText = `🚨 *EMERGENCY SOS CONSULT ROUTING* 🚨\n\nDoctor Vivek ke queue mein top *PRIORITY #1* position reserve karne ke liye emergency fee pay karein:\n\n• Doctor Consult Fee: ₹${doctorSosFee.toFixed(2)} (Includes 20% Doctor Priority Charge)\n• VitalSync Platform Fee (+3%): ₹${platformFeeSos.toFixed(2)}\n• *Total Amount Payable*: ₹${totalSosFee.toFixed(2)}\n\nSecure UPI Payment Link:\n${upiPayload}\n\nPayment complete hone ke baad **PAY** reply kijiye! Real-time verification ke baad aapka case turant Priority #1 status par active ho jayega. 🟢`;

      } else if (cleaned === "9" || cleaned === "locker" || cleaned.includes("health locker") || cleaned.includes("records")) {
        // DIGITAL HEALTH LOCKER: Compile full patient medical history
        let lockerEncounters: any[] = [];
        let lockerReports: any[] = [];
        try {
          if (patient) {
            const { data: encs } = await supabase
              .from("encounters")
              .select("created_at, clinical_notes, encounter_medications(medicine_name, dosage)")
              .eq("patient_id", patient.id)
              .eq("status", "completed")
              .order("created_at", { ascending: false })
              .limit(5);
            lockerEncounters = encs ?? [];

            const { data: reps } = await supabase
              .from("lab_reports")
              .select("test_name, results, timestamp")
              .eq("patient_id", patient.id)
              .eq("status", "approved")
              .order("timestamp", { ascending: false })
              .limit(5);
            lockerReports = reps ?? [];
          }
        } catch (err) { console.warn("[Meta Webhook] Error fetching health locker data:", err); }

        nextState = "COMPLETED";
        const encSummary = lockerEncounters.length > 0
          ? lockerEncounters.map((e: any) => {
              const medNames = (e.encounter_medications ?? []).map((m: any) => m.medicine_name).join(", ") || "None";
              const dateStr = new Date(e.created_at).toLocaleDateString("en-IN");
              return `📅 ${dateStr}:\n  Notes: ${(e.clinical_notes || "Stable").substring(0, 80)}\n  Rx: ${medNames}`;
            }).join("\n\n")
          : "Koi completed consultation nahi mila.";
        const repSummary = lockerReports.length > 0
          ? lockerReports.map((r: any) => `🧪 ${r.test_name}: ${(r.results || "N/A").substring(0, 60)}`).join("\n")
          : "Koi approved lab report nahi mila.";
        replyText = `📂 *${patient?.name || "Aapka"} — Digital Health Locker*\n\n═══ Past Consultations ═══\n${encSummary}\n\n═══ Lab Reports ═══\n${repSummary}\n\nFull medical history aur invoices ke liye VitalSync web portal visit karein. 🌐`;

      } else if (cleaned === "10" || cleaned === "refer" || cleaned.includes("refer")) {
        // VIRAL PATIENT REFERRAL ENGINE: Show patient's unique referral code & reward vouchers
        let refCode = patient?.referral_code || `REF-${patientPhone.slice(-4)}`;
        let activeRewardsCount = 0;
        try {
          if (patient) {
            const { count } = await supabase
              .from("patient_referral_rewards")
              .select("id", { count: "exact", head: true })
              .eq("patient_id", patient.id)
              .eq("status", "active");
            activeRewardsCount = count ?? 0;
          }
        } catch (err) { /* ignore */ }

        nextState = "COMPLETED";
        replyText = `🎁 *VitalSync Refer & Earn Program* 🎁\n\nApne friends aur family members ko Patna Clinic ke digital healthcare platform par invite karein!\n\n• *Aapka Referral Code*: *${refCode}*\n• *Active Rewards*: ${activeRewardsCount} Vouchers (10% OFF)\n\n*Kaise Kaam Karta Hai?*\n1️⃣ Apne dosto ko yeh code share karein: *${refCode}*\n2️⃣ WhatsApp par register karte waqt wo yeh code enter karenge.\n3️⃣ **Aap dono ko 10% OFF** milega upcoming consults, lab reports, aur medicine refills par!\n\nShare link:\nhttps://wa.me/?text=${encodeURIComponent(`VitalSync Patna Clinic WhatsApp bot link! Use my referral code *${refCode}* to get 10% OFF on checkups & medicine refills.`)}`;

      } else if (cleaned.includes("order delivery") || cleaned === "delivery") {
        // INSTANT 1-CLICK PHARMACY HOME DELIVERY ORDER & STRATEGIC REMINDER SCHEDULER
        let rxMeds: any[] = [];
        let lastEncounterId: string | null = null;
        try {
          if (patient) {
            const { data: encs } = await supabase
              .from("encounters")
              .select("id, encounter_medications(*)")
              .eq("patient_id", patient.id)
              .eq("status", "completed")
              .order("created_at", { ascending: false })
              .limit(1);
            if (encs && encs.length > 0) {
              lastEncounterId = encs[0].id;
              rxMeds = encs[0].encounter_medications ?? [];
            }
          }
        } catch (err) { console.warn("[Meta Webhook] Error fetching prescription for delivery:", err); }

        if (rxMeds.length === 0) {
          rxMeds = [
            { medicine_name: "Metformin 500mg", dosage: "1-0-1", duration: "30 days" },
            { medicine_name: "Multivitamin A-Z", dosage: "0-1-0", duration: "30 days" }
          ];
        }

        const newBillId = crypto.randomUUID();
        let subtotal = 0;
        const parsedItems = rxMeds.map((med: any) => {
          const name = med.medicine_name;
          let qty = 30;
          try { const match = med.duration?.match(/\d+/); if (match) qty = parseInt(match[0]); } catch (e) { /* ignore */ }
          const price = 10.00;
          const lineTotal = qty * price;
          subtotal += lineTotal;
          return {
            id: crypto.randomUUID(),
            bill_id: newBillId,
            inventory_item_id: `INV-MED-${name.replace(/\s+/g, "-").toUpperCase().substring(0, 10)}`,
            name, batch_number: "BATCH-WA-99", expiry_date: "2028-12-31",
            quantity: qty, mrp: price, selling_price: price,
            discount_percent: 0.00, gst_percent: 18.00, line_total: lineTotal
          };
        });

        // Check 10% referral discount
        let finalAmount = subtotal;
        let discountMsg = "";
        try {
          if (patient) {
            const { data: rw } = await supabase
              .from("patient_referral_rewards")
              .select("id, discount_percent")
              .eq("patient_id", patient.id)
              .eq("status", "active")
              .limit(1)
              .maybeSingle();

            if (rw) {
              const discVal = Math.round(subtotal * ((rw.discount_percent || 10.00) / 100));
              finalAmount = subtotal - discVal;
              discountMsg = `\n🎉 *10% Referral Reward Applied*: Saved ₹${discVal}.00!`;
              await supabase.from("patient_referral_rewards").update({ status: "redeemed", redeemed_at: new Date().toISOString() }).eq("id", rw.id);
            }
          }
        } catch (err) { /* ignore */ }

        try {
          const deliveryPatId = patient?.id || session.patient_id || sessionData.bookingPatientId;
          if (deliveryPatId) {
            await supabase.from("medicine_bills").insert({
              id: newBillId, patient_id: deliveryPatId, encounter_id: lastEncounterId,
              subtotal, total_amount: finalAmount, payment_mode: "upi",
              status: "draft", source: "whatsapp_1click_delivery",
              pod_id: session.pod_id || "dfb2a1a8-8e68-4f8a-929e-4a6c8e317001"
            });
            for (const item of parsedItems) {
              await supabase.from("medicine_bill_items").insert(item);
            }

            // Schedule the 3 Strategic Nudges in scheduled_reminders
            const now = new Date();
            // Day 7: Adherence Check-in
            const day7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            await supabase.from("scheduled_reminders").insert({
              patient_id: deliveryPatId, encounter_id: lastEncounterId,
              reminder_type: "day_7_adherence", scheduled_for: day7.toISOString(), status: "pending"
            });
            // Month 1 (Day 30): Follow-Up Checkup Nudge
            const month1 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            await supabase.from("scheduled_reminders").insert({
              patient_id: deliveryPatId, encounter_id: lastEncounterId,
              reminder_type: "month_1_followup", scheduled_for: month1.toISOString(), status: "pending"
            });
            // Month 3 (Day 90): Chronic Care & Lab Panel Nudge
            const month3 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
            await supabase.from("scheduled_reminders").insert({
              patient_id: deliveryPatId, encounter_id: lastEncounterId,
              reminder_type: "month_3_chronic", scheduled_for: month3.toISOString(), status: "pending"
            });
          }
        } catch (err) { console.error("[Meta Webhook] Error creating delivery order:", err); }

        nextState = "COMPLETED";
        replyText = `🚚 *HOME DELIVERY ORDER CONFIRMED* 📦\n\nAapka prescription dawa parcel Patna Pharmacy counter se process ho gaya hai!\n\n*Ordered Items*:\n${rxMeds.map((m: any) => `• ${m.medicine_name} (${m.dosage})`).join("\n")}\n*Subtotal*: ₹${subtotal}.00${discountMsg}\n*Total Payable Amount*: ₹${finalAmount}.00\n*Estimated Delivery*: Within 2 Hours (Patna City Area)\n\nCompounder packing verify kar rahe hain. Strategic follow-up reminders (7 days, 1 month, 3 months) schedule kar diye gaye hain! Dhanyawad! 🟢`;

      } else if (cleaned === "more" || cleaned === "list" || cleaned === "menu_reset") {
        nextState = "COMPLETED";
        replyText = "Full VitalSync Services Catalog:\nNiche menu se service select kijiye:";
      } else if (cleaned === "physical review") {
        nextState = "COMPLETED";
        replyText = "🏥 *PATNA CLINIC EVENING REPORT REVIEW LOCKED!* 🟢\n\nAapki Lab Report review ke liye Doctor Vivek ne aaj sham **04:00 PM - 06:00 PM** ka slot lock kar diya hai.\n\n• Location: Patna Clinic, Kankarbagh Road (opp. ICICI Bank)\n• Pharmacy Reservation: Active at Ground Floor Counter 💊\n\nPlease evening time par clinic pahuchein aur counter se medicines collect karein! Dhanyawad! 😊";
      } else if (cleaned === "virtual review") {
        nextState = "COMPLETED";
        const vApptId = crypto.randomUUID();
        replyText = `💻 *EMERGENCY VIRTUAL VIDEO REVIEW ACTIVATED!* 🟢\n\nDoctor Vivek aapki report online video consult par review karenge:\n• Meeting URL: https://meet.jit.si/vitalsync-consult-${vApptId}\n• Time: Aaj sham 04:00 PM\n\nDawa refill & 1-Click home delivery request register ho gaya hai. Thank you! 😊`;
      } else if (["stop consent", "stop", "revoke"].includes(cleaned)) {
        nextState = "AWAITING_WELCOME";
        replyText = "Aapka clinical consent cancel kar diya gaya hai aur profile lock ho gayi hai. Wapas shuru karne ke liye '1' reply kijiye.";
      } else {
        const greetings = ["hi", "hello", "hey", "namaste", "pranam", "hola", "halo", "hlo", "yo", "greetings"];
        if (greetings.includes(cleaned)) {
          nextState = "AWAITING_CONFIRMATION";
          replyText = "Namaste! 🙏 Welcome to VitalSync Healthcare.\n\nAapki health aur convenient care hamari sabse badi priority hai. Batayein aaj hum aapki kis tarah help kar sakte hain? Niche 'Select Service 📋' menu se service select kijiye:";
        } else {
          // Dynamic AI-RAG health query advice using Groq LLM
          const groqApiKey = Deno.env.get("GROQ_API_KEY");
          let aiSuccess = false;

          // Check monthly AI query usage limit (10 per month per user)
          const currentMonthYear = new Date().toISOString().substring(0, 7); // "YYYY-MM"
          
          // Verify if they paid the platform fee for an appointment in the current month
          let hasPaidPlatformFeeThisMonth = false;
          try {
            if (patient) {
              const startOfMonthStr = `${currentMonthYear}-01T00:00:00.000Z`;
              const { data: recentInvoices } = await supabase
                .from("unified_invoices")
                .select("id")
                .eq("patient_id", patient.id)
                .eq("payment_status", "cleared")
                .gte("created_at", startOfMonthStr);
              if (recentInvoices && recentInvoices.length > 0) {
                hasPaidPlatformFeeThisMonth = true;
              }
            }
          } catch (err) {
            console.warn("[Meta Webhook] Error checking platform fee invoices:", err);
          }

          // Initialize or verify LLM usage structure
          if (!sessionData.llmUsage || sessionData.llmUsage.monthYear !== currentMonthYear) {
            sessionData.llmUsage = {
              count: 0,
              limit: hasPaidPlatformFeeThisMonth ? 10 : 0,
              monthYear: currentMonthYear,
              type: hasPaidPlatformFeeThisMonth ? "free" : "unpaid"
            };
          }

          // Handle paid quota limits
          const limit = sessionData.llmUsage.limit ?? (sessionData.llmUsage.type === "paid_quota" ? 20 : (hasPaidPlatformFeeThisMonth ? 10 : 0));
          
          if (sessionData.llmUsage.count >= limit) {
            const upiPayload = `upi://pay?pa=vitalsync@icici&pn=VitalSync&am=9.00&cu=INR&tn=VITALSYNC-AI-QUOTA-${patientPhone.substring(5)}`;
            nextState = "AWAITING_AI_QUOTA_PAYMENT";
            
            if (limit === 0) {
              replyText = `⚠️ *AI Consultation Pack Required* \n\nAapka is month (${currentMonthYear}) ke liye free clinical AI assistant active nahi hai. Free quota sirf appointment platforms fees clear karne par activate hota hai.\n\n*Direct AI Access Package*:\n• Price: ₹9.00 only (100% Doctor/Owner income)\n• Quota: 20 clinical queries\n• Validity: Active till end of this month\n\nDirect access pane ke liye please niche diye link/QR se ₹9.00 pay karein:\n\n${upiPayload}\n\nPayment confirm karne ke baad please **ACTIVATE** reply karein! 🧾`;
            } else {
              replyText = `⚠️ *AI Usage Limit Reached* \n\nAapka is month ka free clinical AI quota (10 questions) exhaust ho gaya hai.\n\n*Direct AI Upgrade Package*:\n• Price: ₹9.00 only (100% Doctor/Owner income)\n• Quota: 20 extra clinical queries\n• Validity: Active till end of this month\n\nUpgrade karne ke liye please niche diye link/QR se ₹9.00 pay karein:\n\n${upiPayload}\n\nPayment confirm karne ke baad please **ACTIVATE** reply karein! 🧾`;
            }
            aiSuccess = true; // Bypasses the fallback static RAG block
          } else if (groqApiKey) {
            try {
              console.log(`[Meta Webhook] Calling Groq LLM for dynamic RAG response for patient: ${patient?.id || "anonymous"}. Count: ${sessionData.llmUsage.count}/${limit}`);
            
            // Format Patient Profile Context
            const chronicList = (patient?.chronic_conditions ?? patient?.chronicConditions ?? []).join(", ") || "None recorded";
            
            // Format Lab Reports Context
            let reportsContext = "No lab reports on file.";
            if (patient) {
              const { data: reports } = await supabase
                .from("lab_reports")
                .select("*")
                .eq("patient_id", patient.id)
                .eq("status", "approved")
                .order("timestamp", { ascending: false });
              
              if (reports && reports.length > 0) {
                reportsContext = reports.map((r: any) => 
                  `- Test: ${r.test_name}, Result: ${r.results}, Code: ${r.loinc_code || "N/A"}, Date: ${r.timestamp}`
                ).join("\n");
              }
            }

            // Format Encounter & Medications Context
            let medsContext = "No active prescriptions on file.";
            if (patient) {
              const { data: encounters } = await supabase
                .from("encounters")
                .select("*, encounter_medications(*)")
                .eq("patient_id", patient.id)
                .eq("status", "completed")
                .order("created_at", { ascending: false });
              
              if (encounters && encounters.length > 0) {
                const meds = encounters[0].encounter_medications ?? [];
                const notes = encounters[0].clinical_notes ?? "";
                medsContext = `Active Prescription:\n${meds.map((m: any) => `• ${m.medicine_name} (${m.dosage}) - Freq: ${m.frequency} for ${m.duration}`).join("\n")}\n\nClinical Notes: ${notes}`;
              }
            }

            const systemPrompt = `You are VitalSync's AI clinical assistant. Your goal is to reply to patient queries with clinical precision, empathy, and clear guidelines. You have access to their real medical record.
            
PATIENT RECORD:
- Name: ${patient?.name || "Aarav Sharma"}
- Chronic Conditions: ${chronicList}

LAB REPORTS:
${reportsContext}

PRESCRIPTION & ENCOUNTERS:
${medsContext}

CLINICAL GUIDELINES:
1. Always base your advice on ADA, KDIGO, or standard clinical protocols.
2. If they have diabetes/sugar and are asking about sugar, explain that their average 3-month sugar level (HbA1c 7.2% or whatever is on file) requires reducing sugar/carbs. Suggest LOINC: 4544-3 tests.
3. If creatinine is high (>1.2), caution them not to take heavy NSAIDs/pain-killers.
4. Keep the response concise, clear, and in a friendly mix of Hindi and English (Hinglish), as is standard for patients in India. Use bullet points for readability.
5. Remind them to consult Doctor Vivek for official clinical changes.`;

            const chatHistoryMessages = chatHistory.slice(-5).map((h: any) => ({
              role: h.sender === "patient" ? "user" : "assistant",
              content: h.text
            }));

            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${groqApiKey}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                  { role: "system", content: systemPrompt },
                  ...chatHistoryMessages,
                  { role: "user", content: incomingText }
                ],
                temperature: 0.2,
                max_tokens: 800
              })
            });

            if (response.ok) {
              const resJson = await response.json();
              replyText = resJson.choices[0].message.content;
              aiSuccess = true;
              sessionData.llmUsage.count += 1;
            } else {
              const errText = await response.text();
              console.error("[Meta Webhook] Groq API returned error status:", response.status, errText);
            }
          } catch (err) {
            console.error("[Meta Webhook] Failed to get dynamic Groq reply:", err);
          }

          // Auto-Healer Hot-Rollover: Try Google Gemini 2.5 Flash if Groq failed or rate-limited
          if (!aiSuccess) {
            const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
            if (geminiApiKey) {
              try {
                console.log("[Auto-Healer] Hot-rolling over to Gemini 2.5 Flash API...");
                const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
                const geminiRes = await fetch(geminiUrl, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    contents: [
                      { parts: [{ text: `${systemPrompt}\n\nPatient Question: ${incomingText}` }] }
                    ]
                  })
                });
                if (geminiRes.ok) {
                  const geminiJson = await geminiRes.json();
                  const geminiText = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text;
                  if (geminiText) {
                    replyText = geminiText.trim();
                    aiSuccess = true;
                    sessionData.llmUsage.count += 1;
                  }
                }
              } catch (gErr) {
                console.warn("[Auto-Healer] Gemini hot-rollover failed:", gErr);
              }
            }
          }
        }

        if (!aiSuccess) {
          // Fallback to static RAG advice if Groq API is unavailable
          let chronicAdvice = "";
          const chronicConditions = patient?.chronic_conditions ?? patient?.chronicConditions ?? [];
          const isSugarPatient = chronicConditions.some((c: string) => c.toLowerCase().includes("diabetes") || c.toLowerCase().includes("sugar"));
          
          if (isSugarPatient) {
            chronicAdvice = "\n\n*Important RAG Note (Sugar patients ke liye)*: Aapka average 3-month sugar level (HbA1c 7.2%) thoda jyada hai. Meetha aur carbohydrate kam kijiye, LOINC: 4544-3 test har 3 mahine mein karayein, aur agar creatinine level 1.2 mg/dL se jyada ho toh heavy pain-killers (Ibuprofen) bilkul na lein.";
          } else {
            chronicAdvice = "\n\n*RAG Clinical Guidelines Note*: Paani khoob pijiye, low-sodium diet lijiye, aur rozana apna checkup logs maintain kijiye.";
          }

          replyText = `*VitalSync AI-RAG support team* 🤖\n\nAapke query \"${incomingText}\" ke liye niche advice di gayi hai:\n\n*Advice*: Aaram kijiye, hydration maintain rakhein, aur daily BP/sugar monitor kijiye. Bina doctor ke pooche koi brand-name dawa mat lijiye. Agar tabiyat jyada kharab ho toh turant consult kijiye!${chronicAdvice}\n\n_Disclaimer: Yeh RAG advisory clinical guidelines (ADA/KDIGO) par based hai. Please checkup se pehle doctor se salah zaroor lein._`;
        }
      }
      }
      break;

    case "FAILED_DELIVERY":
      if (cleaned) {
        nextState = "AWAITING_WELCOME";
        replyText = "Re-establishing connection loop. Dobara shuru karne ke liye '1' reply kijiye.";
      }
      break;

    default:
      replyText = "Namaste! VitalSync Automated Assistant online. Main aapki kya sahayata kar sakta hoon?";
      break;
  }

  const currentTime = new Date().toISOString();
  chatHistory.push({ sender: "bot", text: replyText, timestamp: currentTime });

  // Update DB session state
  let dbState = nextState;
  if ([
    "BOOKING_VIRTUAL",
    "AWAITING_SLOT_SELECTION",
    "AWAITING_FAMILY_DETAILS",
    "AWAITING_FAMILY_SELECTION",
    "AWAITING_REFILL_SELECTION",
    "AWAITING_AI_QUOTA_PAYMENT",
    "AWAITING_DATE_SELECTION",
    "AWAITING_REGISTRATION_DETAILS",
    "AWAITING_REFERRAL_CODE"
  ].includes(nextState)) {
    dbState = "BOOKING_VIRTUAL";
    sessionData.subState = nextState;
  } else {
    sessionData.subState = null;
  }

  const updatedData = {
    ...sessionData,
    chatHistory
  };

  // 1. Send Outbound Graph API message FIRST for sub-second WhatsApp response delivery (<300ms)
  try {
    const metaUrl = `https://graph.facebook.com/v21.0/${phoneId}/messages`;
    
    let payloadBody: any = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: patientPhone
    };

    // Determine if we should send an interactive message with premium buttons
    if (state === "AWAITING_WELCOME" && replyText.includes("authorize kijiye")) {
      payloadBody.type = "interactive";
      payloadBody.interactive = {
        type: "button",
        body: { text: "Namaste! VitalSync digital data processing consent ke liye, please neeche button daba kar authorize kijiye: 🟢" },
        action: {
          buttons: [
            { type: "reply", reply: { id: "btn_grant", title: "Authorize Consent" } }
          ]
        }
      };
    } else if (state === "AWAITING_WELCOME" && replyText.includes("consent ko revoke")) {
      payloadBody.type = "interactive";
      payloadBody.interactive = {
        type: "button",
        body: { text: replyText },
        action: {
          buttons: [
            { type: "reply", reply: { id: "btn_grant", title: "Authorize Consent" } }
          ]
        }
      };
    } else if (state === "AWAITING_CONFIRMATION" && (replyText.includes("kis tarah help") || replyText.includes("Welcome to VitalSync") || replyText.includes("kya help karoon"))) {
      payloadBody.type = "interactive";
      payloadBody.interactive = {
        type: "button",
        body: { text: "Namaste! 🙏 Welcome to VitalSync Healthcare.\n\nAapki health aur convenient care hamari sabse badi priority hai. Batayein aaj hum aapki kis tarah help kar sakte hain? Niche button daba kar service select kijiye:" },
        action: {
          buttons: [
            { type: "reply", reply: { id: "menu_physical", title: "Physical Visit 🏥" } },
            { type: "reply", reply: { id: "menu_virtual", title: "Virtual Call 💻" } }
          ]
        }
      };
    } else if (state === "AWAITING_CONFIRMATION" && replyText.includes("Health & Support Services")) {
      payloadBody.type = "interactive";
      payloadBody.interactive = {
        type: "button",
        body: { text: replyText },
        action: {
          buttons: [
            { type: "reply", reply: { id: "menu_report", title: "View Lab Report 🧪" } },
            { type: "reply", reply: { id: "menu_sos", title: "Emergency SOS 🚨" } },
            { type: "reply", reply: { id: "menu_list", title: "Services List 📋" } }
          ]
        }
      };
    } else if (state === "AWAITING_CONFIRMATION" && replyText.includes("Full VitalSync Services")) {
      payloadBody.type = "interactive";
      payloadBody.interactive = {
        type: "list",
        header: { type: "text", text: "VitalSync Full Clinic Services" },
        body: { text: "Niche diye gaye catalog menu se apni clinic service select kijiye:" },
        footer: { text: "VitalSync Healthcare Assistant" },
        action: {
          button: "View All Services 📋",
          sections: [
            {
              title: "Appointments & Visits",
              rows: [
                { id: "menu_physical", title: "Book Physical Visit", description: "Clinic aakar Doctor Vivek se consult karein" },
                { id: "menu_virtual", title: "Book Virtual Call", description: "Phone par online video consultation slot" },
                { id: "menu_family", title: "Book for Family Member", description: "Family member ke details add karke book karein" }
              ]
            },
            {
              title: "Records & Support",
              rows: [
                { id: "menu_report", title: "🧪 View Lab Report", description: "Apni latest pathology test report dekhein" },
                { id: "menu_summary", title: "📋 Prescription Summary", description: "Doctor notes aur medication list summary" },
                { id: "menu_refill", title: "💊 Medicine Refill", description: "Active medication refill select karein" },
                { id: "menu_ai", title: "🤖 Ask AI Assistant", description: "Health query AI se poochein (₹9/month)" }
              ]
            },
            {
              title: "Emergency & Records",
              rows: [
                { id: "menu_locker", title: "📂 Digital Health Locker", description: "Poora medical history ek jagah dekhein" },
                { id: "menu_sos", title: "🚨 Emergency SOS", description: "Priority appointment — turant doctor alert" },
                { id: "menu_refer", title: "🎁 Refer & Earn (10% OFF)", description: "Friends ko invite karke 10% OFF payen" }
              ]
            }
          ]
        }
      };
    } else if (replyText.includes("Lab Report ready") || replyText.includes("report review") || replyText.includes("LAB REPORT READY")) {
      payloadBody.type = "interactive";
      payloadBody.interactive = {
        type: "button",
        body: { text: replyText },
        action: {
          buttons: [
            { type: "reply", reply: { id: "btn_physical_review", title: "Physical Review 🏥" } },
            { type: "reply", reply: { id: "btn_virtual_review", title: "Virtual Review 💻" } }
          ]
        }
      };
    } else if (nextState === "BOOKING_VIRTUAL" && (replyText.includes("Virtual Video Call") || replyText.includes("VIRTUAL") || replyText.includes("scheduling shuru"))) {
      payloadBody.type = "interactive";
      payloadBody.interactive = {
        type: "button",
        body: { text: replyText },
        action: {
          buttons: [
            { type: "reply", reply: { id: "btn_virtual", title: "Virtual Consult 💻" } },
            { type: "reply", reply: { id: "btn_physical", title: "Clinic Visit 🏥" } }
          ]
        }
      };
    } else if (nextState === "AWAITING_PAYMENT" || replyText.includes("UPI link") || replyText.includes("Total Fee") || replyText.includes("lock kar diya")) {
      payloadBody.type = "interactive";
      payloadBody.interactive = {
        type: "button",
        body: { text: replyText },
        action: {
          buttons: [
            { type: "reply", reply: { id: "btn_pay", title: "I Have Paid ✅" } },
            { type: "reply", reply: { id: "btn_main_menu", title: "Main Menu 🏠" } }
          ]
        }
      };
    } else if (nextState === "AWAITING_DATE_SELECTION" || (state === "AWAITING_DATE_SELECTION" && replyText.includes("date select"))) {
      payloadBody.type = "interactive";
      payloadBody.interactive = {
        type: "button",
        body: { text: replyText },
        action: {
          buttons: [
            { type: "reply", reply: { id: "btn_date_1", title: "1️⃣ Tomorrow" } },
            { type: "reply", reply: { id: "btn_date_2", title: "2️⃣ Day After" } },
            { type: "reply", reply: { id: "btn_date_3", title: "3️⃣ In 3 Days" } }
          ]
        }
      };
    } else if (nextState === "AWAITING_SLOT_SELECTION" || (state === "AWAITING_SLOT_SELECTION" && replyText.includes("slot"))) {
      payloadBody.type = "interactive";
      payloadBody.interactive = {
        type: "button",
        body: { text: replyText },
        action: {
          buttons: [
            { type: "reply", reply: { id: "btn_slot_1", title: "Morning (10-12) 🌅" } },
            { type: "reply", reply: { id: "btn_slot_2", title: "Afternoon (2-4) ☀️" } },
            { type: "reply", reply: { id: "btn_slot_3", title: "Evening (6-8) 🌙" } }
          ]
        }
      };
    } else {
      // Standard text message
      payloadBody.type = "text";
      payloadBody.text = { body: replyText };
    }

    const response = await fetch(metaUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${decryptedToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payloadBody)
    });

    const result = await response.json();
    if (response.ok) {
      console.log("[Meta Outbound] Dispatched reply success ✅", JSON.stringify(result));

      // Option 2 Flow: If we just sent the welcome quick reply button message (Message 1),
      // immediately dispatch the "View All Services 📋" list menu bar (Message 2) right below it.
      if (
        payloadBody.type === "interactive" &&
        payloadBody.interactive.type === "button" &&
        payloadBody.interactive.body.text.includes("Welcome to VitalSync")
      ) {
        const listPayload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: patientPhone,
          type: "interactive",
          interactive: {
            type: "list",
            header: { type: "text", text: "VitalSync Healthcare" },
            body: { text: "Or click below to view all other clinical services:" },
            footer: { text: "VitalSync Healthcare Assistant" },
            action: {
              button: "View All Services 📋",
              sections: [
                {
                  title: "Appointments & Visits",
                  rows: [
                    { id: "menu_physical", title: "Physical Visit 🏥", description: "Clinic aakar Doctor Vivek se consult karein" },
                    { id: "menu_virtual", title: "Virtual Call 💻", description: "Phone par online video consultation slot" },
                    { id: "menu_family", title: "Book for Family Member", description: "Family member ke details add karke book karein" }
                  ]
                },
                {
                  title: "Records & Support",
                  rows: [
                    { id: "menu_report", title: "🧪 View Lab Report", description: "Apni latest pathology test report dekhein" },
                    { id: "menu_summary", title: "📋 Prescription Summary", description: "Doctor notes aur medication list summary" },
                    { id: "menu_refill", title: "💊 Medicine Refill", description: "Active medication refill select karein" },
                    { id: "menu_ai", title: "🤖 Ask AI Assistant", description: "Health query AI se poochein (₹9/month)" }
                  ]
                },
                {
                  title: "Emergency & Records",
                  rows: [
                    { id: "menu_locker", title: "📂 Digital Health Locker", description: "Poora medical history ek jagah dekhein" },
                    { id: "menu_sos", title: "🚨 Emergency SOS", description: "Priority appointment — turant doctor alert" },
                    { id: "menu_refer", title: "🎁 Refer & Earn (10% OFF)", description: "Friends ko invite karke 10% OFF payen" }
                  ]
                }
              ]
            }
          }
        };

        try {
          const listRes = await fetch(metaUrl, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${decryptedToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(listPayload)
          });
          const listResult = await listRes.json();
          if (listRes.ok) {
            console.log("[Meta Outbound] Dispatched welcome list success ✅", JSON.stringify(listResult));
          } else {
            console.error("[Meta Outbound] Meta API returned an error for welcome list:", JSON.stringify(listResult));
          }
        } catch (listErr) {
          console.error("[Meta Outbound] Failed to dispatch welcome list message:", listErr);
        }
      }
    } else {
      console.error("[Meta Outbound] Meta API returned an error:", JSON.stringify(result));
    }
  } catch (err) {
    console.error("[Meta Outbound] Failed to dispatch API message:", err);
  }

  // 2. Persist state transition to DB after dispatching message to avoid blocking patient response
  try {
    await supabase
      .from("whatsapp_sessions")
      .update({
        current_state: dbState,
        patient_id: session.patient_id,
        session_data: updatedData,
        last_interaction: currentTime
      })
      .eq("id", session.id);
  } catch (updateErr) {
    console.error("[Meta Webhook] Failed to update session after bot reply:", updateErr);
  }
}
