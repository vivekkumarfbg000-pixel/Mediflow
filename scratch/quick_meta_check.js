const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  await supabase.auth.signInWithPassword({ email: 'doctor@mediflow.com', password: 'password123' });
  
  const sql = 'text; INSERT INTO public.activity_logs (action_type, details) VALUES (\'META_CHK\', (SELECT jsonb_agg(jsonb_build_object(\'email\', email, \'meta\', raw_user_meta_data)) FROM auth.users WHERE email IN (\'newclinic@test.com\', \'newpharmacy@test.com\')))';
  
  await supabase.rpc('execute_autonomous_db_repair', { p_table: 'pods', p_column: 'meta_chk_' + Date.now(), p_type: sql });
  
  const { data } = await supabase.from('activity_logs').select('*').eq('action_type', 'META_CHK').order('created_at', { ascending: false }).limit(1);
  
  if (data && data.length > 0) {
    console.log('Metadata:', JSON.stringify(data[0].details, null, 2));
  }
}

run().catch(console.error);