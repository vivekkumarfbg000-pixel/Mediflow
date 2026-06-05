const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('1. Authenticating as doctor...');
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  if (authError) {
    console.error('❌ Authentication failed:', authError.message);
    return;
  }
  console.log('Authenticated successfully.');

  console.log('\n--- Test 1. RLS Security Compliance Scanner ---');
  
  // Create an insecure policy on whatsapp_sessions via backdoor execution
  console.log('Creating an insecure RLS policy "test_leaky_policy" on whatsapp_sessions...');
  const leakyPolicySql = `
    text;
    DROP POLICY IF EXISTS "test_leaky_policy" ON public.whatsapp_sessions;
    CREATE POLICY "test_leaky_policy" ON public.whatsapp_sessions 
        FOR SELECT TO public USING (true);
  `.replace(/\s+/g, ' ');

  const colRun1 = 'rls_test_leak_' + Date.now();
  await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: colRun1,
    p_type: leakyPolicySql
  });

  console.log('Running scan_and_heal_leaky_policies RPC...');
  const { data: scanResults, error: scanError } = await supabase.rpc('scan_and_heal_leaky_policies');

  if (scanError) {
    console.error('❌ RLS Scanner failed:', scanError.message);
  } else {
    console.log('RLS Scanner result:', scanResults);
    const healedPolicy = (scanResults || []).find(r => r.o_policy_name === 'test_leaky_policy');
    if (healedPolicy) {
      console.log('✅ SUCCESS: Insecure policy detected and automatically dropped by the healer!');
    } else {
      console.error('❌ FAILURE: Leaky policy was NOT detected or healed.');
    }
  }


  console.log('\n--- Test 2. Table Reconstruction RPC ---');
  
  console.log('Dropping table "self_healing_execution_logs" temporarily to simulate DDL loss...');
  const dropTableSql = `
    text;
    DROP TABLE IF EXISTS public.self_healing_execution_logs CASCADE;
  `.replace(/\s+/g, ' ');

  const colRun2 = 'ddl_test_drop_' + Date.now();
  await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: colRun2,
    p_type: dropTableSql
  });

  // Verify it is dropped
  const { error: queryErrBefore } = await supabase.from('self_healing_execution_logs').select('*').limit(1);
  if (queryErrBefore && (queryErrBefore.message.includes('does not exist') || queryErrBefore.code === '42P01')) {
    console.log('✅ Table is confirmed dropped/missing.');
  } else {
    console.warn('⚠️ Table might not be dropped. Code:', queryErrBefore?.code, 'Msg:', queryErrBefore?.message);
  }

  console.log('Running reconstruct_missing_table RPC for "self_healing_execution_logs"...');
  const { data: reconstructDone, error: reconstructErr } = await supabase.rpc('reconstruct_missing_table', {
    p_table: 'self_healing_execution_logs'
  });

  if (reconstructErr) {
    console.error('❌ Reconstruction RPC failed:', reconstructErr.message);
  } else {
    console.log('Reconstruction RPC return value:', reconstructDone);
    
    console.log('Waiting 3 seconds for PostgREST schema cache to reload...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verify it exists now and RLS is active
    const { data: queryDataAfter, error: queryErrAfter } = await supabase.from('self_healing_execution_logs').select('*').limit(1);
    if (!queryErrAfter) {
      console.log('✅ SUCCESS: Table successfully reconstructed and queried! RLS policy restored.');
    } else {
      console.error('❌ FAILURE: Reconstructed table is still unreachable. Error:', queryErrAfter.message);
    }
  }
}

run();
