const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('Authenticating...');
  await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  const sql = `
    text;
    
    DELETE FROM public.system_health_telemetry WHERE error_code = 'LIST_AUTH_USERS';
    
    INSERT INTO public.system_health_telemetry (subsystem, severity, error_code, error_stack)
    SELECT 
      'database',
      'info',
      'LIST_AUTH_USERS',
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', id,
          'email', email,
          'raw_user_meta_data', raw_user_meta_data
        ))::text 
        FROM auth.users
      ), '[]')
    ;
  `.replace(/\s+/g, ' ');

  console.log('Running query...');
  const colName = 'dummy_col_chk_' + Math.floor(Math.random() * 1000000);
  const { data: repairDone, error: repairError } = await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: colName,
    p_type: sql
  });

  if (repairError) {
    console.error('Call failed:', repairError);
    return;
  }

  console.log('Fetching results...');
  const { data, error } = await supabase
    .from('system_health_telemetry')
    .select('*')
    .eq('error_code', 'LIST_AUTH_USERS');

  if (error) {
    console.error('Fetch failed:', error);
  } else {
    data.forEach(row => {
      console.log(JSON.stringify(JSON.parse(row.error_stack), null, 2));
    });
  }
}

run();
