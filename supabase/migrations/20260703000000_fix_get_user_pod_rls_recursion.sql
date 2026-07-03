-- Migration ID: 20260703000000_fix_get_user_pod_rls_recursion
-- Purpose: Fix get_user_pod and is_platform_admin RLS recursion loops by refactoring profiles, entities, and pods RLS policies.
-- We replace recursive function calls with direct JWT metadata claim evaluations.
-- This breaks all infinite database loops and permits direct execution from the Supabase SQL Editor without permission errors.

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
