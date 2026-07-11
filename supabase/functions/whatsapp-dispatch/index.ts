import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { z } from "https://deno.land/x/zod@v3.22.4/index.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { isRateLimited } from "../_shared/rate-limit.ts";

// =============================================================================
// Mediflow — whatsapp-dispatch Edge Function
// Generalized transactional clinical messaging engine.
// Respects patient_consents opt-out settings with high strictness.
// Decrypts tenant-specific WABA system user credentials to communicate with Meta.
// Fallback simulator logs messages to whatsapp_sessions for beautiful UI updates.
// =============================================================================

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

    // Rate Limiter Check (30 requests/min per client IP for messaging dispatcher)
    if (await isRateLimited(req, supabase, 30, 60)) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bodyJson = await req.json().catch(() => ({}));
    const validationResult = z.object({
      patientId: z.string().uuid("Invalid patientId UUID format"),
      templateName: z.string().min(1, "Template name is required"),
      templateParams: z.record(z.any()).optional(),
      podId: z.string().uuid("Invalid podId UUID format"),
    }).safeParse(bodyJson);

    if (!validationResult.success) {
      const errorMsg = validationResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(", ");
      return new Response(JSON.stringify({ error: `Validation failed: ${errorMsg}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { patientId, templateName, templateParams, podId } = validationResult.data;

    // Cost Guard: Budget Enforce Check
    const { data: withinBudget, error: budgetErr } = await supabase.rpc("check_pod_budget", {
      p_pod_id: podId
    });

    if (budgetErr) {
      console.error("[whatsapp-dispatch] Failed to check pod budget limits", budgetErr);
    } else if (withinBudget === false) {
      console.warn(`[whatsapp-dispatch] Cost Guard Block: Pod ${podId} has breached its daily spending cap.`);
      return new Response(JSON.stringify({ 
        error: "Daily spending budget exceeded for this clinic. Operations paused.", 
        budgetExceeded: true 
      }), {
        status: 402, // 402 Payment Required
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Consent Validation Gate (High-Priority Opt-out Check)
    const { data: consents, error: consentErr } = await supabase
      .from("patient_consents")
      .select("*")
      .eq("patient_id", patientId);

    if (consentErr) {
      // SECURITY: Fail CLOSED. If consent cannot be verified, we must NOT send.
      // Sending to an opted-out patient due to a DB error is a compliance violation.
      console.error("[whatsapp-dispatch] Consent query failed — blocking send for patient safety.", consentErr);
      return new Response(JSON.stringify({ error: "Consent verification failed. Send blocked for patient safety." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    // POD VALIDATION: Verify patient belongs to the same pod as the request
    const { data: patientPod } = await supabase
      .from("patient_registry")
      .select("pod_id")
      .eq("id", patientId)
      .maybeSingle();
    
    if (patientPod?.pod_id && patientPod.pod_id !== podId) {
      console.warn(`[whatsapp-dispatch] Pod mismatch: patient pod ${patientPod.pod_id} !== request pod ${podId}`);
      return new Response(JSON.stringify({ error: "Pod mismatch - patient not in this clinic" }), {
        status: 403,
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
    
    const plainTextMessage = `Namaste ${patientDisplayName}! Aapka payment of ₹${amountVal} successful raha for Invoice #${invoiceNum}. VitalSync healthcare app checkup slots configure ho rahe hain. We look forward to serving you! 🟢`;

    if (wabaConn) {
      try {
        // ── SECURITY: WABA_DECRYPTION_KEY must be set in Supabase Vault ────────────
        // No fallback. If unset, all tenant WABA token decryption would use a
        // publicly-visible default string, exposing every clinic's WhatsApp token.
        // ────────────────────────────────────────────────────────────────────────────
        const wabaSecretKey = Deno.env.get("WABA_DECRYPTION_KEY");
        if (!wabaSecretKey) {
          console.error("[whatsapp-dispatch] FATAL: WABA_DECRYPTION_KEY not set in Vault. Cannot decrypt WABA tokens.");
          throw new Error("Server misconfiguration: WABA_DECRYPTION_KEY missing from Vault.");
        }
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

        let res;
        let attempt = 0;
        const maxAttempts = 3;
        let retryDelay = 1000; // Start with 1s

        while (attempt < maxAttempts) {
          try {
            attempt++;
            console.log(`[whatsapp-dispatch] Meta API dispatch attempt ${attempt} of ${maxAttempts}...`);
            
            res = await fetch(metaUrl, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${decryptedToken}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify(templatePayload)
            });

            if (res.ok) {
              console.log(`[whatsapp-dispatch] Successfully dispatched Meta template to patient ${patientPhone} on attempt ${attempt} ✅`);
              dispatchSuccess = true;
              break;
            }

            const errData = await res.json().catch(() => ({}));
            console.warn(`[whatsapp-dispatch] Meta API attempt ${attempt} returned HTTP ${res.status}:`, errData);

            // Abort immediately on client errors (400 Bad Request, 401 Unauthorized, etc.)
            if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404) {
              throw new Error(`Meta HTTP ${res.status}: ${JSON.stringify(errData)}`);
            }

            if (attempt < maxAttempts) {
              console.log(`[whatsapp-dispatch] Transient error, retrying in ${retryDelay}ms...`);
              await new Promise(resolve => setTimeout(resolve, retryDelay));
              retryDelay *= 2; // Exponential backoff
            } else {
              throw new Error(`Meta HTTP ${res.status} after ${maxAttempts} attempts: ${JSON.stringify(errData)}`);
            }
          } catch (err: any) {
            console.error(`[whatsapp-dispatch] Error on attempt ${attempt}:`, err.message || err);
            
            // If it's a client error we already threw, or if it is a network failure:
            if (attempt < maxAttempts && (!res || (res.status !== 400 && res.status !== 401 && res.status !== 403 && res.status !== 404))) {
              console.log(`[whatsapp-dispatch] Retrying in ${retryDelay}ms...`);
              await new Promise(resolve => setTimeout(resolve, retryDelay));
              retryDelay *= 2;
            } else {
              throw err;
            }
          }
        }

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
