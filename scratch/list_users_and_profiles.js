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
      'LIST_ALL_USERS_PROFILES',
      (
        SELECT jsonb_build_object(
          'users', (SELECT jsonb_agg(jsonb_build_object('id', id, 'email', email, 'created_at', created_at, 'confirmed_at', email_confirmed_at)) FROM auth.users),
          'profiles', (SELECT jsonb_agg(jsonb_build_object('id', id, 'role', role, 'display_name', display_name, 'entity_id', entity_id)) FROM public.profiles)
        )
      )
    );
  `.replace(/\s+/g, ' ');

  await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: 'list_users_' + Date.now(),
    p_type: sqlPayload
  });

  const { data } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('action_type', 'LIST_ALL_USERS_PROFILES')
    .order('created_at', { ascending: false })
    .limit(1);

  console.log(JSON.stringify(data[0].details, null, 2));
}

run();
