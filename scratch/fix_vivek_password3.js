const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Known hash from other users (they all use the same)
const KNOWN_HASH = '$2a$06$6N.fP3TPANM1ZJMFY3DvHutLQQvlentgr0LC8ySHDbBGK/DvkF26G';

async function run() {
  console.log('Starting...');
  await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });
  console.log('Signed in as doctor');

  // Update vivek user with known hash
  const updatePayload = `
    text;
    UPDATE auth.users
    SET encrypted_password = '${KNOWN_HASH}'
    WHERE email = 'vivekkumarfbg000@gmail.com';
  `.replace(/\s+/g, ' ');

  console.log('Updating vivek password...');
  const { error } = await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: 'update_vivek_pass_' + Date.now(),
    p_type: updatePayload
  });

  if (error) {
    console.error('Update error:', error);
  } else {
    console.log('Password updated!');
    
    // Test login
    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email: 'vivekkumarfbg000@gmail.com',
      password: 'password123'
    });
    
    if (loginError) {
      console.error('Login still fails:', loginError);
    } else {
      console.log('✅ Login succeeded!', data.user.id);
    }
  }
}

run().catch(err => console.error('Fatal:', err));