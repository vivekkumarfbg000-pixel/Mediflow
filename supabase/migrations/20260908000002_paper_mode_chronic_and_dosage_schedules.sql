-- ==============================================================================
-- 🏛️ VitalSync Big Tech Idempotent Migration: Paper Mode, Chronic Care & Dosage Schedules
-- Migration: 20260908000002_paper_mode_chronic_and_dosage_schedules.sql
-- ==============================================================================

-- 1. Ensure patient_registry columns for Chronic Disease Care and Smart Codes
ALTER TABLE IF EXISTS public.patient_registry 
  ADD COLUMN IF NOT EXISTS is_chronic BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS chronic_conditions TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS patient_code TEXT,
  ADD COLUMN IF NOT EXISTS is_premium_member BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_patient_registry_is_chronic 
  ON public.patient_registry (is_chronic) 
  WHERE is_chronic = TRUE;

CREATE INDEX IF NOT EXISTS idx_patient_registry_patient_code 
  ON public.patient_registry (patient_code);

-- 2. Ensure clinic_pods has operating_mode column ('digital_emr' | 'paper_rx')
ALTER TABLE IF EXISTS public.clinic_pods
  ADD COLUMN IF NOT EXISTS operating_mode TEXT DEFAULT 'digital_emr';

-- 3. Ensure dosage_schedules table exists for automated WhatsApp dose reminders
CREATE TABLE IF NOT EXISTS public.dosage_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID REFERENCES public.clinic_pods(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES public.patient_registry(id) ON DELETE CASCADE,
  patient_phone TEXT,
  patient_name TEXT,
  medicine_name TEXT NOT NULL,
  dosage TEXT,
  frequency TEXT,
  duration TEXT,
  instructions TEXT,
  reminder_times TEXT[] DEFAULT '{"08:00 AM", "08:00 PM"}',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dosage_schedules_patient 
  ON public.dosage_schedules (patient_id);

CREATE INDEX IF NOT EXISTS idx_dosage_schedules_pod 
  ON public.dosage_schedules (pod_id);

CREATE INDEX IF NOT EXISTS idx_dosage_schedules_status 
  ON public.dosage_schedules (status);

-- Enable RLS on dosage_schedules
ALTER TABLE public.dosage_schedules ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dosage_schedules' AND policyname = 'dosage_schedules_read_authenticated'
  ) THEN
    CREATE POLICY dosage_schedules_read_authenticated ON public.dosage_schedules
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dosage_schedules' AND policyname = 'dosage_schedules_write_authenticated'
  ) THEN
    CREATE POLICY dosage_schedules_write_authenticated ON public.dosage_schedules
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dosage_schedules' AND policyname = 'dosage_schedules_anon_access'
  ) THEN
    CREATE POLICY dosage_schedules_anon_access ON public.dosage_schedules
      FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 4. Enable Realtime Publications for Live CDC
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dosage_schedules;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chronic_care_cohorts;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
END $$;

-- Add updated_at trigger for dosage_schedules
CREATE OR REPLACE FUNCTION public.trigger_set_dosage_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dosage_schedules_updated_at ON public.dosage_schedules;
CREATE TRIGGER trg_dosage_schedules_updated_at
  BEFORE UPDATE ON public.dosage_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_dosage_schedules_updated_at();
