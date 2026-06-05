-- Migration: Harden all leaky Row-Level Security (RLS) policies
-- Drops permissive USING (true) / WITH CHECK (true) policies on core transactional
-- and staff tables, and replaces them with strict tenant pod isolation checks.

-- 1. activity_logs: Drop permissive policies (falls back to "Enforce tenant pod isolation" FOR ALL)
DROP POLICY IF EXISTS "Users view activity_logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Users insert activity_logs" ON public.activity_logs;

-- 2. lab_reports: Restrict SELECT, INSERT, and UPDATE to patient pod mapping
DROP POLICY IF EXISTS "lab_reports_select_authenticated" ON public.lab_reports;
DROP POLICY IF EXISTS "lab_reports_insert_authenticated" ON public.lab_reports;
DROP POLICY IF EXISTS "lab_reports_update_authenticated" ON public.lab_reports;

CREATE POLICY "lab_reports_select_authenticated" ON public.lab_reports
    FOR SELECT
    TO authenticated
    USING (patient_id IN (SELECT id FROM public.patient_registry WHERE pod_id = public.get_user_pod()) OR public.is_platform_admin());

CREATE POLICY "lab_reports_insert_authenticated" ON public.lab_reports
    FOR INSERT
    TO authenticated
    WITH CHECK (patient_id IN (SELECT id FROM public.patient_registry WHERE pod_id = public.get_user_pod()) OR public.is_platform_admin());

CREATE POLICY "lab_reports_update_authenticated" ON public.lab_reports
    FOR UPDATE
    TO authenticated
    USING (patient_id IN (SELECT id FROM public.patient_registry WHERE pod_id = public.get_user_pod()) OR public.is_platform_admin())
    WITH CHECK (patient_id IN (SELECT id FROM public.patient_registry WHERE pod_id = public.get_user_pod()) OR public.is_platform_admin());

-- 3. entities: Restrict SELECT to user's active pod or SaaS Admin
DROP POLICY IF EXISTS "Users view entities" ON public.entities;

CREATE POLICY "Users view entities" ON public.entities
    FOR SELECT
    TO authenticated
    USING (pod_id = public.get_user_pod() OR public.is_platform_admin());

-- 4. profiles: Restrict SELECT to profiles within user's pod entities or SaaS Admin
DROP POLICY IF EXISTS "Users view profiles" ON public.profiles;

CREATE POLICY "Users view profiles" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (entity_id IN (SELECT id FROM public.entities WHERE pod_id = public.get_user_pod()) OR public.is_platform_admin());
