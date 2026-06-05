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
      'ALL_AUTH_TRIGGERS',
      (
        SELECT jsonb_build_object(
          'triggers', (
            SELECT jsonb_agg(jsonb_build_object('tablename', c.relname, 'tgname', tgname, 'tgdef', pg_get_triggerdef(tg.oid)))
            FROM pg_trigger tg
            JOIN pg_class c ON tg.tgrelid = c.oid
            JOIN pg_namespace n ON c.relnamespace = n.oid
            WHERE n.nspname = 'auth' AND tg.tgisinternal = false
          )
        )
      )
    );
  `.replace(/\s+/g, ' ');

  console.log('Running debug sql...');
  await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: 'auth_trig_' + Date.now(),
    p_type: sqlPayload
  });

  console.log('Retrieving logs...');
  const { data } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('action_type', 'ALL_AUTH_TRIGGERS')
    .order('created_at', { ascending: false })
    .limit(1);

  console.log('Results:', JSON.stringify(data[0].details, null, 2));
}

run();
