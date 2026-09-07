-- =============================================================================
-- Migration: 20260907000003_clinic_operating_mode_and_prescription_template.sql
-- Description: Adds is_digital_emr_enabled, operating_mode, and prescription_template
--              to public.pods and public.clinic_sops, relaxes appointments status check,
--              and registers all operational tables in supabase_realtime publication.
-- =============================================================================

-- 1. Add Operating Mode and Prescription Template columns to public.pods
ALTER TABLE IF EXISTS public.pods 
  ADD COLUMN IF NOT EXISTS is_digital_emr_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS operating_mode TEXT DEFAULT 'paper_rx',
  ADD COLUMN IF NOT EXISTS prescription_template JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS upi_vpa TEXT DEFAULT 'vitalsync@axl';

-- 2. Add Operating Mode and Config to public.clinic_sops
ALTER TABLE IF EXISTS public.clinic_sops 
  ADD COLUMN IF NOT EXISTS is_digital_emr_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS operating_mode TEXT DEFAULT 'paper_rx',
  ADD COLUMN IF NOT EXISTS extracted_config JSONB DEFAULT '{}'::jsonb;

-- 3. Ensure appointments table has all care-loop columns & relax status constraint
ALTER TABLE IF EXISTS public.appointments 
  ADD COLUMN IF NOT EXISTS token_number TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'walk_in',
  ADD COLUMN IF NOT EXISTS queue_status TEXT DEFAULT 'waiting_consult',
  ADD COLUMN IF NOT EXISTS vitals JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS platform_fee_deducted NUMERIC DEFAULT 0;

ALTER TABLE IF EXISTS public.appointments 
  DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE IF EXISTS public.appointments 
  ADD CONSTRAINT appointments_status_check 
  CHECK (status IN ('pending_payment', 'ready_for_consult', 'in_consultation', 'scheduled', 'completed', 'cancelled'));

-- 4. Enable Realtime Publications for all Multi-Terminal Clinic Operational Tables
DO $$
BEGIN
  -- Add pods to realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'pods'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pods;
  END IF;

  -- Add appointments to realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'appointments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
  END IF;

  -- Add patient_registry to realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'patient_registry'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.patient_registry;
  END IF;

  -- Add clinic_sops to realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'clinic_sops'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.clinic_sops;
  END IF;
END $$;

-- 5. Seed Sovereign Pod (VS-V01R) with Official Letterhead & Default Paper Rx Mode
UPDATE public.pods
SET 
  is_digital_emr_enabled = FALSE,
  operating_mode = 'paper_rx',
  upi_vpa = COALESCE(NULLIF(upi_vpa, ''), 'vitalsync@axl'),
  prescription_template = jsonb_build_object(
    'doctorName', 'Dr. Rajesh Verma',
    'doctorQualification', 'MBBS, MS (Ophthalmology), FICO (London)',
    'doctorRegNo', 'MCI-84992-A',
    'clinicName', 'VitalSync Smart PolyClinic',
    'clinicAddress', 'Line Bazar, Purnea, Bihar 854301',
    'clinicPhone', '+91 99342 98453',
    'headerColor', '#0284c7',
    'footerNote', 'Emergency Care: Available 24x7 · Valid for Follow-up Review within 15 Days · Please bring this prescription for your review.'
  )
WHERE clinic_code = 'VS-V01R' OR id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
