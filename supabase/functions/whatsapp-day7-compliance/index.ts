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

    // Get patients from chronic_care_cohorts added 7 days ago
    const sevenDaysAgoStart = new Date();
    sevenDaysAgoStart.setDate(sevenDaysAgoStart.getDate() - 7);
    sevenDaysAgoStart.setHours(0, 0, 0, 0);
    
    const sevenDaysAgoEnd = new Date(sevenDaysAgoStart);
    sevenDaysAgoEnd.setHours(23, 59, 59, 999);

    const { data: cohorts, error } = await supabase
      .from('chronic_care_cohorts')
      .select('patient_id, patient_name')
      .gte('created_at', sevenDaysAgoStart.toISOString())
      .lte('created_at', sevenDaysAgoEnd.toISOString());

    if (error) throw error;
    if (!cohorts || cohorts.length === 0) {
      return new Response(JSON.stringify({ message: "No patients eligible for Day 7 compliance check." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results = [];

    for (const cohort of cohorts) {
      // Get patient phone from patient_registry
      const { data: patientData, error: patientError } = await supabase
        .from('patient_registry')
        .select('phone')
        .eq('id', cohort.patient_id)
        .single();
        
      if (patientError || !patientData?.phone) continue;

      let phone = patientData.phone.replace(/\D/g, '');
      if (phone.length === 10) phone = '91' + phone;
      if (!phone.startsWith('91') && phone.length > 10) {
          // Assume country code is included
      } else if (phone.length < 10) {
          continue;
      }

      // Send WhatsApp Interactive Message
      if (META_API_TOKEN && WHATSAPP_PHONE_NUMBER_ID) {
        const payload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone,
          type: "interactive",
          interactive: {
            type: "button",
            body: {
              text: `Namaste ${cohort.patient_name} Ji! 🙏\n\nEk hafte pehle aapki nayi dawaiyan shuru hui thi. Kya aap niyamit roop se dawai le rahe hain aur kaisa mehsoos kar rahe hain?`
            },
            action: {
              buttons: [
                {
                  type: "reply",
                  reply: {
                    id: `day7_yes_${cohort.patient_id}`,
                    title: "Yes ✅"
                  }
                },
                {
                  type: "reply",
                  reply: {
                    id: `day7_no_${cohort.patient_id}`,
                    title: "No, Side Effects ⚠️"
                  }
                }
              ]
            }
          }
        };

        const res = await fetch(`https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${META_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        
        results.push({ patient: cohort.patient_name, status: res.ok ? 'sent' : 'failed' });
      } else {
        results.push({ patient: cohort.patient_name, status: 'skipped_no_token' });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
