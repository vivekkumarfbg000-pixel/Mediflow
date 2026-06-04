-- Mediflow Connected Care Platform Operations Metrics Functions
-- Migration ID: 20260604000003_saas_analytics_functions
-- Created: 2026-06-04
-- Purpose: Aggregate platform performance metrics across all pods secure behind the platform owner credentials.

-- 1. Onboarding Coordinator Stats RPC
CREATE OR REPLACE FUNCTION public.get_saas_onboarding_stats()
RETURNS JSONB AS $$
DECLARE
  v_total_pods INT;
  v_total_entities INT;
  v_clinics INT;
  v_pharmacies INT;
  v_labs INT;
  v_total_profiles INT;
BEGIN
  SELECT COUNT(*) INTO v_total_pods FROM public.pods;
  SELECT COUNT(*) INTO v_total_entities FROM public.entities;
  SELECT COUNT(*) INTO v_clinics FROM public.entities WHERE entity_type = 'clinic';
  SELECT COUNT(*) INTO v_pharmacies FROM public.entities WHERE entity_type = 'pharmacy';
  SELECT COUNT(*) INTO v_labs FROM public.entities WHERE entity_type = 'lab';
  SELECT COUNT(*) INTO v_total_profiles FROM public.profiles;
  
  RETURN jsonb_build_object(
    'total_pods', v_total_pods,
    'total_entities', v_total_entities,
    'clinics', v_clinics,
    'pharmacies', v_pharmacies,
    'labs', v_labs,
    'total_profiles', v_total_profiles
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.get_saas_onboarding_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_saas_onboarding_stats() TO authenticated;

-- 2. CFO Revenue Splits Stats RPC
CREATE OR REPLACE FUNCTION public.get_saas_revenue_stats()
RETURNS JSONB AS $$
DECLARE
  v_gmv NUMERIC(10,2);
  v_platform_commission NUMERIC(10,2);
  v_paid_invoices INT;
  v_unpaid_invoices INT;
BEGIN
  SELECT COALESCE(SUM(total_amount), 0.00) INTO v_gmv FROM public.unified_invoices;
  -- Sum up paid/confirmed invoices commissions
  SELECT COALESCE(SUM(platform_fee), 0.00) INTO v_platform_commission FROM public.unified_invoices WHERE status = 'paid' OR status = 'confirmed';
  SELECT COUNT(*) INTO v_paid_invoices FROM public.unified_invoices WHERE status = 'paid' OR status = 'confirmed';
  SELECT COUNT(*) INTO v_unpaid_invoices FROM public.unified_invoices WHERE status = 'unpaid' OR status = 'draft';
  
  RETURN jsonb_build_object(
    'total_gmv', v_gmv,
    'platform_commission', v_platform_commission,
    'paid_invoices', v_paid_invoices,
    'unpaid_invoices', v_unpaid_invoices
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.get_saas_revenue_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_saas_revenue_stats() TO authenticated;

-- 3. Communications and LLM Cost Analytics Stats RPC
CREATE OR REPLACE FUNCTION public.get_saas_cost_stats()
RETURNS JSONB AS $$
DECLARE
  v_waba_msgs_sent INT;
  v_waba_cost NUMERIC(10,4);
  v_ai_tasks_run INT;
  v_ai_cost NUMERIC(10,4);
BEGIN
  SELECT COUNT(*) INTO v_waba_msgs_sent FROM public.whatsapp_billing_logs;
  SELECT COALESCE(SUM(cost), 0.0000) INTO v_waba_cost FROM public.whatsapp_billing_logs;
  
  SELECT COUNT(*) INTO v_ai_tasks_run FROM public.agent_task_pipelines WHERE status = 'completed';
  -- Estimate LLM costs: assume flat ₹0.50 (approx $0.006) per completed clinical summary/audit action
  v_ai_cost := v_ai_tasks_run * 0.50;
  
  RETURN jsonb_build_object(
    'waba_msgs_sent', v_waba_msgs_sent,
    'waba_cost', v_waba_cost,
    'ai_tasks_run', v_ai_tasks_run,
    'ai_cost', v_ai_cost
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.get_saas_cost_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_saas_cost_stats() TO authenticated;
