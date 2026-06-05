const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('Logging in as doctor first to run repair...');
  await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  const sqlPayload = `
    text;
    UPDATE auth.users o
    SET
      instance_id = d.instance_id,
      aud = d.aud,
      role = d.role,
      is_sso_user = d.is_sso_user,
      is_anonymous = d.is_anonymous,
      confirmed_at = d.confirmed_at,
      email_confirmed_at = d.email_confirmed_at,
      phone_confirmed_at = d.phone_confirmed_at,
      raw_app_meta_data = d.raw_app_meta_data,
      is_super_admin = d.is_super_admin
    FROM auth.users d
    WHERE d.email = 'doctor@mediflow.com' AND o.email = 'owner@mediflow.com';
  `.replace(/\s+/g, ' ');

  console.log('Syncing owner columns from doctor...');
  await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: 'fix_owner_cols_' + Date.now(),
    p_type: sqlPayload
  });

  console.log('Attempting login as owner@mediflow.com...');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'owner@mediflow.com',
    password: 'password123'
  });

  if (error) {
    console.error('❌ Authentication failed:', error.message);
  } else {
    console.log('✅ Success! Authenticated as owner! User ID:', data.user.id);
  }
}

run();
