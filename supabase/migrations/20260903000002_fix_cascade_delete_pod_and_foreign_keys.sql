-- =============================================================================
-- Migration: Fix Cascade Delete for Clinic Pods & Financial Ledgers
-- Migration ID: 20260903000002_fix_cascade_delete_pod_and_foreign_keys
-- Description: Ensures foreign keys on financial_ledgers have ON DELETE SET NULL,
--              and provides an atomic, security-definer RPC delete_clinic_pod(UUID)
-- =============================================================================

-- 1. Safely drop any restrictive foreign keys on financial_ledgers referencing entities or pods
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Drop foreign keys on financial_ledgers referencing entities
  FOR r IN (
    SELECT conname 
    FROM pg_constraint 
    WHERE conrelid = 'public.financial_ledgers'::regclass 
      AND confrelid = 'public.entities'::regclass
  ) LOOP
    EXECUTE 'ALTER TABLE public.financial_ledgers DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
  END LOOP;

  -- Drop foreign keys on financial_ledgers referencing pods
  FOR r IN (
    SELECT conname 
    FROM pg_constraint 
    WHERE conrelid = 'public.financial_ledgers'::regclass 
      AND confrelid = 'public.pods'::regclass
  ) LOOP
    EXECUTE 'ALTER TABLE public.financial_ledgers DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
  END LOOP;
END $$;

-- 2. Re-create foreign keys with safe cascading / set null behavior
ALTER TABLE public.financial_ledgers 
  ADD CONSTRAINT financial_ledgers_pod_id_fkey 
  FOREIGN KEY (pod_id) REFERENCES public.pods(id) ON DELETE CASCADE;

ALTER TABLE public.financial_ledgers 
  ADD CONSTRAINT financial_ledgers_source_entity_id_fkey 
  FOREIGN KEY (source_entity_id) REFERENCES public.entities(id) ON DELETE SET NULL;

ALTER TABLE public.financial_ledgers 
  ADD CONSTRAINT financial_ledgers_destination_entity_id_fkey 
  FOREIGN KEY (destination_entity_id) REFERENCES public.entities(id) ON DELETE SET NULL;

-- 3. Ensure vitalsync_pool_settlements has ON DELETE CASCADE on pod_id
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT conname 
    FROM pg_constraint 
    WHERE conrelid = 'public.vitalsync_pool_settlements'::regclass 
      AND confrelid = 'public.pods'::regclass
  ) LOOP
    EXECUTE 'ALTER TABLE public.vitalsync_pool_settlements DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
  END LOOP;
END $$;

ALTER TABLE public.vitalsync_pool_settlements
  ADD CONSTRAINT vitalsync_pool_settlements_pod_id_fkey
  FOREIGN KEY (pod_id) REFERENCES public.pods(id) ON DELETE CASCADE;

-- 4. Atomic, Server-Side SECURITY DEFINER RPC to permanently delete a clinic pod
CREATE OR REPLACE FUNCTION public.delete_clinic_pod(p_pod_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_entity_ids UUID[];
  v_default_pod_id UUID := 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'::UUID;
BEGIN
  -- Guard default pod against accidental destruction
  IF p_pod_id = v_default_pod_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot delete the system default primary clinic pod.');
  END IF;

  -- Collect all entities under this pod
  SELECT ARRAY_AGG(id) INTO v_entity_ids FROM public.entities WHERE pod_id = p_pod_id;

  -- 1. Unlink profiles
  UPDATE public.profiles 
  SET pod_id = NULL, entity_id = NULL, clinic_id = NULL 
  WHERE pod_id = p_pod_id 
     OR (v_entity_ids IS NOT NULL AND entity_id = ANY(v_entity_ids));

  -- 2. Clean up financial ledgers
  DELETE FROM public.financial_ledgers 
  WHERE pod_id = p_pod_id 
     OR (v_entity_ids IS NOT NULL AND (source_entity_id = ANY(v_entity_ids) OR destination_entity_id = ANY(v_entity_ids)));

  -- 3. Clean up pool settlements
  DELETE FROM public.vitalsync_pool_settlements 
  WHERE pod_id = p_pod_id 
     OR (v_entity_ids IS NOT NULL AND (entity_id = ANY(v_entity_ids) OR clinic_entity_id = ANY(v_entity_ids)));

  -- 4. Clean up invoices and clinical transactions
  DELETE FROM public.unified_invoices WHERE pod_id = p_pod_id;
  DELETE FROM public.prescriptions WHERE pod_id = p_pod_id;
  DELETE FROM public.lab_requisitions 
  WHERE pod_id = p_pod_id 
     OR (v_entity_ids IS NOT NULL AND lab_entity_id = ANY(v_entity_ids));
  DELETE FROM public.encounters WHERE pod_id = p_pod_id;
  DELETE FROM public.appointments WHERE pod_id = p_pod_id;
  DELETE FROM public.whatsapp_sessions WHERE pod_id = p_pod_id;
  DELETE FROM public.waba_connections 
  WHERE pod_id = p_pod_id 
     OR (v_entity_ids IS NOT NULL AND entity_id = ANY(v_entity_ids));
  DELETE FROM public.clinic_sops 
  WHERE pod_id = p_pod_id 
     OR (v_entity_ids IS NOT NULL AND entity_id = ANY(v_entity_ids));
  DELETE FROM public.system_health_telemetry WHERE pod_id = p_pod_id;
  DELETE FROM public.activity_logs 
  WHERE pod_id = p_pod_id 
     OR (v_entity_ids IS NOT NULL AND entity_id = ANY(v_entity_ids));

  -- 5. Delete entities
  DELETE FROM public.entities WHERE pod_id = p_pod_id;

  -- 6. Finally delete the pod
  DELETE FROM public.pods WHERE id = p_pod_id;

  RETURN jsonb_build_object('success', true, 'deleted_pod_id', p_pod_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_clinic_pod(UUID) TO authenticated, anon, service_role;
