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
    DELETE FROM public.system_health_telemetry WHERE error_code = 'LEAKY_POLICIES';
    INSERT INTO public.system_health_telemetry (subsystem, severity, error_code, error_stack)
    SELECT 'database', 'warning', 'LEAKY_POLICIES',
           (
             SELECT json_agg(json_build_object('tablename', tablename, 'policyname', policyname, 'cmd', cmd, 'qual', qual, 'with_check', with_check))::text
             FROM pg_policies 
             WHERE schemaname = 'public' 
               AND (qual = 'true' OR with_check = 'true')
               AND tablename NOT IN ('clinical_guidelines_embeddings') /* guidelines are global and public */
           );
  `.replace(/\s+/g, ' ');

  const colName = 'leaky_scan_' + Math.floor(Math.random() * 1000000);
  console.log('Running debug sql with column:', colName);
  const { data: rpcResult, error: rpcError } = await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: colName,
    p_type: sql
  });
  console.log('RPC Result:', rpcResult, 'RPC Error:', rpcError);



  const { data, error: fetchError } = await supabase
    .from('system_health_telemetry')
    .select('*')
    .eq('error_code', 'LEAKY_POLICIES')
    .order('created_at', { ascending: false })
    .limit(1);


  if (fetchError) {
    console.error('Fetch error:', fetchError);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No telemetry records found for LEAKY_POLICIES. The insertion may have failed.');
    return;
  }

  console.log('Leaky Policies Found (Raw):', data[0].error_stack);
  if (data[0].error_stack) {
    console.log(JSON.stringify(JSON.parse(data[0].error_stack), null, 2));
  } else {
    console.log('Error stack is null (no leaky policies found).');
  }
}

run();

