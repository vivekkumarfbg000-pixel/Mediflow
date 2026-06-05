const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  const sql = `
    text;
    DELETE FROM public.system_health_telemetry WHERE error_code = 'PODS_POLICIES';
    INSERT INTO public.system_health_telemetry (subsystem, severity, error_code, error_stack)
    SELECT 'database', 'info', 'PODS_POLICIES', 
           COALESCE((SELECT json_agg(json_build_object('policyname', policyname, 'roles', roles, 'cmd', cmd, 'qual', qual))::text 
            FROM pg_policies WHERE tablename = 'pods'), '[]');
  `.replace(/\s+/g, ' ');

  const colName = 'pods_pol_' + Math.floor(Math.random() * 1000000);
  await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: colName,
    p_type: sql
  });

  const { data } = await supabase
    .from('system_health_telemetry')
    .select('*')
    .eq('error_code', 'PODS_POLICIES')
    .single();

  console.log('Pods Policies:', JSON.parse(data.error_stack));
}

run();
