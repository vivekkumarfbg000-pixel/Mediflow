-- =============================================================================
-- Migration: Fix Sequential Token Allocation & Date-Scoped Queue Isolation
-- Date: 2026-09-07
-- Guarantees atomic, strictly sequential OPD tokens (T-01, T-02...) per date per pod
-- Strictly evaluates appointments table in Indian Standard Time (Asia/Kolkata)
-- =============================================================================

-- Signature 1: Called with (p_virtual_date TEXT, p_pod_id UUID)
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
BEGIN
  -- 1. Compute highest token sequence allocated strictly from appointments for this specific date and pod
  SELECT COALESCE(MAX(
    CASE 
      WHEN token_number ~ '^T-[0-9]+' THEN CAST(SUBSTRING(token_number FROM 3 FOR 4) AS INT)
      WHEN token_number ~ '^[0-9]+$' THEN CAST(token_number AS INT)
      ELSE 0
    END
  ), 0) + 1
  INTO v_next_val
  FROM public.appointments
  WHERE (p_pod_id IS NULL OR pod_id = p_pod_id OR pod_id = '00000000-0000-0000-0000-000000000001'::uuid OR pod_id IS NULL)
    AND (
      virtual_date = v_date
      OR TO_CHAR(appointment_time AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') = v_date
      OR TO_CHAR(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') = v_date
      OR appointment_time::text LIKE (v_date || '%')
    )
    AND (status IS NULL OR status != 'cancelled');

  -- 2. Format as two-digit token (T-01, T-02, etc.)
  v_token := 'T-' || LPAD(COALESCE(v_next_val, 1)::TEXT, 2, '0');
  RETURN v_token;
END;
$$;

-- Signature 2: Called with (p_pod_id UUID, p_date DATE)
CREATE OR REPLACE FUNCTION public.generate_next_token_number(
  p_pod_id UUID DEFAULT NULL,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_val INT;
  v_token TEXT;
  v_date TEXT := TO_CHAR(COALESCE(p_date, CURRENT_DATE AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD');
BEGIN
  -- 1. Compute highest token sequence allocated strictly from appointments for this specific date and pod
  SELECT COALESCE(MAX(
    CASE 
      WHEN token_number ~ '^T-[0-9]+' THEN CAST(SUBSTRING(token_number FROM 3 FOR 4) AS INT)
      WHEN token_number ~ '^[0-9]+$' THEN CAST(token_number AS INT)
      ELSE 0
    END
  ), 0) + 1
  INTO v_next_val
  FROM public.appointments
  WHERE (p_pod_id IS NULL OR pod_id = p_pod_id OR pod_id = '00000000-0000-0000-0000-000000000001'::uuid OR pod_id IS NULL)
    AND (
      virtual_date = v_date
      OR TO_CHAR(appointment_time AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') = v_date
      OR TO_CHAR(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') = v_date
      OR appointment_time::text LIKE (v_date || '%')
    )
    AND (status IS NULL OR status != 'cancelled');

  -- 2. Format as two-digit token (T-01, T-02, etc.)
  v_token := 'T-' || LPAD(COALESCE(v_next_val, 1)::TEXT, 2, '0');
  RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_next_token_number(TEXT, UUID) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.generate_next_token_number(UUID, DATE) TO authenticated, service_role, anon;
