-- Migration: Harden pods Row-Level Security (RLS) policy
-- Drops the permissive SELECT policy and restricts visibility of pods
-- to the authenticated user's active pod or to SaaS Platform Admins.

DROP POLICY IF EXISTS "Users view pods" ON public.pods;

CREATE POLICY "Users view pods" ON public.pods
    FOR SELECT
    TO authenticated
    USING (id = public.get_user_pod() OR public.is_platform_admin());
