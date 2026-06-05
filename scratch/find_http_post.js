const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('Authenticating as doctor...');
  await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  const querySql = `
    text;
    DELETE FROM public.system_health_telemetry WHERE error_code = 'FIND_HTTP_POST';
    INSERT INTO public.system_health_telemetry (subsystem, severity, error_code, error_stack)
    SELECT 'database', 'info', 'FIND_HTTP_POST', 
           (SELECT json_agg(json_build_object('schema', n.nspname, 'name', p.proname, 'args', pg_get_function_arguments(p.oid)))::text 
            FROM pg_proc p 
            JOIN pg_namespace n ON p.pronamespace = n.oid 
            WHERE p.proname = 'http_post');
  `.replace(/\s+/g, ' ');

  const colRun = 'inspect_proc_' + Date.now();
  await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: colRun,
    p_type: querySql
  });

  const { data } = await supabase.from('system_health_telemetry').select('*').eq('error_code', 'FIND_HTTP_POST').single();
  console.log('http_post function locations in DB:', data.error_stack);
}

run();
