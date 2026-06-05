-- Migration: Harden profiles table self-access RLS policies
-- Drops the existing profiles SELECT policy and recreates it to permit self-access.
-- Adds an UPDATE policy to permit self-access updates (e.g. display name).

-- 1. profiles: Re-create SELECT policy to allow reading own profile
DROP POLICY IF EXISTS "Users view profiles" ON public.profiles;

CREATE POLICY "Users view profiles" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        id = auth.uid() 
        OR entity_id IN (SELECT id FROM public.entities WHERE pod_id = public.get_user_pod()) 
        OR public.is_platform_admin()
    );

-- 2. profiles: Create UPDATE policy to allow editing own profile
DROP POLICY IF EXISTS "Users update profiles" ON public.profiles;

CREATE POLICY "Users update profiles" ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (
        id = auth.uid() 
        OR public.is_platform_admin()
    )
    WITH CHECK (
        id = auth.uid() 
        OR public.is_platform_admin()
    );
