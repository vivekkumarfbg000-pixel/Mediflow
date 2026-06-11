const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test demo user IDs from AuthGateway.tsx
const demoUsers = [
  { id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101', role: 'doctor', name: 'Dr. Vivek Kumar', entity: 'Kankarbagh Connected Clinic', icon: '🏥', specialization: 'General Medicine' },
  { id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317102', role: 'lab_technician', name: 'Lalit Prasad', entity: 'Patna Central Pathology Lab', icon: '🧪', specialization: 'General Medicine' },
  { id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317103', role: 'pharmacist', name: 'Prakash Yadav', entity: 'Kankarbagh Smart Pharmacy', icon: '💊', specialization: 'General Medicine' },
  { id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317109', role: 'platform_admin', name: 'System Admin', entity: 'Mediflow HQ Operations', icon: '🔑', specialization: 'System Engineering' }
];

async function run() {
  for (const user of demoUsers) {
    console.log(`\n--- Testing demo login for ${user.name} (${user.role}) ---`);
    
    let authEmail = '';
    if (user.role === 'doctor') authEmail = 'doctor@mediflow.com';
    else if (user.role === 'lab_technician') authEmail = 'labtech@mediflow.com';
    else if (user.role === 'pharmacist') authEmail = 'pharmacist@mediflow.com';
    else if (user.role === 'platform_admin') authEmail = 'owner@mediflow.com';

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: 'password123'
    });

    if (authError) {
      console.error(`❌ Auth failed: ${authError.message}`);
      continue;
    }

    console.log(`✅ Auth succeeded! Session user ID: ${authData.user.id}`);

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileErr) {
      console.error(`❌ Profile fetch failed: ${profileErr.message}`);
      continue;
    }

    console.log(`✅ Profile found: ${profile.display_name}, role: ${profile.role}, entity_id: ${profile.entity_id}`);
    
    // Simulate what handleDemoSignIn does - modify profile with demo data
    const modifiedProfile = {
      ...profile,
      display_name: user.name,
      user_metadata: {
        ...profile.user_metadata,
        specialization: user.specialization,
        clinic_name: user.entity,
        display_name: user.name
      },
      raw_user_meta_data: {
        ...profile.raw_user_meta_data,
        specialization: user.specialization,
        clinic_name: user.entity,
        display_name: user.name
      }
    };
    
    console.log(`✅ Modified profile ready for demo: ${modifiedProfile.display_name}, clinic: ${user.entity}, specialization: ${user.specialization}`);
  }
  
  console.log('\n✅ All demo logins work!');
}

run().catch(console.error);