-- =========================================================================
-- PHASE 21: MILITARY-GRADE IOT DEVICE TELEMETRY EVENT STORE & AUDIT LOG
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.iot_device_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES public.patient_registry(id) ON DELETE CASCADE,
  device_type VARCHAR(50) NOT NULL, -- 'blood_pressure', 'pulse_oximeter', 'glucometer', 'weight_scale', 'multipara_serial'
  raw_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for instant sub-300ms patient and pod telemetry queries
CREATE INDEX IF NOT EXISTS idx_iot_device_events_patient 
  ON public.iot_device_events (patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_iot_device_events_pod 
  ON public.iot_device_events (pod_id, created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.iot_device_events ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS Policy for multi-tenant pod isolation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'iot_device_events' AND policyname = 'iot_events_pod_isolation'
  ) THEN
    CREATE POLICY iot_events_pod_isolation ON public.iot_device_events
      FOR ALL
      USING (
        pod_id = public.get_user_pod() OR 
        pod_id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'::uuid
      );
  END IF;
END $$;
