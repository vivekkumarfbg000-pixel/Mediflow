-- ==============================================================================
-- Migration: 20260914000002_silicon_valley_realtime_cloud_sync.sql
-- Description: Enterprise-Grade 360° Realtime Cloud Sync Upgrade:
--              1. Add lab_test_bills and missing tables to REPLICA IDENTITY FULL
--              2. Register lab_test_bills in 'supabase_realtime' publication
--              3. Grant permissive RLS read/write policies to 'anon' and 'authenticated'
--                 roles so Supabase Realtime WebSocket engine broadcasts all CDC frames.
-- ==============================================================================

-- 1. Enforce REPLICA IDENTITY FULL on lab_test_bills and related operational tables
DO $$
DECLARE
  target_tables text[] := ARRAY[
    'lab_test_bills',
    'appointments',
    'patient_registry',
    'unified_invoices',
    'financial_ledgers',
    'whatsapp_sessions',
    'medicine_bills',
    'lab_requisitions',
    'pathology_reports',
    'lab_reports',
    'vitalsync_pool_settlements',
    'clinic_sops',
    'chronic_care_cohorts',
    'encounters',
    'saas_prescriptions',
    'inventory_holds',
    'saas_invoices',
    'waba_connections',
    'patient_referral_rewards',
    'pharmacy_inventory',
    'reagent_inventory'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY target_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL;', t);
      RAISE NOTICE 'Enforced REPLICA IDENTITY FULL on public.%', t;
    END IF;
  END LOOP;
END $$;

-- 2. Idempotently register lab_test_bills in the 'supabase_realtime' publication
DO $$
DECLARE
  pub_exists boolean;
  t text;
  target_tables text[] := ARRAY[
    'lab_test_bills',
    'appointments',
    'patient_registry',
    'unified_invoices',
    'financial_ledgers',
    'whatsapp_sessions',
    'medicine_bills',
    'lab_requisitions',
    'pathology_reports',
    'lab_reports',
    'vitalsync_pool_settlements',
    'clinic_sops',
    'chronic_care_cohorts',
    'encounters',
    'saas_prescriptions',
    'inventory_holds',
    'saas_invoices',
    'waba_connections',
    'patient_referral_rewards',
    'pharmacy_inventory',
    'reagent_inventory'
  ];
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') INTO pub_exists;
  
  IF NOT pub_exists THEN
    CREATE PUBLICATION supabase_realtime;
    RAISE NOTICE 'Created publication supabase_realtime';
  END IF;

  FOREACH t IN ARRAY target_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t);
        RAISE NOTICE 'Added public.% to publication supabase_realtime', t;
      END IF;
    END IF;
  END LOOP;
END $$;

-- 3. Ensure permissive RLS read/write policies for lab_test_bills
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'lab_test_bills'
  ) THEN
    ALTER TABLE public.lab_test_bills ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Allow public read on lab_test_bills" ON public.lab_test_bills;
    CREATE POLICY "Allow public read on lab_test_bills" ON public.lab_test_bills
      FOR SELECT TO public USING (true);

    DROP POLICY IF EXISTS "Allow public write on lab_test_bills" ON public.lab_test_bills;
    CREATE POLICY "Allow public write on lab_test_bills" ON public.lab_test_bills
      FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
END $$;
