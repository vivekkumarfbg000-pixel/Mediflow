const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('Authenticating as Doctor Vivek...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  if (authError) {
    console.error('Authentication failed:', authError.message);
    return;
  }
  console.log(`Success! Logged in as: ${authData.user.email} (ID: ${authData.user.id})`);

  // Let's first fetch existing appointments to see what's visible
  console.log('\n1. Fetching appointments...');
  const { data: getApps, error: getAppsErr } = await supabase
    .from('appointments')
    .select('*');

  if (getAppsErr) {
    console.error('Failed to select from appointments:', getAppsErr.message);
  } else {
    console.log(`Success! Retrieved ${getApps.length} appointments.`);
    if (getApps.length > 0) {
      console.log('Sample appointment:', getApps[0]);
    }
  }

  // 2. Register/find a patient to associate with an appointment
  console.log('\n2. Retrieving or creating a test patient...');
  const testPhone = '9000012345';
  let patientId = null;

  // Let's query patient_registry
  const { data: patients, error: patientErr } = await supabase
    .from('patient_registry')
    .select('id, name')
    .eq('phone', testPhone)
    .limit(1);

  if (patientErr) {
    console.error('Failed to query patient registry:', patientErr.message);
    return;
  }

  if (patients && patients.length > 0) {
    patientId = patients[0].id;
    console.log(`Found existing test patient: ${patients[0].name} (ID: ${patientId})`);
  } else {
    // Create patient
    console.log('No existing test patient. Creating one...');
    const newPatientId = crypto.randomUUID();
    const { data: newPatient, error: createPatErr } = await supabase
      .from('patient_registry')
      .insert({
        id: newPatientId,
        name: 'RLS Test Patient',
        phone: testPhone,
        age: 40,
        gender: 'Female',
        pod_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001' // Vivek's pod
      })
      .select('id')
      .single();

    if (createPatErr) {
      console.error('Failed to create test patient:', createPatErr.message);
      return;
    }
    patientId = newPatient.id;
    console.log(`Created test patient with ID: ${patientId}`);
  }

  // 3. Attempting to insert an appointment with matching pod_id
  console.log('\n3. Inserting appointment with matching pod_id (dfb2a1a8-8e68-4f8a-929e-4a6c8e317001)...');
  const appointmentId = crypto.randomUUID();
  const { data: newApp, error: insertAppErr } = await supabase
    .from('appointments')
    .insert({
      id: appointmentId,
      patient_id: patientId,
      doctor_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101', // Doctor Vivek
      entity_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002', // Clinic
      pod_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001', // Matching pod
      status: 'ready_for_consult'
    })
    .select('*')
    .single();

  if (insertAppErr) {
    console.error('❌ Insert failed (likely RLS block or trigger error):', insertAppErr.message);
  } else {
    console.log('✅ Insert successful! Appointment details:', newApp);
  }

  // 4. Attempting to insert an appointment with a DIFFERENT/NON-MATCHING pod_id (which should fail RLS WITH CHECK)
  console.log('\n4. Attempting insert with non-matching pod_id (dfb2a1a8-8e68-4f8a-929e-4a6c8e317999)...');
  const wrongPodId = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317999';
  const { data: wrongApp, error: wrongAppErr } = await supabase
    .from('appointments')
    .insert({
      id: crypto.randomUUID(),
      patient_id: patientId,
      doctor_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101',
      entity_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002',
      pod_id: wrongPodId,
      status: 'ready_for_consult'
    });

  if (wrongAppErr) {
    console.log('✅ Successfully blocked by RLS! Error message:', wrongAppErr.message);
  } else {
    console.error('❌ Security breach! RLS allowed insertion of wrong pod ID:', wrongApp);
  }

  // Cleanup: Delete the created test appointment if successful
  if (!insertAppErr) {
    console.log('\n5. Cleaning up test appointment...');
    const { error: deleteErr } = await supabase
      .from('appointments')
      .delete()
      .eq('id', appointmentId);
    if (deleteErr) {
      console.error('Failed to cleanup test appointment:', deleteErr.message);
    } else {
      console.log('Cleanup complete.');
    }
  }
}

run();
