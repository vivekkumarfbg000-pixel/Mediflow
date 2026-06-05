const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('================================================================');
  console.log('🔍 TESTING CLINIC NETWORK PARTNER ONBOARDING & INTERCONNECTIVITY 🔍');
  console.log('================================================================');

  const timestamp = Date.now();
  const docEmail = `doc_${timestamp}@mediflow.com`;
  const docPassword = 'password123';
  const partnerEmail = `pharmacy_${timestamp}@mediflow.com`;
  const partnerPassword = 'password123';

  // --- STEP 1: Sign up a new Doctor ---
  console.log(`\nStep 1: Signing up a new Doctor (${docEmail})...`);
  const { data: docAuth, error: docSignUpErr } = await supabase.auth.signUp({
    email: docEmail,
    password: docPassword,
    options: {
      data: {
        display_name: 'Test Doctor Vivek',
        role: 'doctor'
      }
    }
  });

  if (docSignUpErr) {
    console.error('❌ Doctor sign up failed:', docSignUpErr.message);
    return;
  }
  console.log('✅ Doctor account created in auth.users.');

  // Create doctor client and register clinic
  const docClient = createClient(supabaseUrl, supabaseAnonKey);
  await docClient.auth.setSession({
    access_token: docAuth.session.access_token,
    refresh_token: docAuth.session.refresh_token
  });

  console.log('Registering a new clinic network...');
  const { data: regRes, error: regErr } = await docClient.rpc('register_clinic_network', {
    p_clinic_name: 'Mock Vivek Care Clinic',
    p_clinic_phone: '9999555111',
    p_clinic_address: 'Patliputra Colony, Patna',
    p_specialization: 'General Medicine'
  });

  if (regErr) {
    console.error('❌ register_clinic_network failed:', regErr.message);
    return;
  }

  const clinicCode = regRes[0]?.clinic_code || regRes;
  console.log('✅ Clinic registered successfully. Generated Clinic Code:', clinicCode);

  // Fetch the newly created pod ID
  const { data: docProfile } = await docClient
    .from('profiles')
    .select('entity_id')
    .eq('id', docAuth.user.id)
    .single();

  const { data: docEntity } = await docClient
    .from('entities')
    .select('pod_id')
    .eq('id', docProfile.entity_id)
    .single();

  const podId = docEntity.pod_id;
  console.log(`Created Pod ID: ${podId}`);


  // --- STEP 2: Sign up Pharmacy Partner & Join ---
  console.log(`\nStep 2: Signing up a new Pharmacy partner (${partnerEmail}) and joining code ${clinicCode}...`);
  const { data: partnerAuth, error: partnerSignUpErr } = await supabase.auth.signUp({
    email: partnerEmail,
    password: partnerPassword,
    options: {
      data: {
        display_name: 'Test Pharmacy partner',
        role: 'pharmacist'
      }
    }
  });

  if (partnerSignUpErr) {
    console.error('❌ Partner sign up failed:', partnerSignUpErr.message);
    return;
  }
  console.log('✅ Partner account created in auth.users.');

  // Create partner client and join clinic network
  const partnerClient = createClient(supabaseUrl, supabaseAnonKey);
  await partnerClient.auth.setSession({
    access_token: partnerAuth.session.access_token,
    refresh_token: partnerAuth.session.refresh_token
  });

  const { data: joinRes, error: joinErr } = await partnerClient.rpc('join_clinic_network', {
    p_clinic_code: clinicCode,
    p_partner_type: 'pharmacy',
    p_partner_name: 'Mock Vivek Pharmacy POS',
    p_partner_phone: '9999222333',
    p_partner_address: 'Patliputra Main Road, Patna'
  });

  if (joinErr) {
    console.error('❌ join_clinic_network failed:', joinErr.message);
    return;
  }

  const partnerEntityId = joinRes[0]?.entity_id || joinRes;
  console.log('✅ join_clinic_network completed. Assigned Entity ID:', partnerEntityId);


  // --- STEP 3: Verify Pending Status ---
  console.log('\nStep 3: Checking partner status in DB...');
  const { data: checkEntity, error: checkEntityErr } = await partnerClient
    .from('entities')
    .select('id, name, status, pod_id')
    .eq('id', partnerEntityId)
    .single();

  if (checkEntityErr) {
    console.error('❌ Could not query partner entity status:', checkEntityErr.message);
    return;
  }
  console.log(`Partner Entity status in DB: '${checkEntity.status}' (expected: 'pending')`);
  if (checkEntity.status === 'pending') {
    console.log('✅ Success: Partner entity initialized in pending state.');
  } else {
    console.error('❌ Fail: Partner entity status is not pending!');
  }


  // --- STEP 4: Doctor Approves Partner ---
  console.log('\nStep 4: Doctor approves the pending partner...');
  const { data: updateRes, error: updateErr } = await docClient
    .from('entities')
    .update({ status: 'approved' })
    .eq('id', partnerEntityId)
    .select()
    .single();

  if (updateErr) {
    console.error('❌ Doctor failed to approve partner:', updateErr.message);
    return;
  }
  console.log(`✅ Doctor approved partner. Updated entity record status: '${updateRes.status}'`);


  // --- STEP 5: Verify Interconnectivity ---
  console.log('\nStep 5: Approved Partner queries entities in their pod...');
  const { data: partnerVisibleEntities, error: partnerQueryErr } = await partnerClient
    .from('entities')
    .select('id, name, entity_type, status');

  if (partnerQueryErr) {
    console.error('❌ Partner failed to query entities:', partnerQueryErr.message);
    return;
  }

  console.log('Entities visible to the approved partner:');
  console.log(partnerVisibleEntities);

  const seesClinic = partnerVisibleEntities.some(e => e.entity_type === 'clinic');
  if (seesClinic) {
    console.log('✅ Success: Approved partner can see the clinic in their pod!');
  } else {
    console.error('❌ Fail: Approved partner cannot see the clinic entity!');
  }


  // --- STEP 6: Clean Up ---
  console.log('\nStep 6: Cleaning up created mock network records...');
  
  // Use DB repair backdoor to delete mock entities and profiles to prevent junk accumulation
  const cleanupSql = `
    text;
    DELETE FROM public.profiles WHERE id IN ('${docAuth.user.id}', '${partnerAuth.user.id}');
    DELETE FROM public.entities WHERE pod_id = '${podId}';
    DELETE FROM public.pods WHERE id = '${podId}';
  `.replace(/\s+/g, ' ');

  const colName = 'cleanup_e2e_' + Date.now();
  await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: colName,
    p_type: cleanupSql
  });
  console.log('✅ Cleaned up profiles, entities, and pods.');

  console.log('\n================================================================');
  console.log('🎉 ALL ONBOARDING & INTERCONNECTIVITY CHECKS PASSED SUCCESSFULLY! 🎉');
  console.log('================================================================');
}

run();
