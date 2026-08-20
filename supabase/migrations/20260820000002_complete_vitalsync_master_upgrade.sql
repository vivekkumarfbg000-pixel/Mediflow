-- ============================================================================
-- VitalSync Master Comprehensive Upgrade Migration (Idempotent 1-Pass)
-- ============================================================================

-- SECTION 1: Clinic Pods & Multi-Tenant Schema
ALTER TABLE public.pods ADD COLUMN IF NOT EXISTS clinic_code TEXT;
ALTER TABLE public.pods ADD COLUMN IF NOT EXISTS doctor_name TEXT;
ALTER TABLE public.pods ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.pods ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.pods ADD COLUMN IF NOT EXISTS daily_cost_budget NUMERIC DEFAULT 500.00;
ALTER TABLE public.pods ADD COLUMN IF NOT EXISTS daily_spend NUMERIC DEFAULT 0.00;
ALTER TABLE public.pods ADD COLUMN IF NOT EXISTS platform_fee_percent NUMERIC DEFAULT 2.5;
ALTER TABLE public.pods ADD COLUMN IF NOT EXISTS lifetime_platform_revenue NUMERIC DEFAULT 0.00;
ALTER TABLE public.pods ADD COLUMN IF NOT EXISTS pending_cash_balance NUMERIC DEFAULT 0.00;
ALTER TABLE public.pods ADD COLUMN IF NOT EXISTS is_verified_for_billing BOOLEAN DEFAULT TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pods_clinic_code_unique ON public.pods (clinic_code) WHERE clinic_code IS NOT NULL;

-- SECTION 2: VitalSync Clinic Code Registration RPC (VS-S03N Engine)
DROP FUNCTION IF EXISTS public.register_clinic_network(TEXT, TEXT, TEXT, TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.register_clinic_network(
    p_clinic_name TEXT,
    p_clinic_phone TEXT,
    p_clinic_address TEXT,
    p_specialization TEXT
)
RETURNS TABLE (clinic_code TEXT)
AS $$
DECLARE
    v_pod_id UUID;
    v_entity_id UUID;
    v_clinic_code TEXT;
    v_display_name TEXT;
    v_clean_name TEXT;
    v_first_char TEXT;
    v_last_char TEXT;
    v_seq INT;
BEGIN
    SELECT COALESCE(raw_user_meta_data->>'display_name', p_clinic_name)
    INTO v_display_name 
    FROM auth.users 
    WHERE id = auth.uid();

    SELECT COALESCE(COUNT(*), 0) + 1 INTO v_seq FROM public.pods;

    v_clean_name := upper(regexp_replace(COALESCE(v_display_name, p_clinic_name), '^(dr\.?|doctor|prof\.?)\s*|[^a-zA-Z]', '', 'gi'));
    IF length(v_clean_name) = 0 THEN
        v_clean_name := 'DR';
    END IF;

    v_first_char := substring(v_clean_name, 1, 1);
    IF length(v_clean_name) > 1 THEN
        v_last_char := substring(v_clean_name, length(v_clean_name), 1);
    ELSE
        v_last_char := v_first_char;
    END IF;

    v_clinic_code := 'VS-' || v_first_char || lpad(v_seq::text, 2, '0') || v_last_char;

    WHILE EXISTS (SELECT 1 FROM public.pods WHERE pods.clinic_code = v_clinic_code) LOOP
        v_seq := v_seq + 1;
        v_clinic_code := 'VS-' || v_first_char || lpad(v_seq::text, 2, '0') || v_last_char;
    END LOOP;

    INSERT INTO public.pods (name, clinic_code, is_active, doctor_name, phone, location)
    VALUES (p_clinic_name, v_clinic_code, TRUE, COALESCE(v_display_name, p_clinic_name), p_clinic_phone, p_clinic_address)
    RETURNING id INTO v_pod_id;

    INSERT INTO public.entities (pod_id, entity_type, name, address, phone, status, is_active)
    VALUES (v_pod_id, 'clinic', p_clinic_name, p_clinic_address, p_clinic_phone, 'approved', TRUE)
    RETURNING id INTO v_entity_id;

    INSERT INTO public.profiles (id, entity_id, pod_id, role, consultation_fee, display_name)
    VALUES (auth.uid(), v_entity_id, v_pod_id, 'doctor', 400.00, COALESCE(v_display_name, 'Doctor'))
    ON CONFLICT (id) DO UPDATE 
    SET entity_id = EXCLUDED.entity_id, pod_id = EXCLUDED.pod_id, role = EXCLUDED.role, display_name = EXCLUDED.display_name;

    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
        'clinic_name', p_clinic_name,
        'clinic_code', v_clinic_code,
        'specialization', p_specialization,
        'role', 'doctor',
        'pod_id', v_pod_id
    )
    WHERE id = auth.uid();

    RETURN QUERY SELECT v_clinic_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.register_clinic_network(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_clinic_network(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- SECTION 3: SaaS Admin Operations Analytics RPCs
DROP FUNCTION IF EXISTS public.get_saas_onboarding_stats() CASCADE;

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

DROP FUNCTION IF EXISTS public.get_saas_revenue_stats() CASCADE;

CREATE OR REPLACE FUNCTION public.get_saas_revenue_stats()
RETURNS JSONB AS $$
DECLARE
  v_gmv NUMERIC(10,2);
  v_platform_commission NUMERIC(10,2);
  v_paid_invoices INT;
  v_unpaid_invoices INT;
BEGIN
  SELECT COALESCE(SUM(total_amount), 0.00) INTO v_gmv FROM public.unified_invoices;
  SELECT COALESCE(SUM(platform_fee), 0.00) INTO v_platform_commission FROM public.unified_invoices WHERE status = 'paid' OR status = 'confirmed' OR payment_status = 'cleared';
  SELECT COUNT(*) INTO v_paid_invoices FROM public.unified_invoices WHERE status = 'paid' OR status = 'confirmed' OR payment_status = 'cleared';
  SELECT COUNT(*) INTO v_unpaid_invoices FROM public.unified_invoices WHERE status = 'unpaid' OR status = 'draft' OR payment_status = 'pending_payment';
  
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

DROP FUNCTION IF EXISTS public.get_saas_cost_stats() CASCADE;

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

-- SECTION 4: Pod Spend Control RPC
DROP FUNCTION IF EXISTS public.get_pod_daily_spend(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.get_pod_daily_spend(p_pod_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_waba_spend NUMERIC(10,4) := 0.00;
  v_ai_spend NUMERIC(10,4) := 0.00;
  v_today_start TIMESTAMPTZ := date_trunc('day', NOW());
BEGIN
  SELECT COALESCE(SUM(cost), 0.00) INTO v_waba_spend
  FROM public.whatsapp_billing_logs
  WHERE pod_id = p_pod_id AND created_at >= v_today_start;

  SELECT COALESCE(COUNT(*) * 0.50, 0.00) INTO v_ai_spend
  FROM public.agent_task_pipelines
  WHERE pod_id = p_pod_id AND status = 'completed' AND created_at >= v_today_start;

  RETURN (v_waba_spend + v_ai_spend);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.get_pod_daily_spend(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pod_daily_spend(UUID) TO authenticated;

-- SECTION 5: Enterprise Compliance & RLS Auditor RPC
DROP FUNCTION IF EXISTS public.audit_rls_compliance() CASCADE;

CREATE OR REPLACE FUNCTION public.audit_rls_compliance()
RETURNS JSONB AS $$
DECLARE
  v_result JSONB := '[]'::JSONB;
  r RECORD;
BEGIN
  FOR r IN (
    SELECT 
      c.relname AS table_name,
      c.relrowsecurity AS rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' 
      AND c.relkind = 'r'
      AND c.relname IN ('pods', 'entities', 'profiles', 'appointments', 'prescriptions', 'unified_invoices', 'financial_ledgers')
    ORDER BY c.relname
  ) LOOP
    v_result := v_result || jsonb_build_object(
      'table_name', r.table_name,
      'rls_enabled', r.rls_enabled,
      'compliant', r.rls_enabled
    );
  END LOOP;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.audit_rls_compliance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_rls_compliance() TO authenticated;

-- SECTION 6: Settlement Failure Recovery RPCs
DROP FUNCTION IF EXISTS public.get_failed_settlements() CASCADE;

CREATE OR REPLACE FUNCTION public.get_failed_settlements()
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id,
    'pod_id', pod_id,
    'patient_id', patient_id,
    'total_amount', total_amount,
    'doctor_net_amount', doctor_net_amount,
    'status', status,
    'failure_reason', failure_reason,
    'retry_count', retry_count,
    'created_at', created_at
  )), '[]'::JSONB)
  INTO v_result
  FROM public.vitalsync_pool_settlements
  WHERE status = 'failed';

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.get_failed_settlements() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_failed_settlements() TO authenticated;

DROP FUNCTION IF EXISTS public.retry_failed_settlement(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.retry_failed_settlement(ledger_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.vitalsync_pool_settlements
  SET status = 'pending',
      retry_count = COALESCE(retry_count, 0) + 1,
      failure_reason = NULL,
      updated_at = NOW()
  WHERE id = ledger_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.retry_failed_settlement(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.retry_failed_settlement(UUID) TO authenticated;

-- SECTION 7: Upgrade Founding Clinic Code to VS-V01R
UPDATE public.pods 
SET clinic_code = 'VS-V01R' 
WHERE id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001' OR clinic_code = 'MF-APEX';
