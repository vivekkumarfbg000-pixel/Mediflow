const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const timestamp = Date.now();
const clinicEmail = `newclinic_${timestamp}@test.com`;

async function run() {
  console.log('=== TESTING CLINIC REGISTRATION (doctor signup) ===');
  console.log('Using email:', clinicEmail);
  
  // Sign up as a new clinic/doctor
  const { data: clinicData, error: clinicError } = await supabase.auth.signUp({
    email: clinicEmail,
    password: 'password123',
    options: {
      data: {
        display_name: 'Dr. New Clinic',
        role: 'doctor',
        clinic_name: 'New Test Clinic',
        clinic_phone: '7777777777',
        clinic_address: 'New Test Address',
        specialization: 'Cardiology',
        pending_registration: true
      }
    }
  });
  
  if (clinicError) {
    console.error('Clinic signup error:', clinicError);
    return;
  }
  
  console.log('Clinic user created:', clinicData.user.id);
  console.log('Initial metadata:', JSON.stringify(clinicData.user.user_metadata, null, 2));
  
  // Wait for trigger
  await new Promise(r => setTimeout(r, 1000));
  
  // Call register_clinic_network RPC
  const { data: rpcData, error: rpcError } = await supabase.rpc('register_clinic_network', {
    p_clinic_name: 'New Test Clinic',
    p_clinic_phone: '7777777777',
    p_clinic_address: 'New Test Address',
    p_specialization: 'Cardiology'
  });
  
  if (rpcError) {
    console.error('RPC error:', rpcError);
    return;
  }
  
  const clinicCode = Array.isArray(rpcData) ? rpcData[0]?.clinic_code : rpcData?.clinic_code;
  console.log('✅ Clinic registered with code:', clinicCode);
  
  // Verify doctor can login
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: clinicEmail,
    password: 'password123'
  });
  
  if (loginError) {
    console.error('❌ Doctor login failed:', loginError.message);
  } else {
    console.log('✅ Doctor login succeeded:', loginData.user.id);
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', loginData.user.id).single();
    console.log('   Profile role:', profile.role, '| entity_id:', profile.entity_id);
    console.log('   User metadata:', JSON.stringify(loginData.user.user_metadata, null, 2));
    
    // Check for pod_id
    if (loginData.user.user_metadata.pod_id) {
      console.log('   ✅ pod_id present in metadata:', loginData.user.user_metadata.pod_id);
    } else {
      console.log('   ❌ pod_id MISSING from metadata');
    }
  }
}

run().catch(console.error);