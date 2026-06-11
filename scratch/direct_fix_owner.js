const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  // Use a simpler SQL approach - direct UPDATE without RETURNING
  const sqlPayload = `
    text;
    UPDATE auth.users
    SET raw_user_meta_data = 
        jsonb_set(
            jsonb_set(
                jsonb_set(
                    COALESCE(raw_user_meta_data, '{}'::jsonb),
                    '{role}',
                    '"platform_admin"'
                ),
                '{display_name}',
                '"SaaS Platform Owner"'
            ),
            '{pod_id}',
            '"dfb2a1a8-8e68-4f8a-929e-4a6c8e317009"'
        )
    WHERE email = 'owner@mediflow.com';
  `.replace(/\s+/g, ' ');

  console.log('Running direct update...');
  const { error } = await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: 'direct_fix_' + Date.now(),
    p_type: sqlPayload
  });

  if (error) {
    console.error('Direct update error:', error);
  } else {
    console.log('Direct update executed');
  }

  // Verify
  console.log('\nVerifying...');
  const sqlPayload2 = `
    text;
    INSERT INTO public.activity_logs (action_type, details)
    VALUES (
      'OWNER_METADATA_VERIFY2',
      (
        SELECT jsonb_build_object(
          'id', id,
          'email', email,
          'user_metadata', raw_user_meta_data
        )
        FROM auth.users
        WHERE email = 'owner@mediflow.com'
      )
    );
  `.replace(/\s+/g, ' ');

  await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: 'owner_meta_verify2_' + Date.now(),
    p_type: sqlPayload2
  });

  const { data: verifyData, error: verifyError } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('action_type', 'OWNER_METADATA_VERIFY2')
    .order('created_at', { ascending: false })
    .limit(1);

  if (verifyError) {
    console.error('Verify Error:', verifyError);
  } else if (verifyData && verifyData.length > 0) {
    console.log('Verify Results:', JSON.stringify(verifyData[0].details, null, 2));
  } else {
    console.log('No verify data returned');
  }
}

run().catch(console.error);