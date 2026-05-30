const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTablesAuth() {
  console.log('Authenticating as doctor...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });
  if (authError) {
    console.error('Auth error:', authError.message);
    return;
  }
  console.log('Logged in successfully!');

  const tables = ['pods', 'profiles', 'entities', 'clinic_staff', 'reagent_inventory', 'pharmacy_inventory', 'master_test_catalog'];
  for (const t of tables) {
    console.log(`Querying table ${t}...`);
    const { data, error } = await supabase.from(t).select('*');
    if (error) {
      console.error(`Error querying ${t}:`, error.message);
    } else {
      console.log(`Table ${t} count:`, data.length);
      if (data.length > 0) {
        console.log(`Rows in ${t}:`, data);
      }
    }
  }
}

checkTablesAuth();
