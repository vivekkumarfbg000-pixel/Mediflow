const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test(email, password) {
  console.log(`\nAttempting login for ${email}...`);
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.log('❌ Login failed:', error.message);
      return;
    }
    console.log('✅ Login succeeded! User ID:', data.user.id);
    console.log('User Metadata:', JSON.stringify(data.user.user_metadata, null, 2));
    
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id);
      
    if (profileError) {
      console.error('❌ Profile fetch error:', profileError);
    } else {
      console.log('Profiles returned:', JSON.stringify(profiles, null, 2));
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

async function runAll() {
  await test('doctor@mediflow.com', 'password123');
  await test('labtech@mediflow.com', 'password123');
  await test('owner@mediflow.com', 'password123');
  await test('vivekkumarfbg000@gmail.com', 'password123');
  await test('pharmacist@mediflow.com', 'password123');
}

runAll();