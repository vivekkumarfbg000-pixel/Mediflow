import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { level, source, message, stackTrace, userId, clinicId, metadata } = await req.json();

    const { data, error } = await supabaseClient
      .from('system_logs')
      .insert({
        level: level || 'error',
        source: source || 'frontend_error_boundary',
        message: message,
        stack_trace: stackTrace,
        user_id: userId,
        clinic_id: clinicId,
        metadata: metadata
      })
      .select()
      .single();

    if (error) throw error;

    // TODO: In the future, this edge function can automatically POST to a Slack webhook
    // or trigger an AI Agent webhook (e.g. n8n or an external Agent endpoint) to auto-heal.
    
    return new Response(
      JSON.stringify({ success: true, log_id: data.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
