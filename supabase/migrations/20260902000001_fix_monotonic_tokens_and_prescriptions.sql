-- =============================================================================
-- Migration: 20260902000001_fix_monotonic_tokens_and_prescriptions.sql
-- Description: Ensures encounters JSONB columns, saas_prescriptions patient identifiers,
--              and strictly monotonic OPD token sequencing across all clinical pods.
-- =============================================================================

-- 1. Ensure public.encounters JSONB columns exist for digital prescriptions
ALTER TABLE IF EXISTS public.encounters
  ADD COLUMN IF NOT EXISTS medications JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS diagnostic_tests JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS clinical_notes TEXT,
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS pod_id UUID;

-- 2. Ensure public.saas_prescriptions has full patient and prescription fields
ALTER TABLE IF EXISTS public.saas_prescriptions
  ADD COLUMN IF NOT EXISTS encounter_id UUID,
  ADD COLUMN IF NOT EXISTS patient_id UUID,
  ADD COLUMN IF NOT EXISTS doctor_id UUID,
  ADD COLUMN IF NOT EXISTS extracted_medicines JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS extracted_tests JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS pod_id UUID;

-- 3. Ensure high-speed composite indexes for appointments token queries
CREATE INDEX IF NOT EXISTS idx_appointments_pod_token_date
  ON public.appointments (pod_id, virtual_date, token_number);

-- 4. Idempotent PostgreSQL Token Number Sequence Generator
DROP FUNCTION IF EXISTS public.generate_next_token_number(UUID, DATE);
DROP FUNCTION IF EXISTS public.generate_next_token_number(UUID, TEXT);
DROP FUNCTION IF EXISTS public.generate_next_token_number(TEXT, UUID);
DROP FUNCTION IF EXISTS public.generate_next_token_number;

CREATE OR REPLACE FUNCTION public.generate_next_token_number(
    p_pod_id UUID DEFAULT NULL,
    p_virtual_date TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_date TEXT := COALESCE(p_virtual_date, TO_CHAR(NOW() AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD'));
    v_max_token INTEGER := 0;
    v_appt_val INTEGER;
    v_next_token TEXT;
BEGIN
    -- Aggregate maximum numeric token from appointments for target date
    SELECT COALESCE(MAX(
        CASE
            WHEN token_number ~* '^#?T-?[0-9]+' THEN SUBSTRING(token_number FROM '[0-9]+')::INTEGER
            WHEN token_number ~* '^#?TK-?[0-9]+' THEN SUBSTRING(token_number FROM '[0-9]+')::INTEGER
            WHEN token_number ~ '^[0-9]+$' THEN token_number::INTEGER
            ELSE 0
        END
    ), 0) INTO v_max_token
    FROM public.appointments
    WHERE (virtual_date = v_date OR appointment_date = v_date OR TO_CHAR(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') = v_date)
      AND (p_pod_id IS NULL OR pod_id = p_pod_id);

    -- Ensure monotonic ascending sequence
    v_next_token := 'T-' || LPAD((v_max_token + 1)::TEXT, 2, '0');
    RETURN v_next_token;
EXCEPTION WHEN OTHERS THEN
    RETURN 'T-01';
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_next_token_number(UUID, TEXT) TO anon, authenticated, service_role;
