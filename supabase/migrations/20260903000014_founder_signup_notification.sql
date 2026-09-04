-- =============================================================================
-- Migration 14: Founder Real-Time Lead Radar, Profiles Schema Idempotence & Account Restoration
-- Target Founder: Vivek Kumar (WhatsApp: +91-9608032073, Email: vivek@vitalsync.in)
-- File: supabase/migrations/20260903000014_founder_signup_notification.sql
-- =============================================================================

-- Step 1: Idempotently add missing columns to public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'approved';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pod_id UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS clinic_id UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Step 2: Drop restrictive foreign key on clinic_id that blocked pod assignment
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_clinic_id_fkey;

-- Step 3: Drop overloaded reconcile_tenant_pod_association signatures to resolve 42725 error
DROP FUNCTION IF EXISTS public.reconcile_tenant_pod_association(uuid);
DROP FUNCTION IF EXISTS public.reconcile_tenant_pod_association();

-- Step 4: Canonical reconcile_tenant_pod_association with 0 arguments
CREATE OR REPLACE FUNCTION public.reconcile_tenant_pod_association()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_profile RECORD;
  v_target_pod_id UUID;
  v_target_entity_id UUID;
  v_reconciled BOOLEAN := FALSE;
  v_reconciled_count INTEGER := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    -- Global fallback: reconcile unlinked doctor profiles to the latest active clinic pod
    SELECT id INTO v_target_pod_id
    FROM public.pods
    WHERE is_active != false
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_target_pod_id IS NOT NULL THEN
      SELECT id INTO v_target_entity_id
      FROM public.entities
      WHERE pod_id = v_target_pod_id
      LIMIT 1;

      UPDATE public.profiles
      SET pod_id = v_target_pod_id,
          clinic_id = v_target_pod_id,
          entity_id = COALESCE(entity_id, v_target_entity_id),
          status = 'approved',
          updated_at = NOW()
      WHERE 
        (role IN ('doctor', 'general_physician', 'ophthalmologist') OR role IS NULL)
        AND (pod_id IS NULL OR clinic_id IS NULL);
      
      GET DIAGNOSTICS v_reconciled_count = ROW_COUNT;
      v_reconciled := (v_reconciled_count > 0);
    END IF;

    RETURN jsonb_build_object(
      'success', true, 
      'reconciled', v_reconciled, 
      'reconciled_count', v_reconciled_count, 
      'pod_id', v_target_pod_id,
      'mode', 'global_unlinked_reconciliation'
    );
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id;

  -- If profile already has a valid active pod, retain it
  IF v_profile.pod_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.pods WHERE id = v_profile.pod_id AND is_active != false) THEN
    v_target_pod_id := v_profile.pod_id;
  ELSIF v_profile.clinic_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.pods WHERE id = v_profile.clinic_id AND is_active != false) THEN
    v_target_pod_id := v_profile.clinic_id;
  ELSIF v_profile.entity_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.entities WHERE id = v_profile.entity_id) THEN
    SELECT pod_id INTO v_target_pod_id FROM public.entities WHERE id = v_profile.entity_id;
  END IF;

  -- If still unassigned, assign the latest active pod
  IF v_target_pod_id IS NULL THEN
    SELECT id INTO v_target_pod_id
    FROM public.pods
    WHERE is_active != false
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_target_pod_id IS NOT NULL THEN
      SELECT id INTO v_target_entity_id
      FROM public.entities
      WHERE pod_id = v_target_pod_id
      LIMIT 1;

      UPDATE public.profiles
      SET pod_id = v_target_pod_id,
          clinic_id = v_target_pod_id,
          entity_id = COALESCE(entity_id, v_target_entity_id),
          status = 'approved',
          updated_at = NOW()
      WHERE id = v_user_id;
      v_reconciled := TRUE;
      v_reconciled_count := 1;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'reconciled', v_reconciled, 
    'reconciled_count', v_reconciled_count, 
    'user_id', v_user_id, 
    'pod_id', v_target_pod_id
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_tenant_pod_association() TO authenticated, anon, service_role;

-- Step 5: Create or replace restore_recent_doctor_accounts RPC
CREATE OR REPLACE FUNCTION public.restore_recent_doctor_accounts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_restored_count integer := 0;
  v_user record;
  v_target_pod_id uuid;
  v_target_entity_id uuid;
  v_now timestamptz := now();
  v_cutoff timestamptz := v_now - interval '7 days';
BEGIN
  SELECT id INTO v_target_pod_id
  FROM public.pods
  WHERE is_active != false
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_target_pod_id IS NOT NULL THEN
    SELECT id INTO v_target_entity_id
    FROM public.entities
    WHERE pod_id = v_target_pod_id
    LIMIT 1;
  END IF;

  FOR v_user IN
    SELECT id, email, created_at, raw_user_meta_data
    FROM auth.users
    WHERE created_at >= v_cutoff
  LOOP
    INSERT INTO public.profiles (
      id,
      email,
      name,
      role,
      status,
      created_at,
      updated_at,
      pod_id,
      clinic_id,
      entity_id
    )
    VALUES (
      v_user.id,
      v_user.email,
      COALESCE(v_user.raw_user_meta_data->>'full_name', v_user.raw_user_meta_data->>'name', split_part(v_user.email, '@', 1)),
      COALESCE(v_user.raw_user_meta_data->>'role', 'doctor'),
      'approved',
      v_user.created_at,
      v_now,
      v_target_pod_id,
      v_target_pod_id,
      v_target_entity_id
    )
    ON CONFLICT (id) DO UPDATE
    SET
      status = 'approved',
      pod_id = COALESCE(public.profiles.pod_id, v_target_pod_id),
      clinic_id = COALESCE(public.profiles.clinic_id, v_target_pod_id),
      entity_id = COALESCE(public.profiles.entity_id, v_target_entity_id),
      updated_at = v_now;

    v_restored_count := v_restored_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'status', 'success',
    'restored_accounts_count', v_restored_count,
    'scanned_cutoff', v_cutoff,
    'default_pod_id', v_target_pod_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_recent_doctor_accounts() TO authenticated, anon, service_role;

-- Step 6: Founder Lead Radar Trigger on New Clinic Pods
CREATE OR REPLACE FUNCTION public.fn_notify_founder_on_new_pod()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.system_health_telemetry (
    id,
    subsystem,
    severity,
    error_code,
    error_stack,
    healing_attempts,
    status,
    created_at,
    pod_id
  )
  VALUES (
    gen_random_uuid(),
    'founder_lead_radar',
    'info',
    'NEW_CLINIC_POD_ONBOARDED',
    jsonb_build_object(
      'founder_target_phone', '919608032073',
      'founder_target_email', 'vivek@vitalsync.in',
      'clinic_name', NEW.name,
      'clinic_code', NEW.clinic_code,
      'location', NEW.location,
      'pod_id', NEW.id,
      'created_at', NEW.created_at
    )::text,
    0,
    'alerted',
    NOW(),
    NEW.id
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_founder_on_new_pod ON public.pods;
CREATE TRIGGER trg_notify_founder_on_new_pod
AFTER INSERT ON public.pods
FOR EACH ROW
EXECUTE FUNCTION public.fn_notify_founder_on_new_pod();

-- Step 7: Safely execute restoration and reconciliation
SELECT public.restore_recent_doctor_accounts();
SELECT public.reconcile_tenant_pod_association();
