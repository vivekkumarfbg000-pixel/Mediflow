const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkUser() {
  console.log('Querying profiles table for email: vivekobrayfbg000@gmail.com...');
  
  // Since we cannot read auth.users with anon key, we can query profiles if there is one containing the email or user details
  const { data: profiles, error: profileErr } = await supabase
    .from('profiles')
    .select('*');
    
  if (profileErr) {
    console.error('Error fetching profiles:', profileErr);
    return;
  }
  
  console.log(`Found ${profiles.length} profiles in database.`);
  const matchingProfiles = profiles.filter(p => 
    p.display_name?.toLowerCase().includes('vivek') || 
    p.user_metadata?.email?.toLowerCase().includes('vivek')
  );
  
  console.log('Matching profiles:', JSON.stringify(matchingProfiles, null, 2));
  
  // Test authentication
  console.log('\nTesting authentication with credentials...');
  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'vivekobrayfbg000@gmail.com',
      password: 'password@123'
    });
    if (authError) {
      console.log('Auth failed:', authError.message);
    } else {
      console.log('Auth success! User ID:', authData.user.id);
    }
  } catch (err) {
    console.error('Auth check threw error:', err);
  }
}

checkUser();
