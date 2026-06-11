const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Generate unique test emails
const timestamp = Date.now();
const clinicEmail = `clinic_${timestamp}@test.com`;
const partnerEmail = `pharmacy_${timestamp}@test.com`;

async function run() {
  console.log('=== TESTING PARTNER LOGIN (existing partners) ===');
  
  // Test pharmacist login
  const { data: pharmData, error: pharmError } = await supabase.auth.signInWithPassword({
    email: 'pharmacist@mediflow.com',
    password: 'password123'
  });
  
  if (pharmError) {
    console.error('❌ Pharmacist login failed:', pharmError.message);
  } else {
    console.log('✅ Pharmacist login succeeded:', pharmData.user.id);
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', pharmData.user.id).single();
    console.log('   Profile role:', profile.role, '| entity_id:', profile.entity_id);
  }

  // Test lab technician login
  const { data: labData, error: labError } = await supabase.auth.signInWithPassword({
    email: 'labtech@mediflow.com',
    password: 'password123'
  });
  
  if (labError) {
    console.error('❌ Lab tech login failed:', labError.message);
  } else {
    console.log('✅ Lab tech login succeeded:', labData.user.id);
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', labData.user.id).single();
    console.log('   Profile role:', profile.role, '| entity_id:', profile.entity_id);
  }

  console.log('\n=== TESTING PARTNER SIGNUP (new partner joining clinic) ===');
  console.log('Using emails:', clinicEmail, partnerEmail);
  
  // Create a clinic
  const { data: clinicData, error: clinicError } = await supabase.auth.signUp({
    email: clinicEmail,
    password: 'password123',
    options: {
      data: {
        display_name: 'Dr. Test Clinic',
        role: 'doctor',
        clinic_name: 'Test Clinic',
        clinic_phone: '9999999999',
        clinic_address: 'Test Address',
        specialization: 'General Medicine',
        pending_registration: true
      }
    }
  });
  
  if (clinicError) {
    console.error('Clinic signup error:', clinicError);
    return;
  }
  
  console.log('Clinic user created:', clinicData.user.id);
  
  // Wait for trigger
  await new Promise(r => setTimeout(r, 1000));
  
  // Call register_clinic_network RPC
  const { data: rpcData, error: rpcError } = await supabase.rpc('register_clinic_network', {
    p_clinic_name: 'Test Clinic',
    p_clinic_phone: '9999999999',
    p_clinic_address: 'Test Address',
    p_specialization: 'General Medicine'
  });
  
  if (rpcError) {
    console.error('RPC error:', rpcError);
    return;
  }
  
  const clinicCode = Array.isArray(rpcData) ? rpcData[0]?.clinic_code : rpcData?.clinic_code;
  console.log('✅ Clinic registered with code:', clinicCode);
  
  // Now test partner joining this clinic
  const { data: partnerData, error: partnerError } = await supabase.auth.signUp({
    email: partnerEmail,
    password: 'password123',
    options: {
      data: {
        display_name: 'Test Pharmacy',
        role: 'pharmacist',
        clinic_code: clinicCode,
        partner_type: 'pharmacy',
        partner_phone: '8888888888',
        partner_address: 'Near Clinic',
        pending_registration: true
      }
    }
  });
  
  if (partnerError) {
    console.error('Partner signup error:', partnerError);
    return;
  }
  
  console.log('Partner user created:', partnerData.user.id);
  
  // Wait for trigger
  await new Promise(r => setTimeout(r, 1000));
  
  // Call join_clinic_network RPC
  const { data: joinData, error: joinError } = await supabase.rpc('join_clinic_network', {
    p_clinic_code: clinicCode,
    p_partner_type: 'pharmacy',
    p_partner_name: 'Test Pharmacy',
    p_partner_phone: '8888888888',
    p_partner_address: 'Near Clinic'
  });
  
  if (joinError) {
    console.error('Join RPC error:', joinError);
    return;
  }
  
  console.log('✅ Partner joined clinic:', joinData);
  
  // Verify partner can login
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: partnerEmail,
    password: 'password123'
  });
  
  if (loginError) {
    console.error('❌ Partner login failed:', loginError.message);
  } else {
    console.log('✅ Partner login succeeded:', loginData.user.id);
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
  
  // Cleanup
  await supabase.auth.signOut();
}

run().catch(console.error);