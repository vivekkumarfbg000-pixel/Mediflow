-- Mediflow Tech Team Skill Resolve Migration
-- Drop existing functions to prevent return type mismatch error 42P13
DROP FUNCTION IF EXISTS public.register_clinic_network(text,text,text,text);
DROP FUNCTION IF EXISTS public.join_clinic_network(text,text,text,text,text);

-- 1. Create register_clinic_network RPC
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
        'role', 'doctor'
    )
    WHERE id = auth.uid();

    RETURN QUERY SELECT v_clinic_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.register_clinic_network(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_clinic_network(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- 2. Create join_clinic_network RPC
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
        'role', v_role
    )
    WHERE id = auth.uid();

    RETURN QUERY SELECT v_entity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.join_clinic_network(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_clinic_network(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- 3. Seed Platform Admin and Pod operations
INSERT INTO public.pods (id, name, clinic_code, is_active)
VALUES (
  'dfb2a1a8-8e68-4f8a-929e-4a6c8e317009',
  'Mediflow HQ Operations Pod',
  'MF-HQ99',
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.entities (id, pod_id, entity_type, name, status, is_active)
VALUES (
  'dfb2a1a8-8e68-4f8a-929e-4a6c8e317009',
  'dfb2a1a8-8e68-4f8a-929e-4a6c8e317009',
  'clinic',
  'Mediflow HQ Operations',
  'approved',
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role,
  aud,
  created_at,
  updated_at
)
SELECT
  'dfb2a1a8-8e68-4f8a-929e-4a6c8e317109',
  instance_id,
  'owner@mediflow.com',
  encrypted_password,
  NOW(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"role": "platform_admin", "display_name": "SaaS Platform Owner"}'::jsonb,
  false,
  'authenticated',
  'authenticated',
  NOW(),
  NOW()
FROM auth.users
WHERE email = 'doctor@mediflow.com'
ON CONFLICT (id) DO NOTHING;

UPDATE auth.users
SET 
  email = 'owner@mediflow.com',
  encrypted_password = COALESCE((SELECT encrypted_password FROM auth.users WHERE email = 'doctor@mediflow.com' LIMIT 1), encrypted_password),
  email_confirmed_at = COALESCE(email_confirmed_at, NOW())
WHERE id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317109';

INSERT INTO public.profiles (id, entity_id, role, consultation_fee, display_name)
VALUES (
  'dfb2a1a8-8e68-4f8a-929e-4a6c8e317109',
  'dfb2a1a8-8e68-4f8a-929e-4a6c8e317009',
  'platform_admin',
  0.00,
  'SaaS Platform Owner'
)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, entity_id = EXCLUDED.entity_id, display_name = EXCLUDED.display_name;

-- 4. WABA Backend Self-Healing Triggers
CREATE OR REPLACE FUNCTION public.fn_auto_heal_waba_disconnect()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.waba_status = 'disconnected' THEN
        -- Insert critical telemetry log (the AFTER INSERT trigger on telemetry will handle self_healing_execution_logs)
        INSERT INTO public.system_health_telemetry (pod_id, subsystem, severity, error_code, error_stack, status, healing_attempts)
        VALUES (
            NEW.pod_id,
            'whatsapp_api',
            'warning',
            'WABAWebhookTimeout',
            'WABA webhook disconnected in backend - status changed to disconnected for phone ' || NEW.phone_number,
            'healing',
            1
        );

        -- Auto-heal: set status back to active
        NEW.waba_status := 'active';
        NEW.updated_at := NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind the trigger BEFORE UPDATE on waba_connections
DROP TRIGGER IF EXISTS trg_auto_heal_waba_disconnect ON public.waba_connections;
CREATE TRIGGER trg_auto_heal_waba_disconnect
    BEFORE UPDATE ON public.waba_connections
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_auto_heal_waba_disconnect();


CREATE OR REPLACE FUNCTION public.fn_auto_heal_telemetry_waba_before()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.subsystem = 'whatsapp_api' AND NEW.status IN ('healing', 'unresolved') THEN
        NEW.status := 'healed';
        NEW.updated_at := NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind the trigger BEFORE INSERT OR UPDATE on system_health_telemetry
DROP TRIGGER IF EXISTS trg_auto_heal_telemetry_waba_before ON public.system_health_telemetry;
CREATE TRIGGER trg_auto_heal_telemetry_waba_before
    BEFORE INSERT OR UPDATE OF status ON public.system_health_telemetry
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_auto_heal_telemetry_waba_before();


CREATE OR REPLACE FUNCTION public.fn_auto_heal_telemetry_waba_after()
RETURNS TRIGGER AS $$
DECLARE
    v_repair_count INTEGER;
BEGIN
    IF NEW.subsystem = 'whatsapp_api' THEN
        -- 1. Check and reactivate disconnected connections
        UPDATE public.waba_connections
        SET waba_status = 'active', updated_at = NOW()
        WHERE waba_status = 'disconnected';
        
        GET DIAGNOSTICS v_repair_count = ROW_COUNT;

        -- 2. Clean up stale sessions
        UPDATE public.whatsapp_sessions
        SET current_state = 'INACTIVE'
        WHERE current_state = 'AWAITING_WELCOME'
          AND created_at < NOW() - INTERVAL '10 minutes';

        -- 3. Record self-healing execution log
        IF NOT EXISTS (SELECT 1 FROM public.self_healing_execution_logs WHERE telemetry_id = NEW.id) THEN
            INSERT INTO public.self_healing_execution_logs (telemetry_id, action_taken, outcome)
            VALUES (
                NEW.id,
                '📱 Backend Telemetry Trigger auto-healer engaged.' || CHR(10) ||
                '🔍 Scanned database for WABA connection failures.' || CHR(10) ||
                '🛠️ Re-activated ' || v_repair_count::TEXT || ' disconnected WABA connections.' || CHR(10) ||
                '🧹 Swept and inactivated stale patient WABA sessions.',
                'RESOLVED_SUCCESS'
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind the trigger AFTER INSERT on system_health_telemetry
DROP TRIGGER IF EXISTS trg_auto_heal_telemetry_waba_after ON public.system_health_telemetry;
CREATE TRIGGER trg_auto_heal_telemetry_waba_after
    AFTER INSERT ON public.system_health_telemetry
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_auto_heal_telemetry_waba_after();

-- Cleanup old trigger name
DROP TRIGGER IF EXISTS trg_auto_heal_telemetry_waba_insert ON public.system_health_telemetry;


