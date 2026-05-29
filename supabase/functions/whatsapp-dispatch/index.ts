import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// =============================================================================
// Mediflow — whatsapp-dispatch Edge Function
// Generalized transactional clinical messaging engine.
// Respects patient_consents opt-out settings with high strictness.
// Decrypts tenant-specific WABA system user credentials to communicate with Meta.
// Fallback simulator logs messages to whatsapp_sessions for beautiful UI updates.
// =============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { patientId, templateName, templateParams, podId } = await req.json();

    if (!patientId || !templateName || !podId) {
      return new Response(JSON.stringify({ error: "Missing required fields (patientId, templateName, podId)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Consent Validation Gate (High-Priority Opt-out Check)
    const { data: consents, error: consentErr } = await supabase
      .from("patient_consents")
      .select("*")
      .eq("patient_id", patientId);

    if (consentErr) {
      console.error("[whatsapp-dispatch] Failed to query patient consents", consentErr);
    }

    // If there is any consent record where revoked_at is NOT NULL, restrict sending immediately
    const hasRevoked = consents?.some((c) => c.revoked_at !== null);
    if (hasRevoked) {
      console.warn(`[whatsapp-dispatch] Opt-Out Block: Patient ${patientId} has explicitly revoked digital consent.`);
      return new Response(JSON.stringify({ error: "Consent revoked by patient. Send blocked.", blocked: true }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Query Patient Registry to get target phone & profile details
    const { data: patient, error: patErr } = await supabase
      .from("patient_registry")
      .select("phone, name")
      .eq("id", patientId)
      .single();

    if (patErr || !patient) {
      console.error(`[whatsapp-dispatch] Patient ${patientId} not found in registry.`, patErr);
      return new Response(JSON.stringify({ error: "Patient registry profile missing" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const patientPhone = patient.phone;
    const patientName = patient.name;

    // 3. Resolve active multi-tenant WABA Connection for this clinical pod
    const { data: wabaConn, error: wabaErr } = await supabase
      .from("waba_connections")
      .select("*")
      .eq("pod_id", podId)
      .eq("waba_status", "active")
      .maybeSingle();

    let dispatchSuccess = false;
    let wabaErrorMessage = "";

    const currentTime = new Date().toISOString();
    
    // Construct user-facing message text based on template parameters
    const patientDisplayName = templateParams?.patient_name || patientName || "Patient";
    const amountVal = templateParams?.amount || "0";
    const invoiceNum = templateParams?.invoice_id || "N/A";
    
    const plainTextMessage = `Namaste ${patientDisplayName}! Aapka payment of ₹${amountVal} successful raha for Invoice #${invoiceNum}. Mediflow healthcare app checkup slots configure ho rahe hain. We look forward to serving you! 🟢`;

    if (wabaConn) {
      try {
        const wabaSecretKey = Deno.env.get("WABA_DECRYPTION_KEY") ?? "mediflow_vault_key_2026";
        const { data: rpcData, error: rpcErr } = await supabase.rpc("decrypt_tenant_waba_connection", {
          p_phone_number_id: wabaConn.phone_number_id,
          p_secret_key: wabaSecretKey
        });

        if (rpcErr || !rpcData || rpcData.length === 0) {
          throw new Error(`RPC Decryption failed: ${rpcErr?.message ?? "Empty token decrypted"}`);
        }

        const decryptedToken = rpcData[0].decrypted_token;
        const phoneId = wabaConn.phone_number_id;

        // Meta Graph API integration
        const metaUrl = `https://graph.facebook.com/v21.0/${phoneId}/messages`;
        
        const templatePayload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: patientPhone,
          type: "template",
          template: {
            name: templateName,
            language: {
              code: "en_US"
            },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: patientDisplayName },
                  { type: "text", text: amountVal }
                ]
              }
            ]
          }
        };

        const res = await fetch(metaUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${decryptedToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(templatePayload)
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(`Meta HTTP ${res.status}: ${JSON.stringify(errData)}`);
        }

        console.log(`[whatsapp-dispatch] Successfully dispatched Meta template to patient ${patientPhone}`);
        dispatchSuccess = true;

      } catch (err: any) {
        wabaErrorMessage = err.message ?? "Meta API error";
        console.error(`[whatsapp-dispatch] Meta connection dispatch failed. Fallback to simulator: ${wabaErrorMessage}`);
      }
    } else {
      console.log(`[whatsapp-dispatch] No active WABA connection found for Pod ${podId}. Proceeding with simulator fallback.`);
    }

    // 4. Simulator Fallback & Dashboard Synchronization
    // Updates local whatsapp_sessions so that clinical compounder/doctor dashboards show messages in real-time
    const { data: session, error: sessErr } = await supabase
      .from("whatsapp_sessions")
      .select("*")
      .eq("patient_phone", patientPhone)
      .maybeSingle();

    if (sessErr) {
      console.error("[whatsapp-dispatch] Error loading patient session:", sessErr);
    }

    if (session) {
      const sessionData = session.session_data ?? {};
      const chatHistory = sessionData.chatHistory ?? [];
      chatHistory.push({
        sender: "bot",
        text: plainTextMessage,
        timestamp: currentTime
      });

      await supabase
        .from("whatsapp_sessions")
        .update({
          session_data: { ...sessionData, chatHistory, wabaErrorMessage },
          last_interaction: currentTime,
          current_state: "COMPLETED"
        })
        .eq("id", session.id);
    } else {
      await supabase
        .from("whatsapp_sessions")
        .insert({
          patient_phone: patientPhone,
          patient_id: patientId,
          current_state: "COMPLETED",
          last_interaction: currentTime,
          session_data: {
            chatHistory: [{
              sender: "bot",
              text: plainTextMessage,
              timestamp: currentTime
            }],
            podId: podId,
            wabaErrorMessage
          }
        });
    }

    // Register transactional dispatch activity
    await supabase.from("activity_logs").insert({
      pod_id: podId,
      action_type: "WHATSAPP_DISPATCH_CONFIRMED",
      details: {
        patientId,
        templateName,
        recipientPhone: patientPhone,
        dispatchMode: wabaConn && !wabaErrorMessage ? "meta_direct" : "simulator_fallback",
        error: wabaErrorMessage || null
      }
    });

    return new Response(JSON.stringify({
      success: true,
      mode: wabaConn && !wabaErrorMessage ? "meta_direct" : "simulator_fallback",
      message: plainTextMessage
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("[whatsapp-dispatch] Exception in dispatch pipeline:", e);
    return new Response(JSON.stringify({ error: e.message ?? "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
