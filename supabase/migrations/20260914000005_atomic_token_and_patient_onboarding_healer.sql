-- ==============================================================================
-- 🏛️ VitalSync / Mediflow Enterprise Database Migration
-- Migration: 20260914000005_atomic_token_and_patient_onboarding_healer.sql
-- Purpose:
--   1. Strict Concurrency Serialization for OPD Tokens (pg_advisory_xact_lock)
--   2. Dual-Table Maximum Token Evaluation across BOTH appointments & patient_registry
--   3. Idempotent Schema Alignment for appointment & invoice linkage (encounter_id)
--   4. Zero Token Collision guarantee across WhatsApp Chatbot and Counter Walk-ins
-- ==============================================================================

-- STEP 1: Schema Idempotency - Ensure foreign and linkage columns exist
ALTER TABLE public.unified_invoices ADD COLUMN IF NOT EXISTS encounter_id UUID;
ALTER TABLE public.unified_invoices ADD COLUMN IF NOT EXISTS token_number TEXT;

ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS token_number TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS patient_name TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS patient_phone TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'counter';

ALTER TABLE public.patient_registry ADD COLUMN IF NOT EXISTS token_number TEXT;
ALTER TABLE public.patient_registry ADD COLUMN IF NOT EXISTS queue_status TEXT DEFAULT 'registered';

-- STEP 2: Drop existing token function signatures to prevent overload mismatch
DROP FUNCTION IF EXISTS public.generate_next_token_number(TEXT, UUID);
DROP FUNCTION IF EXISTS public.generate_next_token_number(UUID, DATE);
DROP FUNCTION IF EXISTS public.generate_next_token_number(UUID, TEXT);
DROP FUNCTION IF EXISTS public.generate_next_token_number(TEXT);
DROP FUNCTION IF EXISTS public.generate_next_token_number();

-- STEP 3: Signature 1: Core Atomic Function (p_virtual_date TEXT, p_pod_id UUID)
CREATE OR REPLACE FUNCTION public.generate_next_token_number(
  p_virtual_date TEXT,
  p_pod_id UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_val INT;
  v_token TEXT;
  v_date TEXT := COALESCE(NULLIF(TRIM(p_virtual_date), ''), TO_CHAR(CURRENT_DATE AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD'));
  v_lock_key BIGINT;
  v_max_appt INT := 0;
  v_max_reg INT := 0;
BEGIN
  -- Strict concurrency serialization: lock keyed on MD5 hash of pod_id + date
  -- Prevents race condition collisions between simultaneous WhatsApp and Walk-in requests
  v_lock_key := ('x' || SUBSTRING(MD5(COALESCE(p_pod_id::text, 'global') || v_date) FROM 1 FOR 15))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- 1. Compute highest token sequence allocated from appointments table
  SELECT COALESCE(MAX(
    CASE 
      WHEN token_number ~ '^T-[0-9]+' THEN CAST(SUBSTRING(token_number FROM 3 FOR 4) AS INT)
      WHEN token_number ~ '^TK-[0-9]+' THEN CAST(SUBSTRING(token_number FROM 4 FOR 4) AS INT)
      WHEN token_number ~ '^[0-9]+$' THEN CAST(token_number AS INT)
      ELSE 0
    END
  ), 0)
  INTO v_max_appt
  FROM public.appointments
  WHERE (p_pod_id IS NULL OR pod_id = p_pod_id OR pod_id = '00000000-0000-0000-0000-000000000001'::uuid OR pod_id IS NULL)
    AND (
      virtual_date = v_date
      OR TO_CHAR(appointment_time AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') = v_date
      OR TO_CHAR(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') = v_date
      OR appointment_time::text LIKE (v_date || '%')
    )
    AND (status IS NULL OR status != 'cancelled');

  -- 2. Compute highest token sequence allocated from patient_registry table (walk-ins)
  SELECT COALESCE(MAX(
    CASE 
      WHEN token_number ~ '^T-[0-9]+' THEN CAST(SUBSTRING(token_number FROM 3 FOR 4) AS INT)
      WHEN token_number ~ '^TK-[0-9]+' THEN CAST(SUBSTRING(token_number FROM 4 FOR 4) AS INT)
      WHEN token_number ~ '^[0-9]+$' THEN CAST(token_number AS INT)
      ELSE 0
    END
  ), 0)
  INTO v_max_reg
  FROM public.patient_registry
  WHERE (p_pod_id IS NULL OR pod_id = p_pod_id OR pod_id = '00000000-0000-0000-0000-000000000001'::uuid OR pod_id IS NULL)
    AND (
      TO_CHAR(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') = v_date
      OR TO_CHAR(updated_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') = v_date
    );

  -- 3. Take absolute highest sequence across both sources
  v_next_val := GREATEST(v_max_appt, v_max_reg) + 1;

  -- 4. Format as standard two-digit token (T-01, T-02, etc.)
  v_token := 'T-' || LPAD(COALESCE(v_next_val, 1)::TEXT, 2, '0');
  RETURN v_token;
END;
$$;

-- STEP 4: Signature 2: Overload (p_pod_id UUID, p_date DATE)
CREATE OR REPLACE FUNCTION public.generate_next_token_number(
  p_pod_id UUID DEFAULT NULL,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.generate_next_token_number(
    TO_CHAR(COALESCE(p_date, CURRENT_DATE AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD'),
    p_pod_id
  );
END;
$$;

-- STEP 5: Signature 3: Overload (p_pod_id UUID, p_virtual_date TEXT)
CREATE OR REPLACE FUNCTION public.generate_next_token_number(
  p_pod_id UUID,
  p_virtual_date TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.generate_next_token_number(p_virtual_date, p_pod_id);
END;
$$;

-- STEP 6: Grant Execution Permissions to All Roles
GRANT EXECUTE ON FUNCTION public.generate_next_token_number(TEXT, UUID) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.generate_next_token_number(UUID, DATE) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.generate_next_token_number(UUID, TEXT) TO authenticated, service_role, anon;
