-- Migration: Update reconcile_profile_role to also fix auth.users metadata for platform admins
-- This ensures the JWT user_metadata matches the profile role

DROP FUNCTION IF EXISTS public.reconcile_profile_role();

CREATE OR REPLACE FUNCTION public.reconcile_profile_role()
RETURNS BOOLEAN AS $$
DECLARE
    v_meta_role TEXT;
    v_profile_role TEXT;
    v_uid UUID;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Extract role from auth.users metadata
    SELECT raw_user_meta_data->>'role'
    INTO v_meta_role
    FROM auth.users
    WHERE id = v_uid;

    -- Hardened Platform Owners / Admins checks by email
    IF EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = v_uid 
          AND (email = 'owner@mediflow.com' OR email = 'vivekkumarfbg000@gmail.com')
    ) THEN
        v_meta_role := 'platform_admin';
    END IF;

    IF v_meta_role IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Normalize role names
    IF v_meta_role = 'admin' THEN
        v_meta_role := 'platform_admin';
    END IF;

    -- Check current profile role
    SELECT role INTO v_profile_role
    FROM public.profiles
    WHERE id = v_uid;

    -- Reconcile role/profile mismatch
    IF v_profile_role IS NULL THEN
        -- Insert new profile if missing
        INSERT INTO public.profiles (id, role, display_name, entity_id, consultation_fee)
        VALUES (
            v_uid,
            v_meta_role,
            COALESCE((SELECT raw_user_meta_data->>'display_name' FROM auth.users WHERE id = v_uid), 'System User'),
            CASE 
                WHEN v_meta_role = 'platform_admin' THEN 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317009'::UUID 
                ELSE NULL 
            END,
            CASE WHEN v_meta_role = 'doctor' THEN 400.00 ELSE 0.00 END
        );
        RETURN TRUE;
    ELSIF v_profile_role != v_meta_role THEN
        -- Update existing profile if incorrect role
        UPDATE public.profiles
        SET role = v_meta_role,
            entity_id = CASE 
                WHEN v_meta_role = 'platform_admin' THEN 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317009'::UUID 
                ELSE entity_id 
            END
        WHERE id = v_uid;
        
        -- Also update auth.users metadata to match the corrected role
        UPDATE auth.users
        SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
            'role', v_meta_role
        )
        WHERE id = v_uid;
        
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.reconcile_profile_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_profile_role() TO authenticated;