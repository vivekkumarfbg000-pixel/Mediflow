-- ═══════════════════════════════════════════════════════════════════════════════
-- VITALSYNC CLINIC OS — Phase 1 OCR Workflow Fix Migration
-- Migration ID : 20260924000000_phase1_ocr_workflow_fix.sql
-- Safe to re-run: ALL statements are fully idempotent
-- ═══════════════════════════════════════════════════════════════════════════════

-- SECTION 1: ENABLE ROW LEVEL SECURITY
ALTER TABLE public.patient_registry     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_prescriptions   ENABLE ROW LEVEL SECURITY;

-- SECTION 2: patient_registry RLS POLICIES
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'patient_registry' AND policyname = 'vs_patient_registry_select') THEN
    CREATE POLICY vs_patient_registry_select ON public.patient_registry FOR SELECT TO authenticated, anon USING (true);
    RAISE NOTICE 'CREATED: vs_patient_registry_select';
  ELSE RAISE NOTICE 'EXISTS : vs_patient_registry_select'; END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'patient_registry' AND policyname = 'vs_patient_registry_insert') THEN
    CREATE POLICY vs_patient_registry_insert ON public.patient_registry FOR INSERT TO authenticated, anon WITH CHECK (true);
    RAISE NOTICE 'CREATED: vs_patient_registry_insert';
  ELSE RAISE NOTICE 'EXISTS : vs_patient_registry_insert'; END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'patient_registry' AND policyname = 'vs_patient_registry_update') THEN
    CREATE POLICY vs_patient_registry_update ON public.patient_registry FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);
    RAISE NOTICE 'CREATED: vs_patient_registry_update';
  ELSE RAISE NOTICE 'EXISTS : vs_patient_registry_update'; END IF;
END $$;

-- SECTION 3: appointments RLS POLICIES
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'appointments' AND policyname = 'vs_appointments_select') THEN
    CREATE POLICY vs_appointments_select ON public.appointments FOR SELECT TO authenticated, anon USING (true);
    RAISE NOTICE 'CREATED: vs_appointments_select';
  ELSE RAISE NOTICE 'EXISTS : vs_appointments_select'; END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'appointments' AND policyname = 'vs_appointments_insert') THEN
    CREATE POLICY vs_appointments_insert ON public.appointments FOR INSERT TO authenticated, anon WITH CHECK (true);
    RAISE NOTICE 'CREATED: vs_appointments_insert';
  ELSE RAISE NOTICE 'EXISTS : vs_appointments_insert'; END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'appointments' AND policyname = 'vs_appointments_update') THEN
    CREATE POLICY vs_appointments_update ON public.appointments FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);
    RAISE NOTICE 'CREATED: vs_appointments_update';
  ELSE RAISE NOTICE 'EXISTS : vs_appointments_update'; END IF;
END $$;

-- SECTION 4: saas_prescriptions RLS POLICIES
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saas_prescriptions' AND policyname = 'vs_saas_prescriptions_select') THEN
    CREATE POLICY vs_saas_prescriptions_select ON public.saas_prescriptions FOR SELECT TO authenticated, anon USING (true);
    RAISE NOTICE 'CREATED: vs_saas_prescriptions_select';
  ELSE RAISE NOTICE 'EXISTS : vs_saas_prescriptions_select'; END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saas_prescriptions' AND policyname = 'vs_saas_prescriptions_insert') THEN
    CREATE POLICY vs_saas_prescriptions_insert ON public.saas_prescriptions FOR INSERT TO authenticated, anon WITH CHECK (true);
    RAISE NOTICE 'CREATED: vs_saas_prescriptions_insert';
  ELSE RAISE NOTICE 'EXISTS : vs_saas_prescriptions_insert'; END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saas_prescriptions' AND policyname = 'vs_saas_prescriptions_update') THEN
    CREATE POLICY vs_saas_prescriptions_update ON public.saas_prescriptions FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);
    RAISE NOTICE 'CREATED: vs_saas_prescriptions_update';
  ELSE RAISE NOTICE 'EXISTS : vs_saas_prescriptions_update'; END IF;
END $$;

-- SECTION 5: appointments payment_status column + Smart Queue backfill
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending';
COMMENT ON COLUMN public.appointments.payment_status
  IS 'Payment gate: pending | cleared | refunded. paper_scan MUST start as pending (Smart Queue Inviolability).';
UPDATE public.appointments
SET    payment_status = 'pending'
WHERE  source = 'paper_scan'
  AND  payment_status = 'cleared'
  AND  id NOT IN (
         SELECT DISTINCT appointment_id
         FROM   public.unified_invoices
         WHERE  payment_status IN ('cleared','paid','completed','settled')
           AND  appointment_id IS NOT NULL
       );

-- SECTION 6: patient_registry — all OCR-written columns (idempotent guards)
ALTER TABLE public.patient_registry
  ADD COLUMN IF NOT EXISTS source                  TEXT        DEFAULT 'counter',
  ADD COLUMN IF NOT EXISTS is_chronic              BOOLEAN     DEFAULT false,
  ADD COLUMN IF NOT EXISTS chronic_conditions      JSONB       DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS address                 TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS abha_id                 TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS token_number            TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS patient_code            TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pod_id                  TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS welcome_sent_at         TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS queue_status            TEXT        DEFAULT 'registered',
  ADD COLUMN IF NOT EXISTS vitals                  JSONB       DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS latest_prescription_id  TEXT        DEFAULT NULL;

-- SECTION 7: vitalsync_wal_outbox — offline retry queue
CREATE TABLE IF NOT EXISTS public.vitalsync_wal_outbox (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type  TEXT        NOT NULL,
  payload         JSONB       NOT NULL,
  pod_id          TEXT        DEFAULT NULL,
  retry_count     INTEGER     NOT NULL DEFAULT 0,
  last_error      TEXT        DEFAULT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  replayed_at     TIMESTAMPTZ DEFAULT NULL
);
COMMENT ON TABLE public.vitalsync_wal_outbox
  IS 'WAL Outbox: offline queue for failed Supabase writes. Replayed on reconnect with idempotent UUID keys.';
ALTER TABLE public.vitalsync_wal_outbox ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vitalsync_wal_outbox' AND policyname = 'vs_wal_outbox_all') THEN
    CREATE POLICY vs_wal_outbox_all ON public.vitalsync_wal_outbox FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
    RAISE NOTICE 'CREATED: vs_wal_outbox_all';
  ELSE RAISE NOTICE 'EXISTS : vs_wal_outbox_all'; END IF;
END $$;

-- SECTION 8: PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_patient_registry_phone           ON public.patient_registry (phone);
CREATE INDEX IF NOT EXISTS idx_patient_registry_pod_id          ON public.patient_registry (pod_id);
CREATE INDEX IF NOT EXISTS idx_patient_registry_source          ON public.patient_registry (source);
CREATE INDEX IF NOT EXISTS idx_patient_registry_queue_status    ON public.patient_registry (queue_status);
CREATE INDEX IF NOT EXISTS idx_patient_registry_is_chronic      ON public.patient_registry (is_chronic) WHERE is_chronic = true;
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id_date     ON public.appointments (patient_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_payment_status      ON public.appointments (payment_status);
CREATE INDEX IF NOT EXISTS idx_appointments_pod_id              ON public.appointments (pod_id);
CREATE INDEX IF NOT EXISTS idx_appointments_source              ON public.appointments (source);
CREATE INDEX IF NOT EXISTS idx_wal_outbox_status_created        ON public.vitalsync_wal_outbox (status, created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 9: VERIFICATION QUERIES (run after applying to confirm correctness)
-- ─────────────────────────────────────────────────────────────────────────────

-- V1: patient_registry RLS policies — expect 3 rows (select, insert, update)
SELECT policyname, roles, cmd FROM pg_policies WHERE tablename = 'patient_registry' AND policyname LIKE 'vs_%' ORDER BY cmd;

-- V2: appointments RLS policies — expect 3 rows
SELECT policyname, roles, cmd FROM pg_policies WHERE tablename = 'appointments' AND policyname LIKE 'vs_%' ORDER BY cmd;

-- V3: wrongly-cleared paper_scan appointments — expect 0
SELECT COUNT(*) AS wrongly_cleared_paper_scan FROM public.appointments WHERE source = 'paper_scan' AND payment_status = 'cleared';

-- V4: WAL outbox table exists — expect 1 row
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vitalsync_wal_outbox';

-- V5: all patient_registry OCR columns present — expect 12 rows
SELECT column_name, data_type, column_default
FROM   information_schema.columns
WHERE  table_schema = 'public'
  AND  table_name   = 'patient_registry'
  AND  column_name  IN ('source','is_chronic','chronic_conditions','address','abha_id','token_number','patient_code','pod_id','queue_status','vitals','welcome_sent_at','latest_prescription_id')
ORDER BY column_name;
