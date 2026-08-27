-- =============================================================================
-- Migration: 20260828000002_clinical_whatsapp_notifications.sql
-- Subsystem: Clinical WhatsApp Automated Notification Engine
-- Purpose:
--   1. Table for automated daily dosage schedules and reminders
--   2. Optimizes WABA and session routing for high-throughput clinical messaging
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.dosage_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID,
  patient_id UUID REFERENCES public.patient_registry(id) ON DELETE CASCADE,
  patient_phone VARCHAR(20) NOT NULL,
  medication_name VARCHAR(255) NOT NULL,
  dosage_frequency VARCHAR(50) NOT NULL,
  hinglish_instruction TEXT,
  time_of_day VARCHAR(20) NOT NULL, -- 'morning', 'afternoon', 'evening', 'night'
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_dosage_schedules_patient 
  ON public.dosage_schedules (patient_id, is_active);

CREATE INDEX IF NOT EXISTS idx_dosage_schedules_time_pod 
  ON public.dosage_schedules (time_of_day, is_active, pod_id);

ALTER TABLE IF EXISTS public.dosage_schedules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'dosage_schedules' AND policyname = 'Allow authenticated and service role on dosage_schedules'
  ) THEN
    CREATE POLICY "Allow authenticated and service role on dosage_schedules" 
      ON public.dosage_schedules FOR ALL 
      TO authenticated, service_role 
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
