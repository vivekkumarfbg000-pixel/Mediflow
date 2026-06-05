const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('1. Logging in as doctor to run cleanup repair...');
  await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  const cleanupSql = `
    text;
    DELETE FROM public.profiles WHERE id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317109';
    DELETE FROM auth.users WHERE email = 'owner@mediflow.com' OR id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317109';
  `.replace(/\s+/g, ' ');

  await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: 'cleanup_' + Date.now(),
    p_type: cleanupSql
  });
  console.log('Cleanup complete.');

  // 2. SignUp owner@mediflow.com via GoTrue
  console.log('\n2. Signing up owner@mediflow.com via GoTrue...');
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: 'owner@mediflow.com',
    password: 'password123',
    options: {
      data: {
        role: 'platform_admin',
        display_name: 'SaaS Platform Owner'
      }
    }
  });

  if (signUpError) {
    console.error('❌ Sign up failed:', signUpError.message);
    return;
  }

  const newUserId = signUpData.user.id;
  console.log(`✅ User signed up successfully! New UUID: ${newUserId}`);

  // 3. Update ID in auth.users and recreate profile row
  console.log('\n3. Re-mapping user ID to mock platform admin ID...');
  const mapSql = `
    text;
    -- Delete profile for owner mock ID first
    DELETE FROM public.profiles WHERE id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317109';
    DELETE FROM public.profiles WHERE id = '${newUserId}';

    -- Delete identities before updating ID
    DELETE FROM auth.identities WHERE user_id = '${newUserId}';
    
    -- Update user ID in auth.users
    UPDATE auth.users 
    SET id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317109',
        email_confirmed_at = NOW(),
        confirmed_at = NOW()
    WHERE id = '${newUserId}';

    -- Re-insert identity row
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      email,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      'dfb2a1a8-8e68-4f8a-929e-4a6c8e317109',
      jsonb_build_object(
        'sub', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317109',
        'role', 'platform_admin',
        'email', 'owner@mediflow.com',
        'display_name', 'SaaS Platform Owner',
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      'dfb2a1a8-8e68-4f8a-929e-4a6c8e317109',
      'owner@mediflow.com',
      NOW(),
      NOW()
    );

    -- Insert correct profile row linked to the operations entity
    INSERT INTO public.profiles (id, entity_id, role, consultation_fee, display_name)
    VALUES (
      'dfb2a1a8-8e68-4f8a-929e-4a6c8e317109',
      'dfb2a1a8-8e68-4f8a-929e-4a6c8e317009',
      'platform_admin',
      0.00,
      'SaaS Platform Owner'
    );
  `.replace(/\s+/g, ' ');

  // We need to log in as doctor again to execute repair because signUp logged us in as owner
  await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  const { error: repairError } = await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: 'map_' + Date.now(),
    p_type: mapSql
  });

  if (repairError) {
    console.error('❌ Remapping failed:', repairError.message);
    return;
  }
  console.log('✅ Remapping successful!');

  // 4. Test login as owner@mediflow.com
  console.log('\n4. Verifying owner login...');
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: 'owner@mediflow.com',
    password: 'password123'
  });

  if (loginError) {
    console.error('❌ Owner login failed:', loginError.message);
  } else {
    console.log('🎉 Owner logged in successfully! User ID:', loginData.user.id);
  }
}

run();
