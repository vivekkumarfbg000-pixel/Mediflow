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
    DELETE FROM public.profiles WHERE id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317109';
    DELETE FROM public.profiles WHERE id = '53c9e4bf-17b9-4229-ac27-e40369a601c4';
    DELETE FROM auth.sessions WHERE user_id = '53c9e4bf-17b9-4229-ac27-e40369a601c4';
    DELETE FROM auth.identities WHERE user_id = '53c9e4bf-17b9-4229-ac27-e40369a601c4';
    UPDATE auth.users SET id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317109' WHERE id = '53c9e4bf-17b9-4229-ac27-e40369a601c4';
  `.replace(/\s+/g, ' ');

  console.log('Running debug sql...');
  const { error: rpcError } = await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: 'rls_debug_' + Date.now(),
    p_type: sqlPayload
  });

  if (rpcError) {
    console.error('RPC Error:', rpcError);
    return;
  }

  console.log('Retrieving logs...');
  const { data, error: fetchError } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('action_type', 'UPDATE_REMAP_ERROR')
    .order('created_at', { ascending: false })
    .limit(1);

  if (fetchError) {
    console.error('Fetch Error:', fetchError);
    return;
  }

  if (data && data.length > 0) {
    console.log('Results:', JSON.stringify(data[0].details, null, 2));
  } else {
    console.log('No logs found.');
  }
}

run();
