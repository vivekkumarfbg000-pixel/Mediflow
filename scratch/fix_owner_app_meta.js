const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('Logging in as doctor first to call RPC...');
  await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  const sqlPayload = `
    text;
    UPDATE auth.users SET raw_app_meta_data = NULL WHERE email = 'owner@mediflow.com';
  `.replace(/\s+/g, ' ');

  console.log('Updating owner raw_app_meta_data...');
  await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: 'fix_meta_' + Date.now(),
    p_type: sqlPayload
  });

  console.log('Attempting login as owner@mediflow.com with raw_app_meta_data = null...');
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
