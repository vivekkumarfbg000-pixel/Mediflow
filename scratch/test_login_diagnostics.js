const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const email = 'pharmacist@mediflow.com';
  // Try common passwords
  const passwords = ['password123'];
  
  for (const password of passwords) {
    console.log(`\nAttempting login for ${email} with password: ${password}...`);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        console.log(`❌ Login failed: ${error.message}`);
        continue;
      }
      
      console.log(`✅ Login succeeded! Session user ID: ${data.user.id}`);
      console.log('User Metadata:', JSON.stringify(data.user.user_metadata, null, 2));
      
      console.log('Fetching profile...');
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id);
        
      if (profileError) {
        console.error('❌ Profile fetch error:', profileError);
      } else {
        console.log('Profiles returned:', JSON.stringify(profiles, null, 2));
      }
      
      // Let's run reconcile_profile_role if no profile or to test it
      console.log('Calling reconcile_profile_role...');
      const { data: rpcData, error: rpcError } = await supabase.rpc('reconcile_profile_role');
      if (rpcError) {
        console.error('❌ reconcile_profile_role RPC error:', rpcError);
      } else {
        console.log('✅ reconcile_profile_role RPC succeeded:', rpcData);
      }
      
      return;
    } catch (err) {
      console.error('Unexpected error:', err);
    }
  }
}

run();
