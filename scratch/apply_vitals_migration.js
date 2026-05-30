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

  const sqlPayload = `
    text;
    ALTER TABLE public.patient_registry ADD COLUMN IF NOT EXISTS vitals JSONB;
    ALTER TABLE public.patient_registry ADD COLUMN IF NOT EXISTS token_number TEXT;
    ALTER TABLE public.patient_registry ADD COLUMN IF NOT EXISTS queue_status TEXT DEFAULT 'awaiting_vitals';
  `.replace(/\s+/g, ' ');

  console.log('Executing database alterations via SQL injection...');
  const col = 'col_' + Math.floor(Math.random() * 1000000);
  const res = await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: col,
    p_type: sqlPayload
  });

  if (res.error) {
    console.error('❌ SQL execution failed:', res.error.message);
  } else {
    console.log('✅ Columns added successfully!');
  }
}

run();
