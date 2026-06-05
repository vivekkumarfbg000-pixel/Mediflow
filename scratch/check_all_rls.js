const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  const sqlPayload = `
    text;
    INSERT INTO public.activity_logs (action_type, details)
    VALUES (
      'ALL_RLS_POLICIES',
      (
        SELECT jsonb_build_object(
          'policies', (
            SELECT jsonb_agg(jsonb_build_object('tablename', tablename, 'policyname', policyname, 'roles', roles, 'cmd', cmd, 'qual', qual, 'with_check', with_check))
            FROM pg_policies
            WHERE schemaname = 'public'
          )
        )
      )
    );
  `.replace(/\s+/g, ' ');

  console.log('Running debug sql...');
  await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: 'all_rls_' + Date.now(),
    p_type: sqlPayload
  });

  console.log('Retrieving logs...');
  const { data } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('action_type', 'ALL_RLS_POLICIES')
    .order('created_at', { ascending: false })
    .limit(1);

  console.log('Results:', JSON.stringify(data[0].details, null, 2));
}

run();
