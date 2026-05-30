const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkAuthUsers() {
  const users = [
    { email: 'doctor@mediflow.com', name: 'Doctor' },
    { email: 'labtech@mediflow.com', name: 'Lab Tech' },
    { email: 'pharmacist@mediflow.com', name: 'Pharmacist' }
  ];

  for (const u of users) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: u.email,
      password: 'password123'
    });
    if (error) {
      console.error(`Error logging in as ${u.name}:`, error.message);
    } else {
      console.log(`${u.name} logged in successfully! UUID:`, data.user.id);
    }
  }
}

checkAuthUsers();
