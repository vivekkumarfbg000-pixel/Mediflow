-- =============================================================================
-- Migration 15: Single Tenant ID Unification, Purge Dummy Pods & Test Accounts
-- Target Clinic / Pod ID: dfb2a1a8-8e68-4f8a-929e-4a6c8e317001 (VS-V01R)
-- Target Doctor: Dr. Vivek Kumar (Founder & Lead Clinician)
-- File: supabase/migrations/20260903000015_retain_only_v01r_purge_dummy_pods.sql
-- =============================================================================

-- Step 1: Bulletproof delete_clinic_pod RPC with explicit ::text casts
CREATE OR REPLACE FUNCTION public.delete_clinic_pod(p_pod_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_entity_ids UUID[];
BEGIN
  -- Collect entities under this pod
  SELECT ARRAY_AGG(id) INTO v_entity_ids
  FROM public.entities
  WHERE pod_id::text = p_pod_id::text;

  -- 1. Unlink profiles
  IF v_entity_ids IS NOT NULL AND array_length(v_entity_ids, 1) > 0 THEN
    UPDATE public.profiles 
    SET entity_id = NULL 
    WHERE entity_id::text = ANY(v_entity_ids::text[]);
  END IF;

  UPDATE public.profiles 
  SET clinic_id = NULL, pod_id = NULL
  WHERE clinic_id::text = p_pod_id::text OR pod_id::text = p_pod_id::text;

  -- 2. Delete child records safely with text-cast comparisons
  DELETE FROM public.financial_ledgers WHERE pod_id::text = p_pod_id::text;
  DELETE FROM public.vitalsync_pool_settlements WHERE pod_id::text = p_pod_id::text;
  DELETE FROM public.unified_invoices WHERE pod_id::text = p_pod_id::text;
  DELETE FROM public.inventory_holds WHERE pod_id::text = p_pod_id::text;
  DELETE FROM public.pathology_reports WHERE pod_id::text = p_pod_id::text;
  DELETE FROM public.lab_requisitions WHERE pod_id::text = p_pod_id::text;
  DELETE FROM public.medicine_bills WHERE pod_id::text = p_pod_id::text;
  DELETE FROM public.saas_prescriptions WHERE pod_id::text = p_pod_id::text;
  DELETE FROM public.encounters WHERE pod_id::text = p_pod_id::text;
  DELETE FROM public.appointments WHERE pod_id::text = p_pod_id::text;
  DELETE FROM public.whatsapp_sessions WHERE pod_id::text = p_pod_id::text;
  DELETE FROM public.whatsapp_billing_logs WHERE pod_id::text = p_pod_id::text;
  DELETE FROM public.chronic_adherence_logs WHERE cohort_id::text IN (SELECT id::text FROM public.chronic_care_cohorts WHERE pod_id::text = p_pod_id::text);
  DELETE FROM public.chronic_care_cohorts WHERE pod_id::text = p_pod_id::text;
  DELETE FROM public.clinic_sops WHERE pod_id::text = p_pod_id::text;
  DELETE FROM public.waba_connections WHERE pod_id::text = p_pod_id::text;
  DELETE FROM public.system_health_telemetry WHERE pod_id::text = p_pod_id::text;
  DELETE FROM public.activity_logs WHERE pod_id::text = p_pod_id::text;
  DELETE FROM public.patient_registry WHERE pod_id::text = p_pod_id::text;
  DELETE FROM public.entities WHERE pod_id::text = p_pod_id::text;

  -- 3. Delete the pod
  DELETE FROM public.pods WHERE id::text = p_pod_id::text;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Pod successfully purged.'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_clinic_pod(UUID) TO authenticated, anon, service_role;

-- Step 2: Ensure VS-V01R is active and registered as the primary clinic pod
INSERT INTO public.pods (
  id,
  name,
  location,
  clinic_code,
  is_active,
  health_score,
  is_verified_for_billing,
  platform_fee_percent,
  created_at
)
VALUES (
  'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
  'Kankarbagh Medical Pod, Patna',
  'Kankarbagh, Patna, Bihar',
  'VS-V01R',
  true,
  100,
  true,
  3.00,
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = 'Kankarbagh Medical Pod, Patna',
  location = 'Kankarbagh, Patna, Bihar',
  clinic_code = 'VS-V01R',
  is_active = true,
  health_score = 100,
  is_verified_for_billing = true;

-- Step 3: Ensure an OPD storefront entity exists for VS-V01R
INSERT INTO public.entities (
  id,
  pod_id,
  name,
  entity_type,
  status,
  is_active,
  created_at
)
VALUES (
  'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002',
  'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
  'Dr. Vivek Kumar Clinic OPD',
  'clinic',
  'approved',
  true,
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  pod_id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
  name = 'Dr. Vivek Kumar Clinic OPD',
  entity_type = 'clinic',
  status = 'approved',
  is_active = true;

-- Step 4: Purge all synthetic dummy test accounts from public.profiles
DELETE FROM public.profiles
WHERE 
  email LIKE 'test_%@test.com'
  OR email LIKE 'test_%'
  OR email LIKE '%puppeteer%'
  OR name ILIKE '%Puppeteer%'
  OR name ILIKE '%Test Integration%'
  OR name ILIKE '%Test Partner%';

-- Step 5: Unify Tenant Identifiers — Set pod_id = clinic_id for all profiles
UPDATE public.profiles
SET pod_id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
    clinic_id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
    entity_id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002',
    status = 'approved',
    updated_at = NOW();

-- Step 6: Cascade purge all 24 dummy test pods via fixed RPC
DO $$
DECLARE
  v_pod RECORD;
  v_res JSONB;
BEGIN
  FOR v_pod IN 
    SELECT id FROM public.pods 
    WHERE id::text != 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'
  LOOP
    SELECT public.delete_clinic_pod(v_pod.id) INTO v_res;
  END LOOP;
END $$;

-- Step 7: Direct failsafe delete to guarantee only VS-V01R remains in pods table
DELETE FROM public.pods WHERE id::text != 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

-- Step 8: Canonical reconcile RPC permanently anchored to VS-V01R
CREATE OR REPLACE FUNCTION public.reconcile_tenant_pod_association()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_target_pod_id UUID := 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'::uuid;
  v_target_entity_id UUID := 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002'::uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET pod_id = v_target_pod_id,
        clinic_id = v_target_pod_id,
        entity_id = COALESCE(entity_id, v_target_entity_id),
        status = 'approved',
        updated_at = NOW()
    WHERE id = v_user_id;
  ELSE
    UPDATE public.profiles
    SET pod_id = v_target_pod_id,
        clinic_id = v_target_pod_id,
        entity_id = COALESCE(entity_id, v_target_entity_id),
        status = 'approved',
        updated_at = NOW()
    WHERE pod_id IS NULL OR clinic_id IS NULL OR pod_id != v_target_pod_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'reconciled', true, 
    'clinic_code', 'VS-V01R',
    'pod_id', v_target_pod_id,
    'clinic_name', 'Kankarbagh Medical Pod, Patna'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_tenant_pod_association() TO authenticated, anon, service_role;

-- Step 9: Execute reconciliation & verify
SELECT public.reconcile_tenant_pod_association();
SELECT id, name, clinic_code, is_active FROM public.pods;
