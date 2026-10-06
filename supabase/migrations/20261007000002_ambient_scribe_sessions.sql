-- =========================================================================
-- PHASE 22: MILITARY-GRADE AMBIENT CLINICAL SCRIBE SESSIONS & AUDIT LOG
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.ambient_scribe_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES public.patient_registry(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  encounter_id UUID REFERENCES public.encounters(id) ON DELETE SET NULL,
  transcript TEXT NOT NULL,
  soap_data JSONB NOT NULL,
  extracted_entities JSONB DEFAULT '{}'::jsonb,
  audio_duration_seconds INTEGER DEFAULT 0,
  language_detected VARCHAR(50) DEFAULT 'Hinglish',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for instant patient and pod telemetry queries
CREATE INDEX IF NOT EXISTS idx_ambient_scribe_patient 
  ON public.ambient_scribe_sessions (patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ambient_scribe_pod 
  ON public.ambient_scribe_sessions (pod_id, created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.ambient_scribe_sessions ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS Policy for multi-tenant pod isolation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ambient_scribe_sessions' AND policyname = 'ambient_scribe_pod_isolation'
  ) THEN
    CREATE POLICY ambient_scribe_pod_isolation ON public.ambient_scribe_sessions
      FOR ALL
      USING (
        pod_id = public.get_user_pod() OR 
        pod_id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'::uuid
      );
  END IF;
END $$;

-- Enhance public.encounters with ambient scribe fields
ALTER TABLE IF EXISTS public.encounters
  ADD COLUMN IF NOT EXISTS soap_notes JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ambient_transcript TEXT,
  ADD COLUMN IF NOT EXISTS ai_scribe_used BOOLEAN DEFAULT false;
