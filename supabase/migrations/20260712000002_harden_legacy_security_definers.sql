-- Migration: Revoke public execute access on legacy SECURITY DEFINER functions to prevent privilege leakage
-- These functions run with superuser privileges and must be restricted to authenticated users only.

-- 1. sync_profile_pod_to_jwt_metadata (defined in 20260625000002_professional_storage_and_jwt_claims.sql)
REVOKE EXECUTE ON FUNCTION public.sync_profile_pod_to_jwt_metadata() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_profile_pod_to_jwt_metadata() TO authenticated, service_role;

-- 2. fn_set_patient_pod_id (defined in 20260611000005_auto_set_patient_pod_id.sql)
REVOKE EXECUTE ON FUNCTION public.fn_set_patient_pod_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_set_patient_pod_id() TO authenticated, service_role;

-- 3. is_platform_admin (defined in 20260607000000_fix_rls_recursion.sql)
REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, service_role;

-- 4. register_clinic_network (idempotent addition requested by user)
REVOKE EXECUTE ON FUNCTION public.register_clinic_network(text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.register_clinic_network(text, text, text, text) TO authenticated;

-- 5. join_clinic_network (idempotent addition requested by user)
REVOKE EXECUTE ON FUNCTION public.join_clinic_network(text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.join_clinic_network(text, text, text, text, text) TO authenticated;

-- 6. reconcile_profile_role (idempotent addition requested by user)
REVOKE EXECUTE ON FUNCTION public.reconcile_profile_role() FROM public;
GRANT EXECUTE ON FUNCTION public.reconcile_profile_role() TO authenticated;
