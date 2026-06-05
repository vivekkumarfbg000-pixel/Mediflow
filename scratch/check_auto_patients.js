const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkPatients() {
  const { data, error } = await supabase
    .from('patient_registry')
    .select('name, phone, created_at')
    .ilike('name', 'Auto Test%')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching patients:', error);
  } else {
    console.log('Last 5 Auto Test Patients in DB:', data);
  }
}

checkPatients();
