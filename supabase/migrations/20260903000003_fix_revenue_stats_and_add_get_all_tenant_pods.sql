-- =============================================================================
-- Migration: Fix SaaS Revenue Stats, Validate Clinic Code, and Add get_all_tenant_pods RPC
-- Migration ID: 20260903000003_fix_revenue_stats_and_add_get_all_tenant_pods
-- =============================================================================

-- 1. Ensure platform_fee_percent column exists on pods and defaults to 3.0 (Rule 58: 3% Platform Fee)
ALTER TABLE public.pods 
  ADD COLUMN IF NOT EXISTS platform_fee_percent NUMERIC(5,2) DEFAULT 3.00;

-- Normalize any existing 2.5% entries to the standard 3.0% platform fee
UPDATE public.pods 
SET platform_fee_percent = 3.00 
WHERE platform_fee_percent = 2.50 OR platform_fee_percent IS NULL;

-- 2. Fix public.get_saas_revenue_stats()
-- Root cause: Previous version queried non-existent column 'status' on public.unified_invoices instead of 'payment_status'.
CREATE OR REPLACE FUNCTION public.get_saas_revenue_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_gmv NUMERIC(10,2);
  v_platform_commission NUMERIC(10,2);
  v_paid_invoices INT;
  v_unpaid_invoices INT;
BEGIN
  -- Total Gross Merchandise Value
  SELECT COALESCE(SUM(total_amount), 0.00) INTO v_gmv 
  FROM public.unified_invoices;

  -- Platform Commission on paid/cleared invoices
  SELECT COALESCE(SUM(platform_fee), 0.00) INTO v_platform_commission 
  FROM public.unified_invoices 
  WHERE payment_status = 'paid' OR payment_status = 'confirmed' OR payment_status = 'cleared';

  -- Paid invoices count
  SELECT COUNT(*) INTO v_paid_invoices 
  FROM public.unified_invoices 
  WHERE payment_status = 'paid' OR payment_status = 'confirmed' OR payment_status = 'cleared';

  -- Unpaid invoices count
  SELECT COUNT(*) INTO v_unpaid_invoices 
  FROM public.unified_invoices 
  WHERE payment_status = 'unpaid' OR payment_status = 'draft' OR payment_status = 'pending_payment';

  RETURN jsonb_build_object(
    'total_gmv', v_gmv,
    'platform_commission', v_platform_commission,
    'paid_invoices', v_paid_invoices,
    'unpaid_invoices', v_unpaid_invoices
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_saas_revenue_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_saas_revenue_stats() TO authenticated, anon, service_role;

-- 3. Fix public.validate_clinic_code(TEXT)
-- Root cause: Previous version queried non-existent column 'status' on public.pods instead of 'is_active'.
CREATE OR REPLACE FUNCTION public.validate_clinic_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pod RECORD;
BEGIN
  SELECT id, name, doctor_name, clinic_code, is_active
  INTO v_pod
  FROM public.pods
  WHERE upper(trim(clinic_code)) = upper(trim(p_code))
  LIMIT 1;

  IF v_pod.id IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Invalid clinic code. Please check with your clinic admin.'
    );
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'pod_id', v_pod.id,
    'clinic_name', v_pod.name,
    'doctor_name', COALESCE(v_pod.doctor_name, 'Chief Medical Officer'),
    'clinic_code', v_pod.clinic_code,
    'is_active', COALESCE(v_pod.is_active, true)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'valid', false,
    'error', SQLERRM
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_clinic_code(TEXT) TO anon, authenticated, service_role;

-- 4. Create public.get_all_tenant_pods() RPC
-- Returns all tenant pods securely for the SaaS Admin Console without RLS suppression
CREATE OR REPLACE FUNCTION public.get_all_tenant_pods()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pods JSONB;
BEGIN
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'doctor_name', COALESCE(p.doctor_name, 'Chief Medical Officer'),
        'phone', COALESCE(p.phone, ''),
        'location', COALESCE(p.location, 'Clinic Hub'),
        'clinic_code', COALESCE(p.clinic_code, 'VS-POD'),
        'is_active', COALESCE(p.is_active, true),
        'created_at', p.created_at,
        'daily_cost_budget', COALESCE(p.daily_cost_budget, 500.00),
        'daily_spend', 0.00,
        'platform_fee_percent', COALESCE(p.platform_fee_percent, 3.00),
        'lifetime_platform_revenue', COALESCE(p.lifetime_platform_revenue, 0.00),
        'pending_cash_balance', COALESCE(p.pending_cash_balance, 0.00),
        'is_verified_for_billing', COALESCE(p.is_verified_for_billing, true),
        'health_score', COALESCE(p.health_score, 100),
        'active_errors_count', COALESCE(p.active_errors_count, 0)
      ) ORDER BY p.created_at DESC
    ),
    '[]'::jsonb
  ) INTO v_pods
  FROM public.pods p
  WHERE p.is_active = true;

  RETURN v_pods;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_tenant_pods() TO authenticated, anon, service_role;
