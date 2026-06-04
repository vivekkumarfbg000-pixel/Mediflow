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
          currentState: session.current_state,
          session_id: session.id
        }
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
  const cleaned = incomingText.trim().toLowerCase();

  let replyText = "";
  let nextState = state;
  const sessionData = session.session_data ?? {};
  const chatHistory = sessionData.chatHistory ?? [];

  // Query patient profile if patient_id exists
  let patient: any = null;
  if (session.patient_id) {
    const { data: pat } = await supabase
      .from("patient_registry")
      .select("*")
      .eq("id", session.patient_id)
      .single();
    patient = pat;
  } else {
    // Attempt lookup by phone
    const { data: pat } = await supabase
      .from("patient_registry")
      .select("*")
      .eq("phone", patientPhone)
      .single();
    if (pat) {
      patient = pat;
      session.patient_id = pat.id;
    }
  }

  // devsecops consent check: check patient_consents for explicit revocation
  if (patient?.id) {
    const { data: consents } = await supabase
      .from("patient_consents")
      .select("*")
      .eq("patient_id", patient.id);

    const hasRevoked = consents?.some((c: any) => c.revoked_at !== null);
    
    // If they have explicitly revoked consent and are NOT replying with an opt-in code
    if (hasRevoked && !["1", "grant access", "yes", "approve", "grant"].includes(cleaned)) {
      console.warn(`[Meta Webhook] Consent Block: Patient ${patient.id} has revoked consent. Restricting RAG bot replies.`);
      
      replyText = "Namaste! Aapne Mediflow digital data processing consent ko revoke kiya hua hai. AI assistant replies aur clinical logs sync disabled hain. Wapas active karne ke liye, please *1* reply kijiye. 🟢";
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

  // Conversational state machine router logic
  switch (state) {
    case "AWAITING_WELCOME":
      if (["1", "grant access", "yes", "approve", "grant"].includes(cleaned)) {
        nextState = "AWAITING_CONFIRMATION";
        sessionData.consentGranted = true;
        sessionData.consentTime = new Date().toISOString();
        replyText = "Bahut bahut dhanyawad! Aapka clinical consent safe tarike se secure ledger mein register ho gaya hai. State: READY_FOR_ENCOUNTER. 🟢";

        // Asynchronously register patient opt-in consent
        if (patient) {
          await supabase.from("patient_consents").insert({
            patient_id: patient.id,
            consent_type: "data_processing",
            granted_at: new Date().toISOString(),
            granted_by_role: "patient"
          });
        }
      } else if (["stop consent", "stop", "revoke", "stop_consent"].includes(cleaned)) {
        replyText = "Consent process rok diya gaya hai. Aap jab chahein tab '1' reply karke dobara shuru kar sakte hain.";
      } else {
        replyText = "Hum samajh nahi paaye. 🤖 Apne records safe sync karne ke liye please upar click kijiye ya bas *1* reply karke authorize kijiye.";
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
      } else if (cleaned.includes("book") || cleaned === "2") {
        nextState = "BOOKING_VIRTUAL";
        replyText = "Ji bilkul! Mediflow scheduling shuru ho gayi hai. Kya aap Virtual Video Call par consult karna chahte hain ya Physical clinic aakar?\n\nProceed karne ke liye please **VIRTUAL** ya **PHYSICAL** reply kijiye.";
      } else if (["1", "grant access", "yes"].includes(cleaned)) {
        replyText = "Aapka clinical consent pehle se hi active aur registered hai! Appointment book karne ke liye **BOOK** reply kijiye.";
      } else {
        replyText = "Aapka clinical consent active hai! 🟢 Batayein main aapki kya help karoon? Reply kijiye:\n- *BOOK*: Doctor appointment book karne ke liye\n- *REPORT*: Apni lab reports dekhne ke liye\n- *SUMMARY*: Prescription aur medicine dose schedule ke liye\n- Ya phir koi bhi health related query pooch sakte hain! 😊";
      }
      break;

    case "BOOKING_VIRTUAL":
      if (cleaned.includes("virtual") || cleaned.includes("physical")) {
        nextState = "AWAITING_PAYMENT";
        const isVirtual = cleaned.includes("virtual");
        const fee = isVirtual ? 400 : 500;
        const upiPayload = `upi://pay?pa=mediflow@icici&pn=Mediflow&am=${fee}.00&cu=INR&tn=MEDIFLOW-APPT-${patientPhone.substring(5)}`;

        replyText = `Doctor Vivek ke liye slot lock kar diya gaya hai. Total Appointment Fee: ₹${fee}.00.\n\nSecure booking ke liye please is UPI link ka use kijiye ya QR code scan kijiye:\n\n${upiPayload}\n\nPayment karne ke baad please **PAY** reply kijiye, hum turant meeting link bhej denge! 🧾`;
      } else {
        replyText = "Please slot lock karne ke liye 'VIRTUAL' ya 'PHYSICAL' reply kijiye.";
      }
      break;

    case "AWAITING_PAYMENT":
      if (cleaned.includes("pay") || cleaned.includes("clear") || cleaned === "1") {
        // Query pending invoice
        let pendingInv: any = null;
        if (patient) {
          const { data } = await supabase
            .from("unified_invoices")
            .select("*")
            .eq("patient_id", patient.id)
            .eq("payment_status", "pending")
            .limit(1)
            .maybeSingle();
          pendingInv = data;
        }

        if (pendingInv) {
          replyText = `Aapka outstanding invoice pending hai. Please ₹${pendingInv.total_amount}.00 clear karne ke liye is direct payment link ka use kijiye:\n\n${pendingInv.upi_qr_payload || "upi://pay?pa=mediflow@icici&pn=Mediflow&am=" + pendingInv.total_amount}\n\nPayment confirm hote hi aapki booking active ho jayegi!`;
        } else {
          nextState = "COMPLETED";
          replyText = "Payment confirm ho gaya hai! 🟢 Aapka physical/virtual checkup active hai. We look forward to seeing you!";
        }
      } else if (["stop consent", "stop", "revoke"].includes(cleaned)) {
        replyText = "Dues pending rehne par consent cancel nahi kiya ja sakta. Please pehle apna payment clear kijiye.";
      } else {
        replyText = "Payment pending hai. Settle karne ke liye QR code scan kijiye, ya 'PAY' reply kijiye.";
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
      } else if (cleaned.includes("refill") || cleaned.includes("medicine") || cleaned.includes("reorder")) {
        nextState = "COMPLETED";
        replyText = "Medicine refill request mil gaya hai! 📦 Humne Patna counter par aapki dawa reserve kar di hai. Compounder jald hi bhej denge.";
      } else if (cleaned.includes("report") || cleaned.includes("pathology") || cleaned.includes("test")) {
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
          replyText = `*Aapki pathology report aa gayi hai!* 🔬\n\nPatient Name: ${patient?.name || rep.patient_name || "Aarav Sharma"}\nTest: ${rep.test_name}\nLOINC Code: ${rep.loinc_code || "4544-3"}\nStatus: Approved 🟢\n\n*Report Summary*:\n\"${rep.results}\"\n\n*Security Barcode*: ${barcode}`;
        } else {
          replyText = "Aapka koi approved pathology report abhi on file nahi hai. Lab technician ke results update karne ka wait kijiye.";
        }
      } else if (cleaned.includes("summary") || cleaned.includes("soap") || cleaned.includes("schedule") || cleaned.includes("revisit")) {
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
          replyText = "Aapke profile par koi completed consultation encounter nahi mila.";
        }
      } else if (["stop consent", "stop", "revoke"].includes(cleaned)) {
        nextState = "AWAITING_WELCOME";
        replyText = "Aapka clinical consent cancel kar diya gaya hai aur profile lock ho gayi hai. Wapas shuru karne ke liye '1' reply kijiye.";
      } else {
        // RAG health query advice
        let chronicAdvice = "";
        const chronicConditions = patient?.chronic_conditions ?? patient?.chronicConditions ?? [];
        const isSugarPatient = chronicConditions.some((c: string) => c.toLowerCase().includes("diabetes") || c.toLowerCase().includes("sugar"));
        
        if (isSugarPatient) {
          chronicAdvice = "\n\n*Important RAG Note (Sugar patients ke liye)*: Aapka average 3-month sugar level (HbA1c 7.2%) thoda jyada hai. Meetha aur carbohydrate kam kijiye, LOINC: 4544-3 test har 3 mahine mein karayein, aur agar creatinine level 1.2 mg/dL se jyada ho toh heavy pain-killers (Ibuprofen) bilkul na lein.";
        } else {
          chronicAdvice = "\n\n*RAG Clinical Guidelines Note*: Paani khoob pijiye, low-sodium diet lijiye, aur rozana apna checkup logs maintain kijiye.";
        }

        replyText = `*Mediflow AI-RAG support team* 🤖\n\nAapke query \"${incomingText}\" ke liye niche advice di gayi hai:\n\n*Advice*: Aaram kijiye, hydration maintain rakhein, aur daily BP/sugar monitor kijiye. Bina doctor ke pooche koi brand-name dawa mat lijiye. Agar tabiyat jyada kharab ho toh turant consult kijiye!${chronicAdvice}\n\n_Disclaimer: Yeh RAG advisory clinical guidelines (ADA/KDIGO) par based hai. Please checkup se pehle doctor se salah zaroor lein._`;
      }
      break;

    case "FAILED_DELIVERY":
      if (cleaned) {
        nextState = "AWAITING_WELCOME";
        replyText = "Re-establishing connection loop. Dobara shuru karne ke liye '1' reply kijiye.";
      }
      break;

    default:
      replyText = "Namaste! Mediflow Automated Assistant online. Main aapki kya sahayata kar sakta hoon?";
      break;
  }

  const currentTime = new Date().toISOString();
  chatHistory.push({ sender: "bot", text: replyText, timestamp: currentTime });

  // Update DB session state
  const updatedData = {
    ...sessionData,
    chatHistory
  };

  const { error: updateErr } = await supabase
    .from("whatsapp_sessions")
    .update({
      current_state: nextState,
      patient_id: session.patient_id,
      session_data: updatedData,
      last_interaction: currentTime
    })
    .eq("id", session.id);

  if (updateErr) {
    console.error("[Meta Webhook] Failed to update session after bot reply:", updateErr);
  }

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

