import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const META_API_TOKEN = Deno.env.get('META_API_TOKEN');
    const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get appointments completed today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);

    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('patient_id, patient_name, entity_id')
      .eq('status', 'completed')
      .gte('updated_at', todayStart.toISOString())
      .lte('updated_at', todayEnd.toISOString());

    if (error) throw error;
    if (!appointments || appointments.length === 0) {
      return new Response(JSON.stringify({ message: "No patients eligible for Google Review request today." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results = [];
    const processedPatients = new Set();

    for (const appt of appointments) {
      // Deduplicate by patient ID so we don't spam them twice in a day
      if (processedPatients.has(appt.patient_id)) continue;
      processedPatients.add(appt.patient_id);

      // Get patient phone from patient_registry
      const { data: patientData, error: patientError } = await supabase
        .from('patient_registry')
        .select('phone')
        .eq('id', appt.patient_id)
        .single();
        
      if (patientError || !patientData?.phone) continue;

      let phone = patientData.phone.replace(/\D/g, '');
      if (phone.length === 10) phone = '91' + phone;
      if (!phone.startsWith('91') && phone.length > 10) {
          // Assume country code is included
      }

      if (META_API_TOKEN && WHATSAPP_PHONE_NUMBER_ID) {
        const metaUrl = `https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
        
        const payload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone,
          type: "template",
          template: {
            name: "patient_review_request_template",
            language: { code: "en_US" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: appt.patient_name || "Patient" },
                  { type: "text", text: "VitalSync Clinic" }
                ]
              }
            ]
          }
        };

        const response = await fetch(metaUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${META_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        results.push({ phone, status: response.ok ? 'sent' : 'failed', response: data });
      } else {
        results.push({ phone, status: 'skipped (no meta token)' });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
