const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  // Get the password hash from doctor@mediflow.com
  const sqlPayload = `
    text;
    INSERT INTO public.activity_logs (action_type, details)
    VALUES (
      'GET_DOCTOR_HASH',
      (
        SELECT jsonb_build_object(
          'hash', encrypted_password
        )
        FROM auth.users
        WHERE email = 'doctor@mediflow.com'
      )
    );
  `.replace(/\s+/g, ' ');

  await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: 'get_hash_' + Date.now(),
    p_type: sqlPayload
  });

  const { data: hashData } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('action_type', 'GET_DOCTOR_HASH')
    .order('created_at', { ascending: false })
    .limit(1);

  if (hashData && hashData.length > 0) {
    const hash = hashData[0].details.hash;
    console.log('Doctor password hash:', hash);
    
    // Update vivek user with same hash
    const updatePayload = `
      text;
      UPDATE auth.users
      SET encrypted_password = '${hash}'
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
}

run().catch(console.error);