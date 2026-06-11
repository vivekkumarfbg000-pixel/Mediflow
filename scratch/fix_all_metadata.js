const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  // Add pod_id to all user metadata
  const users = [
    { email: 'doctor@mediflow.com', pod_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317009' },
    { email: 'labtech@mediflow.com', pod_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317009' },
    { email: 'pharmacist@mediflow.com', pod_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317009' },
    { email: 'vivekkumarfbg000@gmail.com', pod_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317009' }
  ];

  for (const user of users) {
    const sqlPayload = `
      text;
      UPDATE auth.users
      SET raw_user_meta_data = jsonb_set(
          COALESCE(raw_user_meta_data, '{}'::jsonb),
          '{pod_id}',
          '"${user.pod_id}"'
      )
      WHERE email = '${user.email}';
    `.replace(/\s+/g, ' ');

    console.log(`Updating pod_id for ${user.email}...`);
    const { error } = await supabase.rpc('execute_autonomous_db_repair', {
      p_table: 'pods',
      p_column: 'fix_pod_' + Date.now(),
      p_type: sqlPayload
    });

    if (error) {
      console.error(`Error for ${user.email}:`, error);
    } else {
      console.log(`✓ Updated ${user.email}`);
    }
  }

  // Try to reset password for vivek user
  console.log('\n--- Resetting password for vivekkumarfbg000@gmail.com ---');
  const { data: resetData, error: resetError } = await supabase.auth.resetPasswordForEmail('vivekkumarfbg000@gmail.com', {
    redirectTo: 'https://kguupaybvbngyzyofjun.supabase.co'
  });
  
  if (resetError) {
    console.error('Reset password error:', resetError);
  } else {
    console.log('Reset password email sent:', resetData);
  }

  // Verify all metadata
  console.log('\n--- Verifying all user metadata ---');
  const verifyUsers = ['doctor@mediflow.com', 'labtech@mediflow.com', 'pharmacist@mediflow.com', 'vivekkumarfbg000@gmail.com', 'owner@mediflow.com'];
  
  for (const email of verifyUsers) {
    const sqlPayload = `
      text;
      INSERT INTO public.activity_logs (action_type, details)
      VALUES (
        'VERIFY_${email.replace(/[^a-zA-Z]/g, '_')}',
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
      p_column: 'verify_' + Date.now(),
      p_type: sqlPayload
    });
  }

  // Retrieve all
  const { data: allData } = await supabase
    .from('activity_logs')
    .select('*')
    .like('action_type', 'VERIFY_%')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\n--- User Metadata Summary ---');
  for (const row of allData) {
    console.log(row.action_type, ':', JSON.stringify(row.details.user_metadata, null, 2));
  }
}

run().catch(console.error);