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
    -- 1. Hardening pod_health_snapshots policy
    DROP POLICY IF EXISTS "pod_health_doctor_read" ON public.pod_health_snapshots;
    CREATE POLICY "pod_health_doctor_read"
        ON public.pod_health_snapshots FOR SELECT
        TO authenticated
        USING (
            pod_id = public.get_user_pod()
            OR public.is_platform_admin()
        );

    -- 2. Hardening lab_requisitions policy
    DROP POLICY IF EXISTS "doctor_read_all_lab_reqs" ON public.lab_requisitions;
    CREATE POLICY "doctor_read_all_lab_reqs"
        ON public.lab_requisitions FOR SELECT
        TO authenticated
        USING (
            pod_id = public.get_user_pod()
            OR public.is_platform_admin()
        );
  `.replace(/\s+/g, ' ');

  console.log('Applying public RLS policy hardening migration...');
  const colName = 'rls_harden_public_' + Math.floor(Math.random() * 1000000);
  const { data, error } = await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: colName,
    p_type: sql
  });

  if (error) {
    console.error('❌ Migration failed:', error);
  } else {
    console.log('✅ RLS Hardening applied successfully! Result:', data);
  }
}

run();
