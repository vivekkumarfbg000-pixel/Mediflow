const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  // Check the newly created partner's metadata for pod_id
  const sqlPayload = `
    text;
    INSERT INTO public.activity_logs (action_type, details)
    VALUES (
      'CHECK_PARTNER_META',
      (
        SELECT jsonb_build_object(
          'id', id,
          'email', email,
          'user_metadata', raw_user_meta_data
        )
        FROM auth.users
        WHERE email = 'newpharmacy@test.com'
      )
    );
  `.replace(/\s+/g, ' ');

  await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: 'check_meta_' + Date.now(),
    p_type: sqlPayload
  });

  const { data } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('action_type', 'CHECK_PARTNER_META')
    .order('created_at', { ascending: false })
    .limit(1);

  if (data && data.length > 0) {
    console.log('Partner metadata:', JSON.stringify(data[0].details.user_metadata, null, 2));
  }
  
  // Also check the clinic's pod_id
  const sqlPayload2 = `
    text;
    INSERT INTO public.activity_logs (action_type, details)
    VALUES (
      'CHECK_CLINIC_META',
      (
        SELECT jsonb_build_object(
          'id', id,
          'email', email,
          'user_metadata', raw_user_meta_data
        )
        FROM auth.users
        WHERE email = 'newclinic@test.com'
      )
    );
  `.replace(/\s+/g, ' ');

  await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: 'check_meta2_' + Date.now(),
    p_type: sqlPayload2
  });

  const { data: data2 } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('action_type', 'CHECK_CLINIC_META')
    .order('created_at', { ascending: false })
    .limit(1);

  if (data2 && data2.length > 0) {
    console.log('Clinic metadata:', JSON.stringify(data2[0].details.user_metadata, null, 2));
  }
}

run().catch(console.error);