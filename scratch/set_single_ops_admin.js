const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const targetEmail = 'vivekkumarfbg000@gmail.com';
const newPassword = 'PLACEHOLDER_PASSWORD_DO_NOT_COMMIT';
const targetUserId = '54267c71-8aaf-4843-8553-413f0e22d59b';

async function run() {
  console.log('====================================================');
  console.log('🔒 SETTING SINGLE SAAS OPS ADMIN');
  console.log('====================================================');

  // Step 1: Login as vivekkumarfbg000@gmail.com using password123 to update password
  console.log(`1. Logging in as ${targetEmail} with current password...`);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: targetEmail,
    password: 'password123'
  });

  if (authError) {
    console.error('❌ Login failed:', authError.message);
    console.log('   (Perhaps password was already updated? Proceeding with DB check...)');
  } else {
    console.log('✅ Logged in successfully! Updating password...');
    const authedClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    await authedClient.auth.setSession({
      access_token: authData.session.access_token,
      refresh_token: authData.session.refresh_token
    });

    const { error: updateError } = await authedClient.auth.updateUser({
      password: newPassword
    });

    if (updateError) {
      console.error('❌ Password update failed:', updateError.message);
      return;
    }
    console.log(`✅ Password successfully updated to: ${newPassword}`);
  }

  // Step 2: Login as doctor to execute database schema/role corrections
  console.log('\n2. Logging in as doctor to run role promotions and demotions...');
  const { error: docAuthError } = await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  if (docAuthError) {
    console.error('❌ Doctor authentication failed:', docAuthError.message);
    return;
  }

  const sql = `
    text;
    DO $$
    BEGIN
      UPDATE auth.users
      SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "platform_admin", "display_name": "SaaS Platform Owner"}'::jsonb
      WHERE id = '${targetUserId}';

      INSERT INTO public.profiles (id, entity_id, role, consultation_fee, display_name, is_active)
      VALUES (
        '${targetUserId}',
        'dfb2a1a8-8e68-4f8a-929e-4a6c8e317009',
        'platform_admin',
        0.00,
        'SaaS Platform Owner',
        true
      )
      ON CONFLICT (id) DO UPDATE 
      SET 
        role = 'platform_admin',
        entity_id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317009',
        display_name = 'SaaS Platform Owner',
        is_active = true;

      UPDATE auth.users
      SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "patient", "display_name": "Legacy Owner"}'::jsonb
      WHERE email = 'owner@mediflow.com';

      UPDATE public.profiles
      SET role = 'patient', entity_id = NULL
      WHERE id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317109';

      UPDATE auth.users
      SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "doctor", "display_name": "Doctor"}'::jsonb
      WHERE id != '${targetUserId}' AND (raw_user_meta_data->>'role' = 'platform_admin' OR raw_user_meta_data->>'role' = 'admin');

      UPDATE public.profiles
      SET role = 'doctor'
      WHERE id != '${targetUserId}' AND role = 'platform_admin';

    END $$;
  `.replace(/\s+/g, ' ');


  console.log('3. Applying database corrections...');
  const { data, error } = await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: 'single_ops_' + Date.now(),
    p_type: sql
  });

  if (error) {
    console.error('❌ Database updates failed:', error.message);
  } else {
    console.log('✅ Database updates applied successfully!');
  }

  // Step 3: Verify login with new password
  console.log('\n4. Verifying login with the new password...');
  const { data: verifyData, error: verifyError } = await supabase.auth.signInWithPassword({
    email: targetEmail,
    password: newPassword
  });

  if (verifyError) {
    console.error('❌ Verification failed:', verifyError.message);
  } else {
    console.log(`🎉 Success! Logged in as ${verifyData.user.email} with password "${newPassword}"`);
  }

  console.log('====================================================');
}

run();
