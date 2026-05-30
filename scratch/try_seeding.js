const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runSeed() {
  console.log('Authenticating as doctor...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });
  if (authError) {
    console.error('Auth error:', authError.message);
    return;
  }
  console.log('Logged in as doctor! User ID:', authData.user.id);

  // 1. Try seeding pods
  console.log('Seeding pods...');
  const { error: podErr } = await supabase.from('pods').upsert({
    id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
    name: 'Kankarbagh Connected Pod',
    clinic_code: 'MF-A1B2'
  });
  if (podErr) console.error('Error seeding pods:', podErr.message);
  else console.log('✅ Pods seeded successfully!');

  // 2. Try seeding entities
  console.log('Seeding entities...');
  const entities = [
    {
      id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002',
      pod_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
      name: 'Kankarbagh Connected Clinic',
      entity_type: 'clinic',
      status: 'approved',
      is_active: true
    },
    {
      id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317003',
      pod_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
      name: 'Patna Central Pathology Lab',
      entity_type: 'lab',
      status: 'approved',
      is_active: true
    },
    {
      id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317004',
      pod_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
      name: 'Kankarbagh Smart Pharmacy',
      entity_type: 'pharmacy',
      status: 'approved',
      is_active: true
    },
    {
      id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317009',
      pod_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
      name: 'Mediflow Platform Admin',
      entity_type: 'platform',
      status: 'approved',
      is_active: true
    }
  ];

  const { error: entErr } = await supabase.from('entities').upsert(entities);
  if (entErr) console.error('Error seeding entities:', entErr.message);
  else console.log('✅ Entities seeded successfully!');

  // 3. Try seeding profiles
  console.log('Seeding profiles...');
  const profiles = [
    {
      id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101',
      entity_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002',
      role: 'doctor',
      consultation_fee: 450.00
    },
    {
      id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317102',
      entity_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317003',
      role: 'lab_technician'
    },
    {
      id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317103',
      entity_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317004',
      role: 'pharmacist'
    }
  ];

  const { error: profErr } = await supabase.from('profiles').upsert(profiles);
  if (profErr) console.error('Error seeding profiles:', profErr.message);
  else console.log('✅ Profiles seeded successfully!');

  // 4. Try seeding clinic_staff
  console.log('Seeding clinic_staff...');
  const staff = [
    {
      id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317111',
      entity_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002',
      user_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101',
      staff_name: 'Dr. Vivek Kumar',
      role: 'doctor',
      is_active: true,
      pod_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'
    },
    {
      id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317112',
      entity_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317003',
      user_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317102',
      staff_name: 'Lalit Prasad',
      role: 'lab_technician',
      is_active: true,
      pod_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'
    },
    {
      id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317113',
      entity_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317004',
      user_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317103',
      staff_name: 'Prakash Yadav',
      role: 'pharmacist',
      is_active: true,
      pod_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'
    }
  ];

  const { error: staffErr } = await supabase.from('clinic_staff').upsert(staff);
  if (staffErr) console.error('Error seeding clinic_staff:', staffErr.message);
  else console.log('✅ Clinic staff seeded successfully!');
}

runSeed();
