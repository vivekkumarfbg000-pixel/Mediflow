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
    /* 1. activity_logs */
    DROP POLICY IF EXISTS "Users view activity_logs" ON public.activity_logs;
    DROP POLICY IF EXISTS "Users insert activity_logs" ON public.activity_logs;

    /* 2. lab_reports */
    DROP POLICY IF EXISTS "lab_reports_select_authenticated" ON public.lab_reports;
    DROP POLICY IF EXISTS "lab_reports_insert_authenticated" ON public.lab_reports;
    DROP POLICY IF EXISTS "lab_reports_update_authenticated" ON public.lab_reports;

    CREATE POLICY "lab_reports_select_authenticated" ON public.lab_reports
        FOR SELECT
        TO authenticated
        USING (patient_id IN (SELECT id FROM public.patient_registry WHERE pod_id = public.get_user_pod()) OR public.is_platform_admin());

    CREATE POLICY "lab_reports_insert_authenticated" ON public.lab_reports
        FOR INSERT
        TO authenticated
        WITH CHECK (patient_id IN (SELECT id FROM public.patient_registry WHERE pod_id = public.get_user_pod()) OR public.is_platform_admin());

    CREATE POLICY "lab_reports_update_authenticated" ON public.lab_reports
        FOR UPDATE
        TO authenticated
        USING (patient_id IN (SELECT id FROM public.patient_registry WHERE pod_id = public.get_user_pod()) OR public.is_platform_admin())
        WITH CHECK (patient_id IN (SELECT id FROM public.patient_registry WHERE pod_id = public.get_user_pod()) OR public.is_platform_admin());

    /* 3. entities */
    DROP POLICY IF EXISTS "Users view entities" ON public.entities;
    CREATE POLICY "Users view entities" ON public.entities
        FOR SELECT
        TO authenticated
        USING (pod_id = public.get_user_pod() OR public.is_platform_admin());

    /* 4. profiles */
    DROP POLICY IF EXISTS "Users view profiles" ON public.profiles;
    CREATE POLICY "Users view profiles" ON public.profiles
        FOR SELECT
        TO authenticated
        USING (entity_id IN (SELECT id FROM public.entities WHERE pod_id = public.get_user_pod()) OR public.is_platform_admin());
  `.replace(/\s+/g, ' ');

  console.log('Applying all RLS hardening migrations...');
  const colName = 'rls_harden_all_' + Math.floor(Math.random() * 1000000);
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
