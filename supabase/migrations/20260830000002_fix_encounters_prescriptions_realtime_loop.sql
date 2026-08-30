-- =============================================================================
-- VITALSYNC 360° REALTIME CARE LOOP & PRESCRIPTION PERSISTENCE MIGRATION
-- Migration ID: 20260830000002_fix_encounters_prescriptions_realtime_loop.sql
-- =============================================================================

-- 1. Ensure encounters table has full clinical columns for medications and tests
ALTER TABLE IF EXISTS public.encounters
  ADD COLUMN IF NOT EXISTS medications JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS diagnostic_tests JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
  ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_encounters_pod_id ON public.encounters(pod_id);
CREATE INDEX IF NOT EXISTS idx_encounters_patient_id ON public.encounters(patient_id);
CREATE INDEX IF NOT EXISTS idx_encounters_created_at ON public.encounters(created_at DESC);

-- 2. Ensure saas_prescriptions table exists with complete columns and indices
CREATE TABLE IF NOT EXISTS public.saas_prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    encounter_id UUID REFERENCES public.encounters(id) ON DELETE SET NULL,
    patient_id UUID REFERENCES public.patient_registry(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    extracted_medicines JSONB DEFAULT '[]'::jsonb,
    extracted_tests TEXT[] DEFAULT ARRAY[]::TEXT[],
    prescription_file_url TEXT,
    status VARCHAR(50) DEFAULT 'active',
    pod_id UUID NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.saas_prescriptions
  ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES public.encounters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS extracted_medicines JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS extracted_tests TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.saas_prescriptions ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Enforce tenant pod isolation" ON public.saas_prescriptions';
  EXECUTE 'CREATE POLICY "Enforce tenant pod isolation" ON public.saas_prescriptions FOR ALL TO authenticated USING (pod_id = public.get_user_pod())';
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_saas_prescriptions_pod_id ON public.saas_prescriptions(pod_id);
CREATE INDEX IF NOT EXISTS idx_saas_prescriptions_patient_id ON public.saas_prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_saas_prescriptions_encounter_id ON public.saas_prescriptions(encounter_id);

-- 3. Ensure patient_registry has queue_status and token_number columns
ALTER TABLE IF EXISTS public.patient_registry
  ADD COLUMN IF NOT EXISTS queue_status VARCHAR(50) DEFAULT 'awaiting_consultation',
  ADD COLUMN IF NOT EXISTS token_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 4. Ensure Realtime Publication includes encounters and saas_prescriptions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.encounters';
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
    BEGIN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.saas_prescriptions';
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;
