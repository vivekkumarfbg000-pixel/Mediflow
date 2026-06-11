const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  // First check if user exists
  await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  // Try to create the user via signUp with a known password
  // First let's try to see if we can sign in with a different email
  console.log('Trying to sign in as vivekkumarfbg000@gmail.com...');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'vivekkumarfbg000@gmail.com',
    password: 'password123'
  });
  
  if (error) {
    console.log('User does not exist or wrong password:', error.message);
    
    // Try to create via signUp
    console.log('Attempting to create user via signUp...');
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: 'vivekkumarfbg000@gmail.com',
      password: 'password123',
      options: {
        data: {
          display_name: 'Vivek Kumar',
          role: 'platform_admin',
          pod_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317009'
        }
      }
    });
    
    if (signUpError) {
      console.error('SignUp error:', signUpError);
    } else {
      console.log('SignUp data:', signUpData);
    }
  } else {
    console.log('Sign in succeeded!', data);
  }

  // Also verify all other user metadata has pod_id
  const users = ['doctor@mediflow.com', 'labtech@mediflow.com', 'pharmacist@mediflow.com'];
  
  for (const email of users) {
    const sqlPayload = `
      text;
      INSERT INTO public.activity_logs (action_type, details)
      VALUES (
        'USER_META_${email.replace(/[^a-zA-Z]/g, '_')}',
        (
          SELECT jsonb_build_object(
            'id', id,
            'email', email,
            'user_metadata', raw_user_meta_data
          )
          FROM auth.users
          WHERE email = '${email}'
        )
      );
    `.replace(/\s+/g, ' ');

    await supabase.rpc('execute_autonomous_db_repair', {
      p_table: 'pods',
      p_column: 'meta_' + Date.now(),
      p_type: sqlPayload
    });
  }

  // Retrieve all
  const { data: allData } = await supabase
    .from('activity_logs')
    .select('*')
    .like('action_type', 'USER_META_%')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\n--- User Metadata Summary ---');
  for (const row of allData) {
    console.log(row.action_type, ':', JSON.stringify(row.details.user_metadata, null, 2));
  }
}

run().catch(console.error);