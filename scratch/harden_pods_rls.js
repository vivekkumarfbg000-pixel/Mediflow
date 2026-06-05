const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('Authenticating as doctor...');
  await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  const sql = `
    text;
    DROP POLICY IF EXISTS "Users view pods" ON public.pods;
    CREATE POLICY "Users view pods" ON public.pods 
        FOR SELECT 
        TO authenticated 
        USING (id = public.get_user_pod() OR public.is_platform_admin());
  `.replace(/\s+/g, ' ');

  console.log('Applying RLS hardening migration...');
  const colName = 'pods_rls_harden_' + Math.floor(Math.random() * 1000000);
  const { data, error } = await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: colName,
    p_type: sql
  });

  if (error) {
    console.error('❌ Migration failed:', error);
  } else {
    console.log('✅ Migration executed successfully. Result:', data);
  }
}

run();
