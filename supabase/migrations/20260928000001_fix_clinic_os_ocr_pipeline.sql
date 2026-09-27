-- ============================================================================
-- VITALSYNC CLINIC OS: AUTONOMOUS OCR PRESCRIPTION PIPELINE IDEMPOTENT UPGRADE
-- Migration: 20260928000001_fix_clinic_os_ocr_pipeline.sql
-- Date: 2026-09-28
-- Description: Ensures idempotent schema columns, check constraints, and RLS 
-- policies for saas_prescriptions, appointments, patient_registry, and chronic_care_cohorts.
-- ============================================================================

-- 1. Ensure public.saas_prescriptions exists with correct columns
CREATE TABLE IF NOT EXISTS public.saas_prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    encounter_id UUID REFERENCES public.encounters(id) ON DELETE SET NULL,
    patient_id UUID REFERENCES public.patient_registry(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    extracted_medicines JSONB DEFAULT '[]'::jsonb,
    extracted_tests TEXT[] DEFAULT '{}'::text[],
    prescription_file_url TEXT,
    prescription_image_url TEXT,
    patient_address TEXT,
    diagnosis TEXT,
    is_chronic BOOLEAN DEFAULT false,
    chronic_conditions TEXT[] DEFAULT '{}'::text[],
    source TEXT DEFAULT 'paper_scan',
    status VARCHAR(50) DEFAULT 'active',
    pod_id UUID NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotent column additions for existing deployments
ALTER TABLE public.saas_prescriptions ADD COLUMN IF NOT EXISTS extracted_medicines JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.saas_prescriptions ADD COLUMN IF NOT EXISTS extracted_tests TEXT[] DEFAULT '{}'::text[];
ALTER TABLE public.saas_prescriptions ADD COLUMN IF NOT EXISTS prescription_file_url TEXT;
ALTER TABLE public.saas_prescriptions ADD COLUMN IF NOT EXISTS prescription_image_url TEXT;
ALTER TABLE public.saas_prescriptions ADD COLUMN IF NOT EXISTS patient_address TEXT;
ALTER TABLE public.saas_prescriptions ADD COLUMN IF NOT EXISTS diagnosis TEXT;
ALTER TABLE public.saas_prescriptions ADD COLUMN IF NOT EXISTS is_chronic BOOLEAN DEFAULT false;
ALTER TABLE public.saas_prescriptions ADD COLUMN IF NOT EXISTS chronic_conditions TEXT[] DEFAULT '{}'::text[];
ALTER TABLE public.saas_prescriptions ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'paper_scan';
ALTER TABLE public.saas_prescriptions ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
ALTER TABLE public.saas_prescriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Relax and expand appointments_status_check constraint to prevent code 23514
DO $$
BEGIN
  ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
  ALTER TABLE public.appointments ADD CONSTRAINT appointments_status_check 
    CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'pending_payment', 'awaiting_vitals', 'arrived'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Notice: appointments_status_check update handled: %', SQLERRM;
END $$;

-- 3. Ensure patient_registry has all fields required by Autonomous OCR
ALTER TABLE public.patient_registry ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.patient_registry ADD COLUMN IF NOT EXISTS is_chronic BOOLEAN DEFAULT false;
ALTER TABLE public.patient_registry ADD COLUMN IF NOT EXISTS chronic_conditions TEXT[] DEFAULT '{}'::text[];
ALTER TABLE public.patient_registry ADD COLUMN IF NOT EXISTS welcome_sent_at TIMESTAMPTZ;
ALTER TABLE public.patient_registry ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'counter';

-- 4. Enable RLS and verify permissive policies for saas_prescriptions
ALTER TABLE public.saas_prescriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saas_prescriptions' AND policyname = 'vs_saas_prescriptions_select_all') THEN
    CREATE POLICY vs_saas_prescriptions_select_all ON public.saas_prescriptions FOR SELECT TO authenticated, anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saas_prescriptions' AND policyname = 'vs_saas_prescriptions_insert_all') THEN
    CREATE POLICY vs_saas_prescriptions_insert_all ON public.saas_prescriptions FOR INSERT TO authenticated, anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saas_prescriptions' AND policyname = 'vs_saas_prescriptions_update_all') THEN
    CREATE POLICY vs_saas_prescriptions_update_all ON public.saas_prescriptions FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 5. Realtime CDC Publication inclusion
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.saas_prescriptions;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
