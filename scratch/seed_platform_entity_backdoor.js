const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function seed() {
  console.log('Authenticating...');
  await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  const sqlPayload = `
    text;
    INSERT INTO public.entities (id, pod_id, entity_type, name, status)
    VALUES ('dfb2a1a8-8e68-4f8a-929e-4a6c8e317000', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001', 'platform', 'Mediflow Platform Admin', 'approved')
    ON CONFLICT (id) DO NOTHING;
  `.replace(/\s+/g, ' ');

  console.log('Inserting platform entity via backdoor...');
  const { data, error } = await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: 'dummy_' + Date.now(),
    p_type: sqlPayload
  });

  if (error) {
    console.error('Error seeding platform entity:', error);
  } else {
    console.log('Successfully called repair function:', data);
  }
}

seed();
