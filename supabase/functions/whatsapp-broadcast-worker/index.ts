import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { getCorsHeaders } from "../_shared/cors.ts";

// =============================================================================
// Mediflow — whatsapp-broadcast-worker Edge Function
// Processes asynchronous broadcast queues to prevent Meta API 429 Rate Limits.
// Pulls 'pending' messages, dispatches them with pacing and exponential backoff,
// and marks them as 'delivered' or 'failed'.
// =============================================================================

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Helper for pacing
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const reqBody = await req.json().catch(() => ({}));
    const { campaign_id, pod_id, phone_id: reqPhoneId, system_token: reqSystemToken } = reqBody;
    
    if (!campaign_id || !pod_id) {
      return new Response(JSON.stringify({ error: "Missing campaign_id or pod_id" }), { status: 400, headers: corsHeaders });
    }

    // 1. Primary: VitalSync Master Company Token from Supabase Secrets
    let systemToken = (Deno.env.get("OWNER_SYSTEM_TOKEN") || Deno.env.get("META_WHATSAPP_TOKEN") || Deno.env.get("META_ACCESS_TOKEN") || "").trim();
    let phoneId = (Deno.env.get("META_PHONE_NUMBER_ID") || Deno.env.get("OWNER_PHONE_NUMBER_ID") || Deno.env.get("PHONE_NUMBER_ID") || "").trim();

    // 2. Secondary: Payload overrides if passed directly
    if (reqSystemToken && String(reqSystemToken).startsWith("EAA")) {
      systemToken = reqSystemToken;
    }
    if (reqPhoneId && reqPhoneId !== "105829471928374") {
      phoneId = reqPhoneId;
    }

    // 3. Tertiary: If secrets not in Deno, check DB connection
    if (!systemToken || !phoneId) {
      try {
        const { data: wabaConn } = await supabase
          .from("waba_connections")
          .select("phone_number_id, access_token, encrypted_system_user_token")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (wabaConn) {
          if (!phoneId) phoneId = wabaConn.phone_number_id || "";
          if (!systemToken) {
            if (wabaConn.access_token && wabaConn.access_token.startsWith("EAA")) {
              systemToken = wabaConn.access_token;
            } else if (wabaConn.encrypted_system_user_token) {
              const wabaSecretKey = Deno.env.get("WABA_DECRYPTION_KEY") || "vitalsync_master_vault_key_2026";
              try {
                const { data: rpcData } = await supabase.rpc("decrypt_tenant_waba_connection", {
                  p_phone_number_id: wabaConn.phone_number_id,
                  p_secret_key: wabaSecretKey
                });
                if (rpcData && rpcData.length > 0 && rpcData[0].decrypted_token && rpcData[0].decrypted_token.startsWith("EAA")) {
                  systemToken = rpcData[0].decrypted_token;
                }
              } catch (_rpcE) {}
            }
          }
        }
      } catch (wErr) {
        console.warn("[whatsapp-broadcast-worker] Tenant WABA resolution note:", wErr);
      }
    }

    if (!systemToken) {
      return new Response(JSON.stringify({ error: "No active Meta WhatsApp token available (neither tenant WABA nor master OWNER_SYSTEM_TOKEN)." }), { status: 400, headers: corsHeaders });
    }

    // 2. Fetch and lock a batch of pending jobs atomically using SKIP LOCKED RPC
    const { data: pendingJobs, error: qErr } = await supabase.rpc("pop_pending_broadcast_batch", {
      p_campaign_id: campaign_id,
      p_pod_id: pod_id,
      p_limit: 500
    });

    if (qErr || !pendingJobs || pendingJobs.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No pending messages found or batch locked." }), { status: 200, headers: corsHeaders });
    }

    let deliveredCount = 0;
    let failedCount = 0;

    // 3. Process the batch with controlled pacing
    // Target ~10 messages per second to avoid Meta HTTP 429
    const baseDelayMs = 100; 
    let currentDelayMs = baseDelayMs;

    for (const job of pendingJobs) {
      let cleanPhone = String(job.patient_phone || "").replace(/[^0-9]/g, "");
      if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;

      if (!cleanPhone) {
        await supabase.from("whatsapp_broadcast_queue").update({ status: 'failed', error_details: 'Invalid phone format' }).eq('id', job.id);
        failedCount++;
        continue;
      }

      let attempt = 0;
      let success = false;
      let errorDetails = "";

      while (attempt < 3 && !success) {
        attempt++;
        try {
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
              text: { body: `📢 [BROADCAST CAMPAIGN]\n${job.message_text}` }
            })
          });

          if (res.ok) {
            success = true;
            currentDelayMs = baseDelayMs; // Reset backoff on success
          } else {
            const resData = await res.json().catch(() => ({}));
            errorDetails = `HTTP ${res.status}: ${JSON.stringify(resData)}`;
            
            // If Rate Limited (429) or Server Error (5xx), apply exponential backoff
            if (res.status === 429 || res.status >= 500) {
              console.warn(`[whatsapp-broadcast-worker] Rate limit hit. Backing off for ${currentDelayMs * 2}ms...`);
              currentDelayMs = Math.min(currentDelayMs * 2, 5000); // Max backoff 5 seconds
              await sleep(currentDelayMs);
            } else {
              // 400 Bad Request, 24-hr window limit, etc.
              break; 
            }
          }
        } catch (e: any) {
          errorDetails = e.message;
          await sleep(currentDelayMs);
          currentDelayMs = Math.min(currentDelayMs * 2, 5000);
        }
      }

      // Automatic 24-Hour Window Bypass: Fallback to Meta Approved Template if Error 131047 occurs
      if (!success && (errorDetails.includes("131047") || errorDetails.includes("Re-engagement message") || errorDetails.includes("131026"))) {
        console.log(`[whatsapp-broadcast-worker] 24-Hour Customer Window Expired (Meta Error 131047) for ${cleanPhone}. Retrying via pre-approved Meta Template...`);
        try {
          const defaultTpl = Deno.env.get("META_DEFAULT_TEMPLATE") || "hello_world";
          const templateRes = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${systemToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: cleanPhone,
              type: "template",
              template: {
                name: defaultTpl,
                language: { code: "en_US" }
              }
            })
          });

          if (templateRes.ok) {
            success = true;
            console.log(`[whatsapp-broadcast-worker] Template Fallback Delivered successfully to ${cleanPhone}`);
          } else {
            const tplErrData = await templateRes.json().catch(() => ({}));
            errorDetails = `Template Fallback Failed: ${JSON.stringify(tplErrData)}`;
          }
        } catch (_tplErr: any) {
          errorDetails = `Template Error: ${_tplErr?.message}`;
        }
      }

      // Update final job status
      if (success) {
        deliveredCount++;
        await supabase.from("whatsapp_broadcast_queue").update({ status: 'delivered', updated_at: new Date().toISOString() }).eq('id', job.id);
        
        // Log in patient's whatsapp session to update UI
        try {
          const last10 = cleanPhone.slice(-10);
          const currentTime = new Date().toISOString();
          const { data: dbSess } = await supabase
            .from("whatsapp_sessions")
            .select("id, patient_phone")
            .like("patient_phone", `%${last10}%`)
            .maybeSingle();

          if (dbSess) {
            const newMsg = {
              sender: "agent",
              text: `📢 [BROADCAST CAMPAIGN]\n${job.message_text}`,
              timestamp: currentTime,
              time: currentTime
            };

            await supabase.rpc('atomic_update_whatsapp_session', {
              p_patient_phone: dbSess.patient_phone,
              p_patient_id: null,
              p_pod_id: null,
              p_entity_id: null,
              p_current_state: null,
              p_message: newMsg,
              p_session_data_updates: null
            });
          }
        } catch (e) { /* ignore session append errors to keep loop fast */ }
      } else {
        failedCount++;
        await supabase.from("whatsapp_broadcast_queue").update({ status: 'failed', error_details: errorDetails, updated_at: new Date().toISOString() }).eq('id', job.id);
      }

      await sleep(currentDelayMs);
    }

    // Update campaign metrics in whatsapp_broadcast_campaigns
    try {
      await supabase
        .from("whatsapp_broadcast_campaigns")
        .update({
          delivered_count: deliveredCount,
          failed_count: failedCount,
          status: failedCount > 0 && deliveredCount === 0 ? 'failed' : `Delivered ⚡ (${deliveredCount} recipients)`,
          updated_at: new Date().toISOString()
        })
        .eq("id", campaign_id);
    } catch (_cErr) {
      console.warn("[whatsapp-broadcast-worker] Campaign update note:", _cErr);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      processed: pendingJobs.length,
      delivered: deliveredCount,
      failed: failedCount,
      has_more: pendingJobs.length === 500
    }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (err: any) {
    console.error("[whatsapp-broadcast-worker] Uncaught Exception:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
