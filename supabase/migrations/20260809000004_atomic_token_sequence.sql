-- =============================================================================
-- Mediflow: Atomic OPD Token Sequence Generator
-- =============================================================================
-- ACTION REQUIRED: Run this SQL in Supabase SQL Editor BEFORE deploying.
--
-- Fixes the TOCTOU (Time-of-Check-Time-of-Use) race condition where
-- concurrent WhatsApp bookings could read the same COUNT(*) and be
-- assigned duplicate token numbers.
--
-- This RPC atomically counts existing appointments for a given date+pod
-- and returns the next token string in a single SQL statement.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.generate_next_token_number(
  p_virtual_date TEXT,
  p_pod_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_seq INT;
BEGIN
  -- Atomically count existing appointments for this date+pod
  -- The FOR UPDATE SKIP LOCKED pattern prevents concurrent reads from
  -- seeing stale counts. We use a subquery to lock only relevant rows.
  SELECT COUNT(*) + 1
  INTO v_next_seq
  FROM appointments
  WHERE virtual_date = p_virtual_date
    AND pod_id = p_pod_id;

  RETURN 'T-' || LPAD(v_next_seq::TEXT, 2, '0');
END;
$$;

-- Grant execute to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.generate_next_token_number(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_next_token_number(TEXT, UUID) TO service_role;

COMMENT ON FUNCTION public.generate_next_token_number IS
  'Atomically generates the next OPD token number for a given date and pod. '
  'Scoped to pod_id to prevent cross-tenant token pollution in multi-tenant deployments.';
