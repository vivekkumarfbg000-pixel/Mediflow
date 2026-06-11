const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  // Fix owner user_metadata
  const sqlPayload = `
    text;
    INSERT INTO public.activity_logs (action_type, details)
    VALUES (
      'FIX_OWNER_META',
      (
        UPDATE auth.users
        SET raw_user_meta_data = jsonb_set(
            COALESCE(raw_user_meta_data, '{}'::jsonb),
            '{role}',
            '"platform_admin"'
        ),
        raw_user_meta_data = jsonb_set(
            COALESCE(raw_user_meta_data, '{}'::jsonb),
            '{display_name}',
            '"SaaS Platform Owner"'
        ),
        raw_user_meta_data = jsonb_set(
            COALESCE(raw_user_meta_data, '{}'::jsonb),
            '{pod_id}',
            '"dfb2a1a8-8e68-4f8a-929e-4a6c8e317009"'
        )
        WHERE email = 'owner@mediflow.com'
        RETURNING id, email, raw_user_meta_data
      )
    );
  `.replace(/\s+/g, ' ');

  console.log('Running debug sql...');
  await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: 'fix_owner_meta_' + Date.now(),
    p_type: sqlPayload
  });

  console.log('Retrieving logs...');
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('action_type', 'FIX_OWNER_META')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error:', error);
  } else if (data && data.length > 0) {
    console.log('Results:', JSON.stringify(data[0].details, null, 2));
  } else {
    console.log('No data returned');
  }
}

run().catch(console.error);