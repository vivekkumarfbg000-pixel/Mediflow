-- Migration: Update RPC functions to include pod_id in user_metadata
-- This ensures get_user_pod() can resolve pod_id from JWT claims instantly

-- 1. Update register_clinic_network to include pod_id in user_metadata
DROP FUNCTION IF EXISTS public.register_clinic_network(text,text,text,text);

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
BEGIN
    v_clinic_code := 'MF-' || upper(substring(gen_random_uuid()::text, 1, 4));
    
    WHILE EXISTS (SELECT 1 FROM public.pods WHERE pods.clinic_code = v_clinic_code) LOOP
        v_clinic_code := 'MF-' || upper(substring(gen_random_uuid()::text, 1, 4));
    END LOOP;

    INSERT INTO public.pods (name, clinic_code, is_active)
    VALUES (p_clinic_name, v_clinic_code, TRUE)
    RETURNING id INTO v_pod_id;

    INSERT INTO public.entities (pod_id, entity_type, name, address, phone, status, is_active)
    VALUES (v_pod_id, 'clinic', p_clinic_name, p_clinic_address, p_clinic_phone, 'approved', TRUE)
    RETURNING id INTO v_entity_id;

    -- Extract display name from metadata or fall back to clinic name
    SELECT COALESCE(raw_user_meta_data->>'display_name', p_clinic_name)
    INTO v_display_name 
    FROM auth.users 
    WHERE id = auth.uid();

    INSERT INTO public.profiles (id, entity_id, role, consultation_fee, display_name)
    VALUES (auth.uid(), v_entity_id, 'doctor', 400.00, COALESCE(v_display_name, 'Doctor'))
    ON CONFLICT (id) DO UPDATE 
    SET entity_id = EXCLUDED.entity_id, role = EXCLUDED.role, display_name = EXCLUDED.display_name;

    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
        'clinic_name', p_clinic_name,
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

-- 2. Update join_clinic_network to include pod_id in user_metadata
DROP FUNCTION IF EXISTS public.join_clinic_network(text,text,text,text,text);

CREATE OR REPLACE FUNCTION public.join_clinic_network(
    p_clinic_code TEXT,
    p_partner_type TEXT,
    p_partner_name TEXT,
    p_partner_phone TEXT,
    p_partner_address TEXT
)
RETURNS TABLE (entity_id UUID)
AS $$
DECLARE
    v_pod_id UUID;
    v_entity_id UUID;
    v_role TEXT;
    v_display_name TEXT;
BEGIN
    SELECT id INTO v_pod_id 
    FROM public.pods 
    WHERE clinic_code = upper(trim(p_clinic_code)) AND is_active = TRUE
    LIMIT 1;

    IF v_pod_id IS NULL THEN
        RAISE EXCEPTION 'Clinic network code not found or inactive.';
    END IF;

    v_role := CASE 
        WHEN p_partner_type = 'pharmacy' THEN 'pharmacist'
        WHEN p_partner_type = 'lab' THEN 'lab_technician'
        ELSE 'compounder'
    END;

    -- Create entity as pending approval
    INSERT INTO public.entities (pod_id, entity_type, name, address, phone, status, is_active)
    VALUES (v_pod_id, p_partner_type, p_partner_name, p_partner_address, p_partner_phone, 'pending', TRUE)
    RETURNING id INTO v_entity_id;

    SELECT COALESCE(raw_user_meta_data->>'display_name', p_partner_name)
    INTO v_display_name 
    FROM auth.users 
    WHERE id = auth.uid();

    INSERT INTO public.profiles (id, entity_id, role, display_name)
    VALUES (auth.uid(), v_entity_id, v_role, COALESCE(v_display_name, p_partner_name))
    ON CONFLICT (id) DO UPDATE 
    SET entity_id = EXCLUDED.entity_id, role = EXCLUDED.role, display_name = EXCLUDED.display_name;

    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
        'clinic_code', p_clinic_code,
        'partner_type', p_partner_type,
        'role', v_role,
        'pod_id', v_pod_id
    )
    WHERE id = auth.uid();

    RETURN QUERY SELECT v_entity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.join_clinic_network(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_clinic_network(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;