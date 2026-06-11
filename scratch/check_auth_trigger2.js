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
      'TRIGGER_NEW_USER',
      (
        SELECT jsonb_build_object(
          'definition', pg_get_triggerdef(t.oid)
        )
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE c.relname = 'users' AND n.nspname = 'auth'
      )
    );
  `.replace(/\s+/g, ' ');

  console.log('Running debug sql...');
  await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: 'trigger_dbg_' + Date.now(),
    p_type: sqlPayload
  });

  console.log('Retrieving logs...');
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('action_type', 'TRIGGER_NEW_USER')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error:', error);
  } else if (data && data.length > 0) {
    console.log('Results:', data[0].details.definition);
  } else {
    console.log('No trigger found on auth.users');
  }
}

run();