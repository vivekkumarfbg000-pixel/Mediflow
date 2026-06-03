-- Mediflow Connected Care Ecosystem — Missing Columns Fix
-- Migration ID: 20260604000001_fix_missing_columns
-- Created: 2026-06-04
-- Purpose: Add columns that the frontend services require but are absent from the DB schema.
--          These were omitted from the original CREATE TABLE statements.

-- ============================================================
-- 1. activity_logs: Add actor_id (who performed the action)
-- ============================================================
ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_id
  ON public.activity_logs(actor_id, created_at DESC)
  WHERE actor_id IS NOT NULL;

-- ============================================================
-- 2. patient_registry: Add allergies, chronic_conditions
--    (frontend sends these as TEXT[] arrays on every patient insert)
-- ============================================================
ALTER TABLE public.patient_registry
  ADD COLUMN IF NOT EXISTS allergies TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS chronic_conditions TEXT[] DEFAULT '{}';

-- ============================================================
-- 3. lab_requisitions: Add lab_entity_id
--    (walk-in and prescription-dispatch inserts send this FK)
-- ============================================================
ALTER TABLE public.lab_requisitions
  ADD COLUMN IF NOT EXISTS lab_entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL;

-- ============================================================
-- 4. appointments table: CREATE (was never applied to live DB)
--    The old schema.sql was a reference file only — not applied.
--    We create it fresh here with full multi-tenant support.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.appointments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id          UUID REFERENCES public.patient_registry(id) ON DELETE SET NULL,
  doctor_id           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  entity_id           UUID REFERENCES public.entities(id) ON DELETE SET NULL,
  pod_id              UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
  status              TEXT NOT NULL DEFAULT 'pending_payment'
                        CHECK (status IN ('pending_payment', 'ready_for_consult', 'completed', 'cancelled')),
  is_virtual          BOOLEAN DEFAULT false,
  virtual_date        TEXT,
  virtual_time        TEXT,
  virtual_meeting_url TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_appointments_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointments_updated_at ON public.appointments;
CREATE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_appointments_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id  ON public.appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_pod_id     ON public.appointments(pod_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status     ON public.appointments(status);

-- Enable RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Pod isolation policy
DROP POLICY IF EXISTS "Enforce tenant pod isolation on appointments" ON public.appointments;
CREATE POLICY "Enforce tenant pod isolation on appointments"
  ON public.appointments
  FOR ALL
  TO authenticated
  USING (pod_id = public.get_user_pod())
  WITH CHECK (pod_id = public.get_user_pod());

-- Grant access
GRANT SELECT, INSERT, UPDATE ON public.appointments TO authenticated;

-- ============================================================
-- 5. unified_invoices: NOTE — paid_at does NOT exist.
--    Frontend bug was fixed in code (removed paid_at from update).
--    No DB change needed here.
-- ============================================================

