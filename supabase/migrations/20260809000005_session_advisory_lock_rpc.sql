-- =============================================================================
-- Mediflow: Session-Scoped Advisory Lock RPCs
-- =============================================================================
-- ACTION REQUIRED: Run this SQL in Supabase SQL Editor BEFORE deploying.
--
-- Fixes the phantom advisory lock issue where pg_try_advisory_xact_lock
-- (transaction-scoped) would auto-release immediately after the RPC call
-- because each Supabase JS client call is its own auto-committed transaction.
--
-- These RPCs use pg_try_advisory_lock / pg_advisory_unlock which are
-- SESSION-scoped — they persist across multiple queries within the same
-- database connection (i.e., the same Edge Function invocation).
-- =============================================================================

-- Session-scoped lock acquisition (non-blocking)
CREATE OR REPLACE FUNCTION public.try_acquire_session_lock(p_key BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- pg_try_advisory_lock is SESSION-scoped (not transaction-scoped).
  -- It persists until explicitly released via pg_advisory_unlock
  -- or the session (database connection) terminates.
  RETURN pg_try_advisory_lock(p_key);
END;
$$;

-- Session-scoped lock release
CREATE OR REPLACE FUNCTION public.release_session_lock(p_key BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN pg_advisory_unlock(p_key);
END;
$$;

-- Grant execute to service role (webhooks use service_role key)
GRANT EXECUTE ON FUNCTION public.try_acquire_session_lock(BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_session_lock(BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.try_acquire_session_lock(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_session_lock(BIGINT) TO authenticated;

COMMENT ON FUNCTION public.try_acquire_session_lock IS
  'Acquires a session-scoped advisory lock. Returns TRUE if acquired, FALSE if already held. '
  'Must be explicitly released via release_session_lock() or auto-releases on session close.';

COMMENT ON FUNCTION public.release_session_lock IS
  'Releases a previously acquired session-scoped advisory lock.';
