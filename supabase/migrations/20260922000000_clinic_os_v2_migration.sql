-- ═══════════════════════════════════════════════════════════════════════════════
-- CLINIC OS v2 — MANDATORY MIGRATION
-- Safe to re-run. All statements are idempotent.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. patient_registry: add source tag (identifies OCR patients)
ALTER TABLE public.patient_registry
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'counter';

COMMENT ON COLUMN public.patient_registry.source 
  IS 'Origin channel: counter | whatsapp | qr_scan | paper_scan';

-- 2. patient_registry: add prescription_id (link to prescription record)
ALTER TABLE public.patient_registry
  ADD COLUMN IF NOT EXISTS latest_prescription_id TEXT DEFAULT NULL;

COMMENT ON COLUMN public.patient_registry.latest_prescription_id
  IS 'RX ID of the most recent prescription linked to this patient profile';

-- 3. appointments: add source tag for filtering
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'counter';

COMMENT ON COLUMN public.appointments.source
  IS 'Origin: counter | whatsapp | qr_scan | paper_scan';

-- 4. chronic_care_cohorts: ensure all required columns exist
ALTER TABLE public.chronic_care_cohorts
  ADD COLUMN IF NOT EXISTS retest_test_code TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS retest_test_name TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS care_program_status TEXT DEFAULT 'not_enrolled',
  ADD COLUMN IF NOT EXISTS care_program_fee NUMERIC(10,2) DEFAULT 4000.00;

-- 5. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_patient_registry_source
  ON public.patient_registry (source);

CREATE INDEX IF NOT EXISTS idx_appointments_source
  ON public.appointments (source);

CREATE INDEX IF NOT EXISTS idx_chronic_care_cohorts_patient_id
  ON public.chronic_care_cohorts (patient_id);

CREATE INDEX IF NOT EXISTS idx_chronic_care_cohorts_condition_code
  ON public.chronic_care_cohorts (condition_code);
