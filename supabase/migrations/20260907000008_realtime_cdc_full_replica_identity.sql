-- ==============================================================================
-- Migration: 20260907000008_realtime_cdc_full_replica_identity.sql
-- Description: Military-Grade Realtime Sync Engine: Enforce REPLICA IDENTITY FULL
--              and idempotently register all 15 public operational tables with
--              the 'supabase_realtime' publication for zero-drop CDC streaming.
-- ==============================================================================

-- 1. Enforce REPLICA IDENTITY FULL across all 15 operational tables
DO $$
DECLARE
  tbl_record record;
  target_tables text[] := ARRAY[
    'appointments',
    'patient_registry',
    'unified_invoices',
    'financial_ledgers',
    'whatsapp_sessions',
    'medicine_bills',
    'lab_requisitions',
    'pathology_reports',
    'vitalsync_pool_settlements',
    'clinic_sops',
    'chronic_care_cohorts',
    'encounters',
    'saas_prescriptions',
    'inventory_holds',
    'saas_invoices'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY target_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL;', t);
      RAISE NOTICE 'Set REPLICA IDENTITY FULL on public.%', t;
    END IF;
  END LOOP;
END $$;

-- 2. Idempotently add all 15 operational tables to the 'supabase_realtime' publication
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
    'lab_requisitions',
    'pathology_reports',
    'vitalsync_pool_settlements',
    'clinic_sops',
    'chronic_care_cohorts',
    'encounters',
    'saas_prescriptions',
    'inventory_holds',
    'saas_invoices'
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
