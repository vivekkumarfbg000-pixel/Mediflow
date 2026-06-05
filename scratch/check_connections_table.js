const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runCheck() {
  console.log('Authenticating as doctor...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  if (authError) {
    console.error('Auth error:', authError.message);
    return;
  }

  console.log('Querying public.waba_connections...');
  const { data, error } = await supabase
    .from('waba_connections')
    .select('*');

  if (error) {
    console.error('Error querying waba_connections:', error.message);
  } else {
    console.log('Current WABA connections in DB:');
    console.log(JSON.stringify(data, null, 2));
  }
}

runCheck();
