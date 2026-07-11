-- =============================================================================
-- Mediflow Migration: Harden all SECURITY DEFINER functions missing search_path
-- BUG-06: SECURITY DEFINER functions without SET search_path = public, pg_temp
-- are vulnerable to "trojan schema" / search path injection attacks. A malicious
-- authenticated user could create a schema with a function of the same name
-- and hijack the execution context of a privileged SECURITY DEFINER function.
--
-- This migration adds SET search_path = public, pg_temp to all functions
-- that were missing it. Existing functions with it are left untouched.
-- =============================================================================

-- Encounter trigger (BUG-04 migration already fixes this, but belt-and-suspenders)
ALTER FUNCTION public.on_encounter_submitted() SET search_path = public, pg_temp;

-- SaaS analytics functions (20260604000003)
ALTER FUNCTION public.get_saas_onboarding_stats() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_saas_revenue_stats() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_saas_cost_stats() SET search_path = public, pg_temp;

-- SaaS scaling safeguards (20260604000004)
ALTER FUNCTION public.check_pod_budget(UUID) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_pod_daily_spend(UUID) SET search_path = public, pg_temp;
ALTER FUNCTION public.audit_rls_compliance() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_failed_settlements() SET search_path = public, pg_temp;
ALTER FUNCTION public.retry_failed_settlement(UUID) SET search_path = public, pg_temp;

-- Onboarding RPCs and Self-Healing triggers (20260604000500)
ALTER FUNCTION public.register_clinic_network(TEXT, TEXT, TEXT, TEXT) SET search_path = public, pg_temp;
ALTER FUNCTION public.join_clinic_network(TEXT, TEXT, TEXT, TEXT, TEXT) SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_auto_heal_waba_disconnect() SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_auto_heal_telemetry_waba_before() SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_auto_heal_telemetry_waba_after() SET search_path = public, pg_temp;

-- Auto-healer upgrades (20260605000005)
ALTER FUNCTION public.dispatch_critical_telemetry_webhook() SET search_path = public, pg_temp;

-- Auto-healer phase2 (20260605000006)
ALTER FUNCTION public.reconstruct_missing_table(TEXT) SET search_path = public, pg_temp;
ALTER FUNCTION public.scan_and_heal_leaky_policies() SET search_path = public, pg_temp;

-- Login sentry / audit logging (20260625000003)
ALTER FUNCTION public.check_login_sentry(TEXT, TEXT) SET search_path = public, pg_temp;
ALTER FUNCTION public.log_login_attempt(TEXT, TEXT, TEXT, TEXT, TEXT, UUID) SET search_path = public, pg_temp;
ALTER FUNCTION public.unlock_account(TEXT) SET search_path = public, pg_temp;

-- Revenue share splits (20260702000000)
ALTER FUNCTION public.accumulate_platform_revenue(UUID, NUMERIC, BOOLEAN) SET search_path = public, pg_temp;

-- Clinic validation RPC (20260704000000)
ALTER FUNCTION public.validate_clinic_code(TEXT) SET search_path = public, pg_temp;


-- Auto-healer setup (20260701000001)
ALTER FUNCTION public.execute_autonomous_db_repair(TEXT, TEXT, TEXT) SET search_path = public, pg_temp;

-- Onboarding reconcile (20260611000003 / 20260611000004)
ALTER FUNCTION public.reconcile_profile_role() SET search_path = public, pg_temp;

-- RLS performance caching (20260531000020)
ALTER FUNCTION public.get_user_pod() SET search_path = public, pg_temp;
