const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testRegister() {
  console.log('Authenticating as doctor...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });
  if (authError) {
    console.error('Auth error:', authError);
    return;
  }
  console.log('Logged in successfully, user ID:', authData.user.id);

  const patientId = crypto.randomUUID();
  const registeredBy = authData.user.id;

  console.log('Inserting into patient_registry...');
  const { data, error } = await supabase
    .from('patient_registry')
    .insert({
      id: patientId,
      name: 'Test Patient ' + Date.now(),
      phone: '99999' + Math.floor(Math.random() * 100000),
      age: 30,
      gender: 'Male',
      allergies: ['Peanuts'],
      chronic_conditions: ['Mild Hypertension'],
      abha_id: '99-8888-7777-6666',
      registered_by: registeredBy,
      registered_at_entity: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002'
    })
    .select();

  if (error) {
    console.error('❌ Insert error details:', error);
  } else {
    console.log('✅ Insert successful!', data);
  }
}

testRegister();
