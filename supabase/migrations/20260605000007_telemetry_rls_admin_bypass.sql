-- Mediflow Hardening Migration - Telemetry RLS Admin Bypass
-- Drops existing RLS policies on telemetry and execution log tables and recreates them allowing platform admins access.

-- 1. system_health_telemetry
DROP POLICY IF EXISTS "Enforce tenant pod isolation" ON public.system_health_telemetry;
CREATE POLICY "Enforce tenant pod isolation" ON public.system_health_telemetry 
    FOR ALL 
    TO authenticated 
    USING (pod_id = public.get_user_pod() OR public.is_platform_admin());

-- 2. self_healing_execution_logs
DROP POLICY IF EXISTS "Enforce nested tenant pod isolation" ON public.self_healing_execution_logs;
CREATE POLICY "Enforce nested tenant pod isolation" ON public.self_healing_execution_logs 
    FOR ALL 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.system_health_telemetry t 
            WHERE t.id = telemetry_id AND (t.pod_id = public.get_user_pod() OR public.is_platform_admin())
        )
    );

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
