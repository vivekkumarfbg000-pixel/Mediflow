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
    const { campaign_id, pod_id } = await req.json().catch(() => ({}));
    
    if (!campaign_id || !pod_id) {
      return new Response(JSON.stringify({ error: "Missing campaign_id or pod_id" }), { status: 400, headers: corsHeaders });
    }

    // 1. Fetch WABA connection for this pod
    const { data: wabaConn, error: wabaErr } = await supabase
      .from("waba_connections")
      .select("phone_number_id, encrypted_system_user_token")
      .eq("pod_id", pod_id)
      .eq("waba_status", "active")
      .maybeSingle();

    if (wabaErr || !wabaConn) {
      return new Response(JSON.stringify({ error: "No active WABA connection found for this clinic." }), { status: 400, headers: corsHeaders });
    }

    // Decrypt the WABA token securely via RPC
    const wabaSecretKey = Deno.env.get("WABA_DECRYPTION_KEY");
    if (!wabaSecretKey) {
      return new Response(JSON.stringify({ error: "WABA_DECRYPTION_KEY missing from Vault." }), { status: 500, headers: corsHeaders });
    }

    const { data: rpcData, error: rpcErr } = await supabase.rpc("decrypt_tenant_waba_connection", {
      p_phone_number_id: wabaConn.phone_number_id,
      p_secret_key: wabaSecretKey
    });

    if (rpcErr || !rpcData || rpcData.length === 0) {
      return new Response(JSON.stringify({ error: "RPC Decryption failed" }), { status: 500, headers: corsHeaders });
    }

    const systemToken = rpcData[0].decrypted_token;
    const phoneId = wabaConn.phone_number_id;

    // 2. Fetch a batch of pending jobs (e.g. up to 500 per execution to stay within Deno limits)
    const { data: pendingJobs, error: qErr } = await supabase
      .from("whatsapp_broadcast_queue")
      .select("*")
      .eq("campaign_id", campaign_id)
      .eq("pod_id", pod_id)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(500);

    if (qErr || !pendingJobs || pendingJobs.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No pending messages found." }), { status: 200, headers: corsHeaders });
    }

    // Mark as processing
    const jobIds = pendingJobs.map(j => j.id);
    await supabase
      .from("whatsapp_broadcast_queue")
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .in('id', jobIds);

    let deliveredCount = 0;
    let failedCount = 0;

    // 3. Process the batch with controlled pacing
    // Target ~10 messages per second to avoid Meta HTTP 429
    const baseDelayMs = 100; 
    let currentDelayMs = baseDelayMs;

    for (const job of pendingJobs) {
      let cleanPhone = (job.patient_phone || "").replace(/[^0-9]/g, "");
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
              // 400 Bad Request, etc. Do not retry client errors.
              break; 
            }
          }
        } catch (e: any) {
          errorDetails = e.message;
          await sleep(currentDelayMs);
          currentDelayMs = Math.min(currentDelayMs * 2, 5000);
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
            .select("id, session_data")
            .like("patient_phone", `%${last10}%`)
            .maybeSingle();

          if (dbSess) {
            const sData = dbSess.session_data || {};
            const chatHistory = sData.chatHistory || [];
            chatHistory.push({
              sender: "agent",
              text: `📢 [BROADCAST CAMPAIGN]\n${job.message_text}`,
              timestamp: currentTime,
              time: currentTime
            });
            sData.chatHistory = chatHistory;

            await supabase
              .from("whatsapp_sessions")
              .update({ session_data: sData, last_interaction: currentTime })
              .eq("id", dbSess.id);
          }
        } catch (e) { /* ignore session append errors to keep loop fast */ }
      } else {
        failedCount++;
        await supabase.from("whatsapp_broadcast_queue").update({ status: 'failed', error_details: errorDetails, updated_at: new Date().toISOString() }).eq('id', job.id);
      }

      await sleep(currentDelayMs);
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
