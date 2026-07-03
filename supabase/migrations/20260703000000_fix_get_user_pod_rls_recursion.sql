-- Migration ID: 20260703000000_fix_get_user_pod_rls_recursion
-- Purpose: Fix get_user_pod and is_platform_admin RLS recursion loops by refactoring profiles, entities, pods, blacklisted_ips, and rate_limits RLS policies.
-- We replace recursive function calls and database subqueries with direct JWT metadata claim evaluations.
-- This breaks all infinite database loops, secures admin panel features, and permits direct execution from the Supabase SQL Editor.

-- 1. Drop existing policies on profiles
DROP POLICY IF EXISTS "Users view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users update profiles" ON public.profiles;

-- 2. Recreate profiles SELECT policy with direct JWT claim lookups to avoid get_user_pod() recursion
CREATE POLICY "Users view profiles" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        id = auth.uid() 
        OR entity_id IN (
            SELECT id FROM public.entities 
            WHERE pod_id = (auth.jwt() -> 'user_metadata' ->> 'pod_id')::uuid
        ) 
        OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'platform_admin'
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'platform_admin'
    );

-- 3. Recreate profiles UPDATE policy with direct JWT claim check
CREATE POLICY "Users update profiles" ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (
        id = auth.uid() 
        OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'platform_admin'
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'platform_admin'
    )
    WITH CHECK (
        id = auth.uid() 
        OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'platform_admin'
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'platform_admin'
    );

-- 4. Drop existing policies on entities and pods
DROP POLICY IF EXISTS "Users view entities" ON public.entities;
DROP POLICY IF EXISTS "Users view pods" ON public.pods;

-- 5. Recreate entities SELECT policy with direct JWT claim check (bypassing get_user_pod recursion)
CREATE POLICY "Users view entities" ON public.entities
    FOR SELECT
    TO authenticated
    USING (
        pod_id = (auth.jwt() -> 'user_metadata' ->> 'pod_id')::uuid 
        OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'platform_admin'
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'platform_admin'
    );

-- 6. Recreate pods SELECT policy with direct JWT claim check (bypassing get_user_pod recursion)
CREATE POLICY "Users view pods" ON public.pods
    FOR SELECT
    TO authenticated
    USING (
        id = (auth.jwt() -> 'user_metadata' ->> 'pod_id')::uuid 
        OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'platform_admin'
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'platform_admin'
    );

-- 7. Add UPDATE policy to pods for platform admin management (Fixes budget update / verification toggling)
DROP POLICY IF EXISTS "Admins update pods" ON public.pods;
CREATE POLICY "Admins update pods" ON public.pods
    FOR UPDATE
    TO authenticated
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'platform_admin'
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'platform_admin'
    )
    WITH CHECK (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'platform_admin'
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'platform_admin'
    );

-- 8. Hardcode direct JWT checks on firewall tables to optimize request rate limits and prevent profile subqueries
DROP POLICY IF EXISTS "Admin read write access" ON public.blacklisted_ips;
CREATE POLICY "Admin read write access" ON public.blacklisted_ips
    FOR ALL TO authenticated
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'platform_admin'
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'platform_admin'
    );

DROP POLICY IF EXISTS "Enforce pod isolation for rate_limits" ON public.rate_limits;
CREATE POLICY "Enforce pod isolation for rate_limits" ON public.rate_limits
    FOR ALL TO authenticated
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'platform_admin'
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'platform_admin'
    );
