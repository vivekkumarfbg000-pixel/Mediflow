ALTER TABLE IF EXISTS public.pods ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.clinic_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.patient_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lab_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.unified_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.financial_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activity_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.reagent_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inventory_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.master_test_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pharmacy_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read master_test_catalog" ON public.master_test_catalog;
CREATE POLICY "Allow authenticated read master_test_catalog" ON public.master_test_catalog
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated read reagent_inventory" ON public.reagent_inventory;
CREATE POLICY "Allow authenticated read reagent_inventory" ON public.reagent_inventory
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enforce pod isolation for pharmacy_inventory" ON public.pharmacy_inventory;
CREATE POLICY "Enforce pod isolation for pharmacy_inventory" ON public.pharmacy_inventory
    FOR ALL TO authenticated
    USING (pharmacy_entity_id IN (SELECT id FROM public.entities WHERE pod_id = public.get_user_pod()) OR public.is_platform_admin());

DROP POLICY IF EXISTS "Enforce pod isolation for inventory_holds" ON public.inventory_holds;
CREATE POLICY "Enforce pod isolation for inventory_holds" ON public.inventory_holds
    FOR ALL TO authenticated
    USING (pharmacy_entity_id IN (SELECT id FROM public.entities WHERE pod_id = public.get_user_pod()) OR public.is_platform_admin());

ALTER FUNCTION public.get_saas_onboarding_stats() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_saas_revenue_stats() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_saas_cost_stats() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_pod_daily_spend(UUID) SET search_path = public, pg_temp;
ALTER FUNCTION public.check_pod_budget(UUID) SET search_path = public, pg_temp;
ALTER FUNCTION public.audit_rls_compliance() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_failed_settlements() SET search_path = public, pg_temp;
ALTER FUNCTION public.retry_failed_settlement(UUID) SET search_path = public, pg_temp;
ALTER FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) SET search_path = public, pg_temp;
ALTER FUNCTION public.dispatch_critical_telemetry_webhook() SET search_path = public, pg_temp;
