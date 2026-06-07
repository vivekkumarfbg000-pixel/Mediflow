-- Migration: Fix get_user_pod RLS recursion issue by converting it to PL/pgSQL
-- This prevents PostgreSQL from inlining the function and causing planning-time infinite loops on profiles/entities tables.

CREATE OR REPLACE FUNCTION public.get_user_pod()
RETURNS UUID AS $$
DECLARE
  v_pod_id TEXT;
BEGIN
  -- 1. Attempt to resolve pod_id instantly from custom JWT user_metadata claims
  v_pod_id := auth.jwt() -> 'user_metadata' ->> 'pod_id';
  IF v_pod_id IS NOT NULL THEN
    RETURN v_pod_id::uuid;
  END IF;

  -- 2. Fallback to indexing join query if claims are not populated in the active session
  RETURN (
    SELECT pod_id FROM public.entities WHERE id = (
      SELECT entity_id FROM public.profiles WHERE id = auth.uid()
    ) LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Re-apply execution permissions
REVOKE EXECUTE ON FUNCTION public.get_user_pod() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_pod() TO authenticated;
