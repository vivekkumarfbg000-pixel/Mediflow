-- ==============================================================================
-- Migration: 20260724000001_reconcile_tenant_pod_rpc.sql
-- Description: Idempotent Postgres RPC for autonomous tenant pod reconciliation
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.reconcile_tenant_pod_association()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_profile_pod_id UUID;
  v_default_pod_id UUID := 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'::UUID;
  v_reconciled BOOLEAN := FALSE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthenticated user session');
  END IF;

  -- Read current profile's entity_id or pod association
  SELECT entity_id INTO v_profile_pod_id
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_profile_pod_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.pods WHERE id = v_profile_pod_id) THEN
    -- Auto-link user profile to default clinic pod
    UPDATE public.profiles
    SET entity_id = v_default_pod_id,
        status = 'approved',
        updated_at = NOW()
    WHERE id = v_user_id;
    
    v_reconciled := TRUE;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'reconciled', v_reconciled, 
    'user_id', v_user_id, 
    'pod_id', COALESCE(v_profile_pod_id, v_default_pod_id)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.reconcile_tenant_pod_association() TO authenticated, anon, service_role;
