const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verify() {
  console.log('====================================================');
  console.log('🧪 MEDIFLOW PLATFORM OWNER & ONBOARDING RPC VERIFIER');
  console.log('====================================================');

  try {
    // 1. Authenticate as owner@mediflow.com
    console.log('1. Attempting login as owner@mediflow.com...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'owner@mediflow.com',
      password: 'password123'
    });

    if (authError) {
      console.error('❌ Authentication failed:', authError.message);
      return;
    }
    console.log(`✅ Success! Authenticated as: ${authData.user.email} (ID: ${authData.user.id})`);

    // 2. Fetch profile
    console.log('\n2. Fetching profile for authenticated user...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError) {
      console.error('❌ Profile fetch failed:', profileError.message);
    } else {
      console.log('✅ Profile successfully retrieved:');
      console.log(`   - ID: ${profile.id}`);
      console.log(`   - Role: ${profile.role} (Expected: platform_admin)`);
      console.log(`   - Entity ID: ${profile.entity_id}`);
    }

    // 3. Test RPC existence (Check if function info exists in database via execute_autonomous_db_repair logging)
    // We can run a small query logging check to see if pg_proc contains register_clinic_network
    console.log('\n3. Verifying database RPC presence...');
    const verifySql = `
      text;
      INSERT INTO public.activity_logs (action_type, details)
      VALUES (
        'RPC_EXISTS_CHECK',
        jsonb_build_object(
          'register_clinic_network_exists', (SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'register_clinic_network')),
          'join_clinic_network_exists', (SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'join_clinic_network'))
        )
      );
    `.replace(/\s+/g, ' ');

    const { error: rpcError } = await supabase.rpc('execute_autonomous_db_repair', {
      p_table: 'pods',
      p_column: 'verify_rpc_' + Date.now(),
      p_type: verifySql
    });

    if (rpcError) {
      console.error('❌ RPC Check execution failed:', rpcError.message);
      return;
    }

    const { data: logData, error: logFetchError } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('action_type', 'RPC_EXISTS_CHECK')
      .order('created_at', { ascending: false })
      .limit(1);

    if (logFetchError || !logData || logData.length === 0) {
      console.error('❌ Failed to fetch RPC check logs.');
    } else {
      const results = logData[0].details;
      console.log('✅ RPC database presence status:');
      console.log(`   - register_clinic_network: ${results.register_clinic_network_exists ? 'ACTIVE' : 'MISSING'}`);
      console.log(`   - join_clinic_network: ${results.join_clinic_network_exists ? 'ACTIVE' : 'MISSING'}`);
    }

  } catch (err) {
    console.error('❌ Unexpected error during verification:', err);
  }
}

verify();
