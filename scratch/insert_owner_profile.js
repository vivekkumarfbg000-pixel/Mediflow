const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  const sqlPayload = `
    text;
    INSERT INTO public.profiles (id, entity_id, role, consultation_fee, display_name)
    VALUES (
      'dfb2a1a8-8e68-4f8a-929e-4a6c8e317109',
      'dfb2a1a8-8e68-4f8a-929e-4a6c8e317009',
      'platform_admin',
      0.00,
      'SaaS Platform Owner'
    );
  `.replace(/\s+/g, ' ');

  console.log('Inserting profiles row for platform owner...');
  const { error } = await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: 'insert_owner_prof_' + Date.now(),
    p_type: sqlPayload
  });

  if (error) {
    console.error('❌ Insert failed:', error);
  } else {
    console.log('✅ Insert successful!');
  }
}

run();
