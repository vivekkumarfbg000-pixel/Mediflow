const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('Authenticating...');
  await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  const sql = `
    text;
    
    INSERT INTO public.pods (id, name, clinic_code, is_active)
    VALUES (
      'dfb2a1a8-8e68-4f8a-929e-4a6c8e317009',
      'Mediflow HQ Operations Pod',
      'MF-HQ99',
      true
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.entities (id, pod_id, entity_type, name, status, is_active)
    VALUES (
      'dfb2a1a8-8e68-4f8a-929e-4a6c8e317009',
      'dfb2a1a8-8e68-4f8a-929e-4a6c8e317009',
      'clinic',
      'Mediflow HQ Operations',
      'approved',
      true
    )
    ON CONFLICT (id) DO NOTHING;
  `.replace(/\s+/g, ' ');

  console.log('Seeding admin pod and entity...');
  const colName = 'dummy_col_seed_' + Math.floor(Math.random() * 1000000);
  const { data, error } = await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: colName,
    p_type: sql
  });

  if (error) {
    console.error('❌ Seeding failed:', error.message);
  } else {
    console.log('✅ Seeding completed! Result:', data);
  }
}

run();
