-- Migration: Fix public.waba_connections RLS policies to use standard pod isolation
-- Drops old JWT-claim-based policies and replaces them with standard get_user_pod() checks.

DROP POLICY IF EXISTS "Allow pod authenticated select" ON public.waba_connections;
DROP POLICY IF EXISTS "Allow pod authenticated insert" ON public.waba_connections;
DROP POLICY IF EXISTS "Allow pod authenticated update" ON public.waba_connections;
DROP POLICY IF EXISTS "Allow pod authenticated delete" ON public.waba_connections;

-- Re-create policies with standard pod isolation and platform admin override
CREATE POLICY "Allow pod authenticated select" ON public.waba_connections
    FOR SELECT
    TO authenticated
    USING (pod_id = public.get_user_pod() OR public.is_platform_admin());

CREATE POLICY "Allow pod authenticated insert" ON public.waba_connections
    FOR INSERT
    TO authenticated
    WITH CHECK (pod_id = public.get_user_pod() OR public.is_platform_admin());

CREATE POLICY "Allow pod authenticated update" ON public.waba_connections
    FOR UPDATE
    TO authenticated
    USING (pod_id = public.get_user_pod() OR public.is_platform_admin());

CREATE POLICY "Allow pod authenticated delete" ON public.waba_connections
    FOR DELETE
    TO authenticated
    USING (pod_id = public.get_user_pod() OR public.is_platform_admin());
