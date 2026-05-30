const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('Authenticating as doctor...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });
  if (authError) {
    console.error('Auth error:', authError.message);
    return;
  }

  const patientId = crypto.randomUUID();
  console.log('1. Registering patient without ABHA ID...');
  const { data: regData, error: regError } = await supabase
    .from('patient_registry')
    .insert({
      id: patientId,
      name: 'Integration Test Patient',
      phone: '99999' + Math.floor(Math.random() * 100000),
      age: 28,
      gender: 'Female',
      allergies: ['Dust'],
      chronic_conditions: ['None'],
      abha_id: null,
      registered_by: authData.user.id,
      registered_at_entity: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002'
    })
    .select()
    .single();

  if (regError) {
    console.error('❌ Registration failed:', regError.message);
    return;
  }
  console.log('✅ Patient registered in database:', regData.id);

  console.log('2. Recording vitals and token...');
  const testVitals = {
    temperature: '98.4',
    bloodPressure: '115/75',
    pulseRate: '68',
    weight: '62',
    recordedAt: new Date().toISOString()
  };
  const testToken = 'TK-99';

  const { data: updateData, error: updateError } = await supabase
    .from('patient_registry')
    .update({
      vitals: testVitals,
      token_number: testToken,
      queue_status: 'awaiting_consultation'
    })
    .eq('id', patientId)
    .select()
    .single();

  if (updateError) {
    console.error('❌ Vitals update failed:', updateError.message);
    return;
  }
  console.log('✅ Vitals updated in database successfully!');
  console.log('Vitals:', updateData.vitals);
  console.log('Token Number:', updateData.token_number);
  console.log('Queue Status:', updateData.queue_status);

  // Clean up
  console.log('Cleaning up test patient...');
  await supabase.from('patient_registry').delete().eq('id', patientId);
  console.log('✅ Cleaned up successfully!');
}

run();
