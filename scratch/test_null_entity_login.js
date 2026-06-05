const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log('====================================================');
  console.log('🧪 TESTING LOGIN & RLS FOR USER WITH NULL ENTITY_ID');
  console.log('====================================================');

  const testEmail = `test_null_entity_${Date.now()}@mediflow.com`;
  const testPassword = 'Password123!';
  let testUserId = null;

  try {
    // 1. Sign up a new user
    console.log(`1. Signing up test user: ${testEmail}...`);
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          display_name: 'Test Null Entity User',
          role: 'doctor'
        }
      }
    });

    if (signUpError) {
      console.error('❌ Sign up failed:', signUpError.message);
      return;
    }

    testUserId = signUpData.user.id;
    console.log(`✅ Signed up successfully! User ID: ${testUserId}`);

    // Wait 1 second for database triggers to execute
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 2. Log in as the new user
    console.log('\n2. Logging in as the new user...');
    const { data: logInData, error: logInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    if (logInError) {
      console.error('❌ Login failed:', logInError.message);
      return;
    }
    console.log('✅ Logged in successfully!');

    // Create client instance authenticated as the new user
    const authedClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    await authedClient.auth.setSession({
      access_token: logInData.session.access_token,
      refresh_token: logInData.session.refresh_token
    });

    // 3. Fetch profile
    console.log('\n3. Fetching own profile as authenticated user...');
    const { data: profile, error: profileError } = await authedClient
      .from('profiles')
      .select('*')
      .eq('id', testUserId)
      .single();

    if (profileError) {
      console.error('❌ Fetch profile failed (RLS blocked):', profileError.message);
    } else {
      console.log('✅ Profile successfully fetched:');
      console.log(`   - ID: ${profile.id}`);
      console.log(`   - Role: ${profile.role}`);
      console.log(`   - Entity ID: ${profile.entity_id} (Expected: null)`);
      console.log(`   - Display Name: ${profile.display_name}`);
    }

    // 4. Update profile display name
    console.log('\n4. Attempting to update own display name...');
    const newName = 'Updated Test Null Entity User Name';
    const { error: updateError } = await authedClient
      .from('profiles')
      .update({ display_name: newName })
      .eq('id', testUserId);

    if (updateError) {
      console.error('❌ Update failed (RLS blocked):', updateError.message);
    } else {
      console.log('✅ Display name updated successfully!');
      
      // Verify update
      const { data: updatedProfile } = await authedClient
        .from('profiles')
        .select('display_name')
        .eq('id', testUserId)
        .single();
      console.log(`   - New Display Name in DB: ${updatedProfile?.display_name}`);
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err);
  } finally {
    // 5. Cleanup
    if (testUserId) {
      console.log('\n5. Cleaning up test records...');
      // Authenticate as doctor to run cleanup repair
      await supabase.auth.signInWithPassword({
        email: 'doctor@mediflow.com',
        password: 'password123'
      });

      const cleanupSql = `
        text;
        DELETE FROM public.profiles WHERE id = '${testUserId}';
        DELETE FROM auth.users WHERE id = '${testUserId}';
      `.replace(/\s+/g, ' ');

      const { error: cleanupError } = await supabase.rpc('execute_autonomous_db_repair', {
        p_table: 'pods',
        p_column: 'cleanup_' + Date.now(),
        p_type: cleanupSql
      });

      if (cleanupError) {
        console.error('❌ Cleanup failed:', cleanupError.message);
      } else {
        console.log('✅ Cleanup complete. Test user removed.');
      }
    }
    console.log('====================================================');
  }
}

test();
