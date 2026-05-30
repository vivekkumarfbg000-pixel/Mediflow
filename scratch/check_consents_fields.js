const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('Authenticating...');
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  const { data, error } = await supabase.from('patient_consents').select('*').limit(5);
  if (error) {
    console.error('Error fetching patient_consents:', error.message);
  } else {
    console.log('Fetched consents count:', data.length);
    if (data.length > 0) {
      console.log('Consent row keys:', Object.keys(data[0]));
      console.log('Consent rows:', data);
    } else {
      console.log('No rows in patient_consents');
    }
  }
}

run();
