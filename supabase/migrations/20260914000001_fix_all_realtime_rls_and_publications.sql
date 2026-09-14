-- ==============================================================================
-- Migration: 20260914000001_fix_all_realtime_rls_and_publications.sql
-- Description: Military-Grade 360° Realtime Sync Engine Upgrade:
--              1. Enforce REPLICA IDENTITY FULL across all 24 operational tables
--              2. Register all missing tables in 'supabase_realtime' publication
--              3. Grant permissive RLS read/write policies to both 'anon' and
--                 'authenticated' roles for sovereign pod operations so Supabase
--                 Realtime WebSocket server never drops CDC events.
-- ==============================================================================

-- 1. Enforce REPLICA IDENTITY FULL on all 24 operational tables
DO $$
DECLARE
  target_tables text[] := ARRAY[
    'appointments',
    'patient_registry',
    'unified_invoices',
    'financial_ledgers',
    'whatsapp_sessions',
    'medicine_bills',
    'medicine_bill_items',
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
    'bank_upi_transactions',
    'pods',
    'entities',
    'pharmacy_inventory',
    'reagent_inventory',
    'dosage_schedules'
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

-- 2. Idempotently add all tables to the 'supabase_realtime' publication
DO $$
DECLARE
  pub_exists boolean;
  t text;
  target_tables text[] := ARRAY[
    'appointments',
    'patient_registry',
    'unified_invoices',
    'financial_ledgers',
    'whatsapp_sessions',
    'medicine_bills',
    'medicine_bill_items',
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
    'bank_upi_transactions',
    'pods',
    'entities',
    'pharmacy_inventory',
    'reagent_inventory',
    'dosage_schedules'
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
        RAISE NOTICE 'Added table public.% to publication supabase_realtime', t;
      ELSE
        RAISE NOTICE 'Table public.% already present in publication supabase_realtime', t;
      END IF;
    END IF;
  END LOOP;
END $$;

-- 3. Idempotently establish permissive fallback RLS policies on all operational tables
--    Guarantees Supabase Realtime WebSocket engine delivers live CDC events to connected clients
DO $$
DECLARE
  rls_tables text[] := ARRAY[
    'appointments',
    'patient_registry',
    'unified_invoices',
    'financial_ledgers',
    'whatsapp_sessions',
    'medicine_bills',
    'medicine_bill_items',
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
    'bank_upi_transactions',
    'pharmacy_inventory',
    'reagent_inventory',
    'dosage_schedules'
  ];
  t text;
  pol_name text;
BEGIN
  FOREACH t IN ARRAY rls_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      -- Enable RLS safely
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);

      -- Policy 1: Realtime CDC read access for anon & authenticated roles
      pol_name := format('allow_realtime_cdc_read_%s', t);
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = t AND policyname = pol_name
      ) THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true);',
          pol_name, t
        );
        RAISE NOTICE 'Created policy % on public.%', pol_name, t;
      END IF;

      -- Policy 2: Permissive write access for clinic operational transactions
      pol_name := format('allow_realtime_cdc_write_%s', t);
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = t AND policyname = pol_name
      ) THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);',
          pol_name, t
        );
        RAISE NOTICE 'Created policy % on public.%', pol_name, t;
      END IF;

      -- Grant standard DML to anon, authenticated, service_role
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon, authenticated, service_role;', t);
    END IF;
  END LOOP;
END $$;

-- 4. Idempotently ensure clinical and priority columns exist on appointments & lab_requisitions
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS is_emergency BOOLEAN DEFAULT false;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT false;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS patient_name TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS patient_phone TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS problem TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS chief_complaint TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS appointment_time TIMESTAMPTZ;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'cleared';

ALTER TABLE public.lab_requisitions ADD COLUMN IF NOT EXISTS patient_name TEXT;
ALTER TABLE public.lab_requisitions ADD COLUMN IF NOT EXISTS patient_phone TEXT;

