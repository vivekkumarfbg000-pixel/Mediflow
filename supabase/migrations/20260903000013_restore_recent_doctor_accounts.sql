-- ==============================================================================
-- Migration: Restore Recent Doctor Accounts and Reconcile Clinic Pod Associations
-- Migration ID: 20260903000013_restore_recent_doctor_accounts
-- Description: Idempotent RPCs to restore any doctor accounts created in the last
--              7 days, auto-approve their profiles, and dynamically link their pods.
-- ==============================================================================

-- 1. Restore & Auto-Approve Doctor Accounts Created in the Last 7 Days
CREATE OR REPLACE FUNCTION public.restore_recent_doctor_accounts()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_count INT := 0;
  v_rec RECORD;
  v_pod_id UUID;
BEGIN
  -- Iterate through users created in auth.users in the last 7 days
  FOR v_rec IN 
    SELECT u.id, u.email, u.raw_user_meta_data, u.created_at
    FROM auth.users u
    WHERE u.created_at >= NOW() - INTERVAL '7 days'
  LOOP
    -- Look up if there is an existing active pod for this user
    SELECT id INTO v_pod_id
    FROM public.pods
    WHERE name ILIKE '%' || COALESCE(v_rec.raw_user_meta_data->>'name', v_rec.raw_user_meta_data->>'clinicName', '') || '%'
       OR clinic_code = COALESCE(v_rec.raw_user_meta_data->>'clinicCode', v_rec.raw_user_meta_data->>'clinic_code')
    LIMIT 1;

    -- Ensure profile exists in public.profiles with approved status
    INSERT INTO public.profiles (
      id, email, name, display_name, role, status, 
      clinic_id, pod_id, created_at, updated_at
    )
    VALUES (
      v_rec.id,
      v_rec.email,
      COALESCE(v_rec.raw_user_meta_data->>'name', v_rec.raw_user_meta_data->>'display_name', split_part(v_rec.email, '@', 1)),
      COALESCE(v_rec.raw_user_meta_data->>'display_name', v_rec.raw_user_meta_data->>'name', split_part(v_rec.email, '@', 1)),
      COALESCE(v_rec.raw_user_meta_data->>'role', 'doctor'),
      'approved',
      v_pod_id,
      v_pod_id,
      v_rec.created_at,
      NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET status = 'approved',
        clinic_id = COALESCE(public.profiles.clinic_id, EXCLUDED.clinic_id),
        pod_id = COALESCE(public.profiles.pod_id, EXCLUDED.pod_id),
        updated_at = NOW();

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'restored_users_count', v_count,
    'message', 'All recent accounts from the last 7 days restored and approved.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_recent_doctor_accounts() TO authenticated, anon, service_role;

-- 2. Upgraded Reconcile Tenant Pod Association (No Hardcoded Deleted UUID)
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
  v_reconciled BOOLEAN := FALSE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthenticated user session');
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id;

  -- If profile already has an existing valid active pod, retain it
  IF v_profile.pod_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.pods WHERE id = v_profile.pod_id AND is_active != false) THEN
    v_target_pod_id := v_profile.pod_id;
  ELSIF v_profile.clinic_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.pods WHERE id = v_profile.clinic_id AND is_active != false) THEN
    v_target_pod_id := v_profile.clinic_id;
  ELSIF v_profile.entity_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.entities WHERE id = v_profile.entity_id) THEN
    SELECT pod_id INTO v_target_pod_id FROM public.entities WHERE id = v_profile.entity_id;
  END IF;

  -- If still unassigned, assign the doctor's own registered pod or the latest active pod
  IF v_target_pod_id IS NULL THEN
    SELECT id INTO v_target_pod_id
    FROM public.pods
    WHERE is_active != false
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_target_pod_id IS NOT NULL THEN
      UPDATE public.profiles
      SET pod_id = v_target_pod_id,
          clinic_id = v_target_pod_id,
          status = 'approved',
          updated_at = NOW()
      WHERE id = v_user_id;
      v_reconciled := TRUE;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'reconciled', v_reconciled, 
    'user_id', v_user_id, 
    'pod_id', v_target_pod_id
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_tenant_pod_association() TO authenticated, anon, service_role;
