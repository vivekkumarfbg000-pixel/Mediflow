-- ============================================================================
-- Migration: VitalSync Personalized Clinic Code Architecture (VS-S03N)
-- Author: VitalSync Autonomous Big Tech Engineering Taskforce
-- Purpose: 
--   1. Idempotently ensure all pods table columns exist.
--   2. Update register_clinic_network RPC to generate VS-[First][Seq][Last] codes.
--   3. Upgrade legacy demo clinic code MF-APEX to VS-V01R.
-- ============================================================================

-- 1. Ensure pods columns are complete and idempotent
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

-- 2. Update register_clinic_network RPC
DROP FUNCTION IF EXISTS public.register_clinic_network(TEXT, TEXT, TEXT, TEXT);

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
    -- 1. Extract display name from user metadata or fall back to clinic name
    SELECT COALESCE(raw_user_meta_data->>'display_name', p_clinic_name)
    INTO v_display_name 
    FROM auth.users 
    WHERE id = auth.uid();

    -- 2. Calculate next sequence number from pods count
    SELECT COALESCE(COUNT(*), 0) + 1 INTO v_seq FROM public.pods;

    -- 3. Clean doctor name (strip Dr., Doctor, Prof., non-letters)
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

    -- Guarantee uniqueness
    WHILE EXISTS (SELECT 1 FROM public.pods WHERE pods.clinic_code = v_clinic_code) LOOP
        v_seq := v_seq + 1;
        v_clinic_code := 'VS-' || v_first_char || lpad(v_seq::text, 2, '0') || v_last_char;
    END LOOP;

    -- Insert Pod
    INSERT INTO public.pods (name, clinic_code, is_active, doctor_name, phone, location)
    VALUES (p_clinic_name, v_clinic_code, TRUE, COALESCE(v_display_name, p_clinic_name), p_clinic_phone, p_clinic_address)
    RETURNING id INTO v_pod_id;

    -- Insert Entity
    INSERT INTO public.entities (pod_id, entity_type, name, address, phone, status, is_active)
    VALUES (v_pod_id, 'clinic', p_clinic_name, p_clinic_address, p_clinic_phone, 'approved', TRUE)
    RETURNING id INTO v_entity_id;

    -- Insert / Update Profile
    INSERT INTO public.profiles (id, entity_id, pod_id, role, consultation_fee, display_name)
    VALUES (auth.uid(), v_entity_id, v_pod_id, 'doctor', 400.00, COALESCE(v_display_name, 'Doctor'))
    ON CONFLICT (id) DO UPDATE 
    SET entity_id = EXCLUDED.entity_id, pod_id = EXCLUDED.pod_id, role = EXCLUDED.role, display_name = EXCLUDED.display_name;

    -- Update JWT User Metadata
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

-- 3. Upgrade legacy demo clinic code MF-APEX to VS-V01R
UPDATE public.pods 
SET clinic_code = 'VS-V01R' 
WHERE id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001' OR clinic_code = 'MF-APEX';
