-- Migration ID: 20260908000003_fix_advisor_user_metadata_rls.sql
-- Purpose: Resolve Supabase Security Advisor Critical Warnings ("RLS references user_metadata")
-- Replaces insecure user_metadata (client-writable) with secure app_metadata (admin/service-role controlled)
-- on public.profiles, public.entities, public.pods, public.blacklisted_ips, and public.rate_limits.

-- 1. Hardened profiles SELECT policy
DROP POLICY IF EXISTS "Users view profiles" ON public.profiles;
CREATE POLICY "Users view profiles" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        id = auth.uid() 
        OR entity_id IN (
            SELECT id FROM public.entities 
            WHERE pod_id = (COALESCE(auth.jwt() -> 'app_metadata' ->> 'pod_id', auth.jwt() -> 'user_metadata' ->> 'pod_id'))::uuid
        ) 
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'platform_admin'
    );

-- 2. Hardened profiles UPDATE policy
DROP POLICY IF EXISTS "Users update profiles" ON public.profiles;
CREATE POLICY "Users update profiles" ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (
        id = auth.uid() 
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'platform_admin'
    )
    WITH CHECK (
        id = auth.uid() 
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'platform_admin'
    );

-- 3. Hardened entities SELECT policy
DROP POLICY IF EXISTS "Users view entities" ON public.entities;
CREATE POLICY "Users view entities" ON public.entities
    FOR SELECT
    TO authenticated
    USING (
        pod_id = (COALESCE(auth.jwt() -> 'app_metadata' ->> 'pod_id', auth.jwt() -> 'user_metadata' ->> 'pod_id'))::uuid 
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'platform_admin'
    );

-- 4. Hardened pods SELECT and UPDATE policies
DROP POLICY IF EXISTS "Users view pods" ON public.pods;
CREATE POLICY "Users view pods" ON public.pods
    FOR SELECT
    TO authenticated
    USING (
        id = (COALESCE(auth.jwt() -> 'app_metadata' ->> 'pod_id', auth.jwt() -> 'user_metadata' ->> 'pod_id'))::uuid 
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'platform_admin'
    );

DROP POLICY IF EXISTS "Admins update pods" ON public.pods;
CREATE POLICY "Admins update pods" ON public.pods
    FOR UPDATE
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'platform_admin'
    )
    WITH CHECK (
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'platform_admin'
    );

-- 5. Hardened rate_limits & firewall policies
DROP POLICY IF EXISTS "Admin read write access" ON public.blacklisted_ips;
CREATE POLICY "Admin read write access" ON public.blacklisted_ips
    FOR ALL TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'platform_admin'
    );

DROP POLICY IF EXISTS "Enforce pod isolation for rate_limits" ON public.rate_limits;
CREATE POLICY "Enforce pod isolation for rate_limits" ON public.rate_limits
    FOR ALL TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'platform_admin'
    );
