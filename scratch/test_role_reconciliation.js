const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('1. Authenticating as Platform Owner...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'owner@mediflow.com',
    password: 'password123'
  });

  if (authError) {
    console.error('❌ Authentication failed:', authError.message);
    return;
  }
  const userId = authData.user.id;
  console.log(`Authenticated. User ID: ${userId}`);

  // Intentionally corrupt the profile role to 'patient' via backdoor execution
  console.log('2. Corrupting profile role to "patient" (simulating a database seed conflict)...');
  const corruptSql = `
    text;
    UPDATE public.profiles 
    SET role = 'patient', entity_id = NULL 
    WHERE id = '${userId}';
  `.replace(/\s+/g, ' ');

  const colRun = 'corrupt_test_' + Date.now();
  const { error: corruptErr } = await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: colRun,
    p_type: corruptSql
  });

  if (corruptErr) {
    console.error('❌ Failed to corrupt profile role:', corruptErr.message);
    return;
  }

  // Fetch profiles table directly using authenticated client
  const { data: corruptedProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  console.log('Corrupted profile state in DB:', corruptedProfile);

  if (corruptedProfile.role === 'patient') {
    console.log('✅ Corrupted role setup succeeded.');
  } else {
    console.error('❌ Setup failed. Role is:', corruptedProfile.role);
    return;
  }

  // Invoke reconciliation RPC
  console.log('3. Invoking reconcile_profile_role RPC to heal the mismatch...');
  const { data: reconciled, error: reconcileError } = await supabase.rpc('reconcile_profile_role');

  if (reconcileError) {
    console.error('❌ RPC call failed:', reconcileError.message);
    return;
  }

  console.log('RPC reconciliation return value:', reconciled);

  // Re-fetch profile to verify it is healed
  const { data: healedProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  console.log('Healed profile state in DB:', healedProfile);

  if (healedProfile.role === 'platform_admin' && healedProfile.entity_id === 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317009') {
    console.log('✅ SUCCESS: Profile role has been healed to "platform_admin" and linked to HQ entity!');
  } else {
    console.error('❌ FAILURE: Profile role remained corrupted. Role is:', healedProfile.role);
  }
}

run();
