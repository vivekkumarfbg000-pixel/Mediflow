-- Migration: harden_public_policies_to_authenticated
-- Drops the default public RLS policies that call get_user_pod() and recreates them restricted to authenticated users.

-- 1. Hardening pod_health_snapshots policy
DROP POLICY IF EXISTS "pod_health_doctor_read" ON public.pod_health_snapshots;
CREATE POLICY "pod_health_doctor_read"
    ON public.pod_health_snapshots FOR SELECT
    TO authenticated
    USING (
        pod_id = public.get_user_pod()
        OR public.is_platform_admin()
    );

-- 2. Hardening lab_requisitions policy
DROP POLICY IF EXISTS "doctor_read_all_lab_reqs" ON public.lab_requisitions;
CREATE POLICY "doctor_read_all_lab_reqs"
    ON public.lab_requisitions FOR SELECT
    TO authenticated
    USING (
        pod_id = public.get_user_pod()
        OR public.is_platform_admin()
    );
