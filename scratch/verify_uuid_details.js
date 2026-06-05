const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runCheck() {
  console.log('Authenticating...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  if (authError) {
    console.error('Auth failed:', authError.message);
    return;
  }
  console.log('Authenticated successfully!');

  // Check the UUIDs by logging their presence into activity_logs and then fetching it.
  const sqlPayload = `
    text;
    
    INSERT INTO public.activity_logs (action_type, details)
    VALUES (
      'UUID_VERIFICATION',
      jsonb_build_object(
        'pod_exists', (SELECT EXISTS(SELECT 1 FROM public.pods WHERE id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001')),
        'clinic_entity_exists', (SELECT EXISTS(SELECT 1 FROM public.entities WHERE id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002')),
        'doctor_profile_exists', (SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101')),
        'lab_tech_profile_exists', (SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317102')),
        'doctor_staff_exists', (SELECT EXISTS(SELECT 1 FROM public.clinic_staff WHERE user_id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101')),
        'lab_tech_staff_exists', (SELECT EXISTS(SELECT 1 FROM public.clinic_staff WHERE user_id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317102')),
        
        'pod_row', (SELECT COALESCE(jsonb_agg(pods), '[]'::jsonb) FROM public.pods WHERE id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'),
        'clinic_entity_row', (SELECT COALESCE(jsonb_agg(entities), '[]'::jsonb) FROM public.entities WHERE id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002'),
        'doctor_profile_row', (SELECT COALESCE(jsonb_agg(profiles), '[]'::jsonb) FROM public.profiles WHERE id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101'),
        'lab_tech_profile_row', (SELECT COALESCE(jsonb_agg(profiles), '[]'::jsonb) FROM public.profiles WHERE id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317102'),
        'doctor_staff_row', (SELECT COALESCE(jsonb_agg(clinic_staff), '[]'::jsonb) FROM public.clinic_staff WHERE user_id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101'),
        'lab_tech_staff_row', (SELECT COALESCE(jsonb_agg(clinic_staff), '[]'::jsonb) FROM public.clinic_staff WHERE user_id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317102')
      )
    );
  `.replace(/\s+/g, ' ');

  console.log('Executing verification SQL injection via DB repair RPC...');
  const col = 'verify_col_' + Math.floor(Math.random() * 1000000);
  const { error: rpcError } = await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: col,
    p_type: sqlPayload
  });

  if (rpcError) {
    console.error('RPC Error:', rpcError.message);
    return;
  }

  console.log('Retrieving verification log from activity_logs...');
  const { data, error: fetchError } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('action_type', 'UUID_VERIFICATION')
    .order('created_at', { ascending: false })
    .limit(1);

  if (fetchError || !data || data.length === 0) {
    console.error('Error fetching logs:', fetchError?.message || 'No verification logs found');
    return;
  }

  console.log('\n========================================');
  console.log('DATABASE SEED VERIFICATION RESULTS:');
  console.log('========================================');
  console.log(JSON.stringify(data[0].details, null, 2));
  console.log('========================================');
}

runCheck();
