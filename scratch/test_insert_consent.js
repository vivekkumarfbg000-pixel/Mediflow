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

  const patientId = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317402'; // existing patient ID

  console.log('Testing insert...');
  const { data, error } = await supabase.from('patient_consents').insert({
    patient_id: patientId,
    consent_type: 'in_person_override',
    granted_at: new Date().toISOString()
  });

  if (error) {
    console.error('Error inserting:', error);
  } else {
    console.log('Inserted successfully:', data);
  }
}

run();
