-- =============================================================================
-- Migration: Fix delete_clinic_pod RPC Foreign Key Cascade Order
-- Migration ID: 20260903000011_fix_delete_clinic_pod_cascade_order
-- =============================================================================

CREATE OR REPLACE FUNCTION public.delete_clinic_pod(p_pod_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_entity_ids UUID[];
  v_patient_ids UUID[];
BEGIN
  -- Collect entities under this pod
  SELECT ARRAY_AGG(id) INTO v_entity_ids
  FROM public.entities
  WHERE pod_id = p_pod_id;

  -- Collect patients under this pod
  SELECT ARRAY_AGG(id) INTO v_patient_ids
  FROM public.patient_registry
  WHERE pod_id = p_pod_id;

  -- 1. Unlink staff & doctor profiles
  IF v_entity_ids IS NOT NULL AND array_length(v_entity_ids, 1) > 0 THEN
    UPDATE public.profiles 
    SET entity_id = NULL 
    WHERE entity_id = ANY(v_entity_ids);
  END IF;

  UPDATE public.profiles 
  SET clinic_id = NULL 
  WHERE clinic_id = p_pod_id;

  -- 2. Delete financial ledgers and pool settlements (must precede unified_invoices)
  DELETE FROM public.financial_ledgers WHERE pod_id = p_pod_id;
  DELETE FROM public.vitalsync_pool_settlements WHERE pod_id = p_pod_id;

  -- 3. Delete unified invoices (must precede encounters)
  DELETE FROM public.unified_invoices WHERE pod_id = p_pod_id;

  -- 4. Delete inventory holds, lab requisitions, pathology reports, medicine bills, prescriptions
  DELETE FROM public.inventory_holds WHERE pod_id = p_pod_id;
  DELETE FROM public.pathology_reports WHERE pod_id = p_pod_id;
  DELETE FROM public.lab_requisitions WHERE pod_id = p_pod_id;
  DELETE FROM public.medicine_bills WHERE pod_id = p_pod_id;
  DELETE FROM public.prescriptions WHERE pod_id = p_pod_id;
  DELETE FROM public.saas_prescriptions WHERE pod_id = p_pod_id;

  -- 5. Delete encounters (must precede patient_registry)
  DELETE FROM public.encounters WHERE pod_id = p_pod_id;

  -- 6. Delete appointments
  DELETE FROM public.appointments WHERE pod_id = p_pod_id;

  -- 7. Delete WhatsApp sessions, logs, sops, telemetry, and cohorts
  DELETE FROM public.whatsapp_sessions WHERE pod_id = p_pod_id;
  DELETE FROM public.whatsapp_billing_logs WHERE pod_id = p_pod_id;
  DELETE FROM public.chronic_adherence_logs WHERE cohort_id IN (SELECT id FROM public.chronic_care_cohorts WHERE pod_id = p_pod_id);
  DELETE FROM public.chronic_care_cohorts WHERE pod_id = p_pod_id;
  DELETE FROM public.clinic_sops WHERE pod_id = p_pod_id;
  DELETE FROM public.waba_connections WHERE pod_id = p_pod_id;
  DELETE FROM public.system_health_telemetry WHERE pod_id = p_pod_id;
  DELETE FROM public.activity_logs WHERE pod_id = p_pod_id;

  -- 8. Delete patients (safe: all referencing child tables are cleared)
  DELETE FROM public.patient_registry WHERE pod_id = p_pod_id;

  -- 9. Delete entities
  DELETE FROM public.entities WHERE pod_id = p_pod_id;

  -- 10. Delete the pod itself
  DELETE FROM public.pods WHERE id = p_pod_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Pod and all associated records successfully purged.'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_clinic_pod(UUID) TO authenticated, anon, service_role;
