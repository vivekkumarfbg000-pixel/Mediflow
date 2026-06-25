const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Dynamically load environment variables from backend/.env if available
function loadEnv() {
  const envPaths = [
    path.join(__dirname, '../backend/.env'),
    path.join(__dirname, '.env'),
    path.join(__dirname, '../.env')
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf-8');
        content.split('\n').forEach(line => {
          const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
          if (match) {
            const key = match[1];
            let value = match[2] || '';
            if (value.startsWith('"') && value.endsWith('"')) {
              value = value.substring(1, value.length - 1);
            } else if (value.startsWith("'") && value.endsWith("'")) {
              value = value.substring(1, value.length - 1);
            }
            process.env[key] = value.trim();
          }
        });
      } catch (e) {
        console.warn('Failed to parse .env file:', e.message);
      }
      break;
    }
  }
}
loadEnv();

const supabaseUrl = process.env.SUPABASE_URL || 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';
const doctorEmail = process.env.DOCTOR_EMAIL || 'doctor@mediflow.com';
const doctorPassword = process.env.DOCTOR_PASSWORD || 'password123';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('Authenticating as doctor...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: doctorEmail,
    password: doctorPassword
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
