import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { trigger, fatal_count, window_minutes, last_error_message } = await req.json();

    if (trigger !== 'anomaly_threshold_breached') {
      return new Response(JSON.stringify({ error: 'Invalid trigger' }), { status: 400 });
    }

    const VERCEL_TOKEN = Deno.env.get('VERCEL_API_TOKEN');
    const VERCEL_PROJECT_ID = Deno.env.get('VERCEL_PROJECT_ID');
    const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_CLOUD_API_TOKEN');
    const CLINIC_PHONE = Deno.env.get('WHATSAPP_CLINIC_PHONE_NUMBER'); 
    
    console.warn(`🚨 [ROLLBACK SENTINEL] Threshold breached! ${fatal_count} fatal errors in ${window_minutes} mins.`);
    console.warn(`Last Error: ${last_error_message}`);

    let rollbackStatus = 'Skipped (No Vercel Token)';

    // Trigger Vercel Rollback if tokens are present
    if (VERCEL_TOKEN && VERCEL_PROJECT_ID) {
      console.log('Fetching recent Vercel deployments...');
      const deployRes = await fetch(`https://api.vercel.com/v6/deployments?projectId=${VERCEL_PROJECT_ID}&limit=5`, {
        headers: { Authorization: `Bearer ${VERCEL_TOKEN}` }
      });
      
      if (deployRes.ok) {
        const deployData = await deployRes.json();
        const deployments = deployData.deployments || [];
        
        // Find the most recent READY deployment that is NOT the currently active one
        // (Assuming index 0 is current crashing one, index 1 is previous)
        if (deployments.length > 1) {
          const previousDeployment = deployments[1];
          console.log(`Commanding Vercel to rollback to deployment ID: ${previousDeployment.uid}`);
          
          const rollbackRes = await fetch(`https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/rollback/${previousDeployment.uid}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${VERCEL_TOKEN}` }
          });
          
          if (rollbackRes.ok) {
            rollbackStatus = 'SUCCESS';
            console.log('✅ Vercel Rollback Triggered Successfully.');
          } else {
            const errBody = await rollbackRes.text();
            rollbackStatus = `FAILED: ${errBody}`;
            console.error('❌ Vercel Rollback Failed:', errBody);
          }
        } else {
          rollbackStatus = 'FAILED: Not enough deployment history to rollback.';
        }
      } else {
        rollbackStatus = 'FAILED: Could not fetch Vercel deployments.';
      }
    }

    // Send WhatsApp Alert
    if (WHATSAPP_TOKEN && CLINIC_PHONE) {
      const message = `🚨 *VITALSYNC AI SENTINEL ALERT* 🚨\n\n` +
                      `Critical anomaly threshold breached in production (${fatal_count} fatal errors in ${window_minutes} mins).\n\n` +
                      `*Last Error:* ${last_error_message}\n\n` +
                      `*Rollback Action:* ${rollbackStatus}\n\n` +
                      `I am standing by to diagnose and hotfix this issue.`;
      
      const waUrl = `https://graph.facebook.com/v17.0/${Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')}/messages`;
      await fetch(waUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: CLINIC_PHONE,
          type: 'text',
          text: { body: message }
        })
      }).catch(e => console.error('Failed to send WhatsApp alert', e));
    } else {
      console.log('Skipping WhatsApp alert (Tokens missing). Simulated Alert sent to logs instead.');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        action: 'rollback_evaluated',
        status: rollbackStatus 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Rollback Sentinel Exception:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
