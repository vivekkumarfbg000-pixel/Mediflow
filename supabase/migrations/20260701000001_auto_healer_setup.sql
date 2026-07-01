-- =============================================================================
-- MEDIFLOW CONNECTED CARE ECOSYSTEM — COMBINED AUTO-HEALER SETUP SQL
-- 
-- Pasting and running this script in your Supabase SQL Editor will build:
--   1. Telemetry Log Tables & Indices
--   2. Tenant Pod Isolation and Admin RLS Policies
--   3. Whitelist-hardened execute_autonomous_db_repair RPC function
--   4. Self-healing DB reconstruction & policy auditing functions
--   5. profile role mismatch reconciliation RPC
--   6. Async Edge Function Trigger on critical incidents
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- -----------------------------------------------------------------------------
-- 1. Tables and Indices
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_health_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pod_id UUID NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
    subsystem VARCHAR(50) NOT NULL, -- frontend, backend, database, whatsapp_api, agentic_ai
    severity VARCHAR(50) NOT NULL,  -- info, warning, critical
    error_code VARCHAR(255),
    error_stack TEXT,
    healing_attempts INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'unresolved', -- unresolved, healing, healed, failed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.self_healing_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telemetry_id UUID NOT NULL REFERENCES public.system_health_telemetry(id) ON DELETE CASCADE,
    action_taken TEXT NOT NULL,
    outcome TEXT NOT NULL,
    healed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_system_health_telemetry_pod_id ON public.system_health_telemetry(pod_id);
CREATE INDEX IF NOT EXISTS idx_system_health_telemetry_subsystem ON public.system_health_telemetry(subsystem);

-- -----------------------------------------------------------------------------
-- 2. Row Level Security (RLS) & Policies
-- -----------------------------------------------------------------------------
ALTER TABLE public.system_health_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.self_healing_execution_logs ENABLE ROW LEVEL SECURITY;

-- Telemetry policy: allow matching tenant pod or platform admin
DROP POLICY IF EXISTS "Enforce tenant pod isolation" ON public.system_health_telemetry;
CREATE POLICY "Enforce tenant pod isolation" ON public.system_health_telemetry 
    FOR ALL 
    TO authenticated 
    USING (pod_id = public.get_user_pod() OR public.is_platform_admin());

-- Execution logs policy: allow matching tenant pod or platform admin through nested telemetry join
DROP POLICY IF EXISTS "Enforce nested tenant pod isolation" ON public.self_healing_execution_logs;
CREATE POLICY "Enforce nested tenant pod isolation" ON public.self_healing_execution_logs 
    FOR ALL 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.system_health_telemetry t 
            WHERE t.id = telemetry_id AND (t.pod_id = public.get_user_pod() OR public.is_platform_admin())
        )
    );

-- -----------------------------------------------------------------------------
-- 3. Whitelisted Autonomous Database Repair RPC
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.execute_autonomous_db_repair(TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.execute_autonomous_db_repair(p_table TEXT, p_column TEXT, p_type TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_clean_type TEXT;
    v_is_whitelisted BOOLEAN := FALSE;
BEGIN
    -- Normalize the column type for comparison by removing whitespace, quotes, and converting to lowercase
    v_clean_type := lower(replace(replace(replace(p_type, ' ', ''), '''', ''), '"', ''));

    -- Whitelist validation to prevent arbitrary SQL/DDL injections
    IF (lower(p_table) = 'patient_registry' AND lower(p_column) = 'vitals' AND v_clean_type = 'jsonb') THEN
        v_is_whitelisted := TRUE;
    ELSIF (lower(p_table) = 'patient_registry' AND lower(p_column) = 'token_number' AND v_clean_type = 'text') THEN
        v_is_whitelisted := TRUE;
    ELSIF (lower(p_table) = 'patient_registry' AND lower(p_column) = 'queue_status' AND (v_clean_type = 'textdefaultawaiting_vitals' OR v_clean_type = 'textdefaultawaiting_vitals::text')) THEN
        v_is_whitelisted := TRUE;
    ELSIF (lower(p_table) = 'whatsapp_sessions' AND lower(p_column) = 'auto_healed_flag' AND v_clean_type = 'booleandefaulttrue') THEN
        v_is_whitelisted := TRUE;
    ELSIF (lower(p_table) = 'system_health_telemetry' AND lower(p_column) = 'updated_at' AND (v_clean_type = 'timestamptzdefaultnow()' OR v_clean_type = 'timestamptzdefaultcurrent_timestamp')) THEN
        v_is_whitelisted := TRUE;
    END IF;

    IF NOT v_is_whitelisted THEN
        RAISE EXCEPTION 'Security Threat Blocked: Unauthorized database repair parameters: table=%, column=%, type=%. Parameters do not match safe schema manifest whitelists.', p_table, p_column, p_type;
    END IF;

    -- Verify the table exists in public schema
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = p_table AND table_schema = 'public') THEN
        -- Add the missing column if it does not exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = p_table AND column_name = p_column) THEN
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS %I %s', p_table, p_column, p_type);
            RETURN TRUE;
        END IF;
    END IF;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.execute_autonomous_db_repair(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.execute_autonomous_db_repair(TEXT, TEXT, TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. Self-Healing DB Reconstruction Function
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.reconstruct_missing_table(TEXT);
CREATE OR REPLACE FUNCTION public.reconstruct_missing_table(p_table TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- If table already exists, do nothing and return false
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = p_table AND table_schema = 'public') THEN
        RETURN FALSE;
    END IF;

    IF p_table = 'system_health_telemetry' THEN
        CREATE TABLE public.system_health_telemetry (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            pod_id UUID NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
            subsystem VARCHAR(50) NOT NULL,
            severity VARCHAR(50) NOT NULL,
            error_code VARCHAR(255),
            error_stack TEXT,
            healing_attempts INTEGER DEFAULT 0,
            status VARCHAR(50) DEFAULT 'unresolved',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        ALTER TABLE public.system_health_telemetry ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Enforce tenant pod isolation" ON public.system_health_telemetry;
        CREATE POLICY "Enforce tenant pod isolation" ON public.system_health_telemetry 
            FOR ALL 
            TO authenticated 
            USING (pod_id = public.get_user_pod() OR public.is_platform_admin());
        CREATE INDEX IF NOT EXISTS idx_system_health_telemetry_pod_id ON public.system_health_telemetry(pod_id);
        CREATE INDEX IF NOT EXISTS idx_system_health_telemetry_subsystem ON public.system_health_telemetry(subsystem);
        
        -- Restore triggers if they exist
        IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_auto_heal_telemetry_waba_before') THEN
            DROP TRIGGER IF EXISTS trg_auto_heal_telemetry_waba_before ON public.system_health_telemetry;
            CREATE TRIGGER trg_auto_heal_telemetry_waba_before
                BEFORE INSERT OR UPDATE OF status ON public.system_health_telemetry
                FOR EACH ROW
                EXECUTE FUNCTION public.fn_auto_heal_telemetry_waba_before();
        END IF;

        IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_auto_heal_telemetry_waba_after') THEN
            DROP TRIGGER IF EXISTS trg_auto_heal_telemetry_waba_after ON public.system_health_telemetry;
            CREATE TRIGGER trg_auto_heal_telemetry_waba_after
                AFTER INSERT ON public.system_health_telemetry
                FOR EACH ROW
                EXECUTE FUNCTION public.fn_auto_heal_telemetry_waba_after();
        END IF;

        -- Reload PostgREST schema cache
        NOTIFY pgrst, 'reload schema';
        RETURN TRUE;

    ELSIF p_table = 'self_healing_execution_logs' THEN
        -- Make sure dependency table is present
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_health_telemetry' AND table_schema = 'public') THEN
            PERFORM public.reconstruct_missing_table('system_health_telemetry');
        END IF;

        CREATE TABLE public.self_healing_execution_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            telemetry_id UUID NOT NULL REFERENCES public.system_health_telemetry(id) ON DELETE CASCADE,
            action_taken TEXT NOT NULL,
            outcome TEXT NOT NULL,
            healed_at TIMESTAMPTZ DEFAULT NOW()
        );
        ALTER TABLE public.self_healing_execution_logs ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Enforce nested tenant pod isolation" ON public.self_healing_execution_logs;
        CREATE POLICY "Enforce nested tenant pod isolation" ON public.self_healing_execution_logs 
            FOR ALL 
            TO authenticated 
            USING (
                EXISTS (
                    SELECT 1 FROM public.system_health_telemetry t 
                    WHERE t.id = telemetry_id AND (t.pod_id = public.get_user_pod() OR public.is_platform_admin())
                )
            );

        -- Reload PostgREST schema cache
        NOTIFY pgrst, 'reload schema';
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.reconstruct_missing_table(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconstruct_missing_table(TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. RLS Leaky Policy Auditing Function
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.scan_and_heal_leaky_policies();
CREATE OR REPLACE FUNCTION public.scan_and_heal_leaky_policies()
RETURNS TABLE (o_table_name TEXT, o_policy_name TEXT, o_status TEXT) AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT schemaname, tablename, policyname, cmd, qual, with_check
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('profiles', 'pods', 'entities', 'lab_reports', 'activity_logs', 'whatsapp_sessions')
          AND (qual = 'true' OR with_check = 'true' OR qual ILIKE '%true%' OR with_check ILIKE '%true%')
    LOOP
        -- Reconstruct telemetry table if missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_health_telemetry' AND table_schema = 'public') THEN
            PERFORM public.reconstruct_missing_table('system_health_telemetry');
        END IF;

        INSERT INTO public.system_health_telemetry (pod_id, subsystem, severity, error_code, error_stack, status)
        VALUES (
            'dfb2a1a8-8e68-4f8a-929e-4a6c8e317009', -- platform admin HQ operations pod
            'database',
            'critical',
            'LeakyRLSPolicyDetected',
            'Table: ' || r.tablename || ', Policy: ' || r.policyname || ', Cmd: ' || r.cmd,
            'healed'
        );

        -- Auto-heal: Drop the leaky policy
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);

        o_table_name := r.tablename;
        o_policy_name := r.policyname;
        o_status := 'LEAKY_POLICY_DROPPED_HEALED';
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.scan_and_heal_leaky_policies() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.scan_and_heal_leaky_policies() TO authenticated;

-- -----------------------------------------------------------------------------
-- 6. Profile Role Reconciliation RPC
-- -----------------------------------------------------------------------------
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
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.reconcile_profile_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_profile_role() TO authenticated;

-- -----------------------------------------------------------------------------
-- 7. Async Edge Function Trigger on Critical Incidents
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dispatch_critical_telemetry_webhook()
RETURNS TRIGGER AS $$
DECLARE
    v_payload   JSONB;
    v_edge_url  TEXT;
BEGIN
    -- Only fire for critical severity events
    IF NEW.severity <> 'critical' THEN
        RETURN NEW;
    END IF;

    -- Build the JSON payload for the Edge Function
    v_payload := jsonb_build_object(
        'event',            'critical_telemetry',
        'id',               NEW.id,
        'pod_id',           NEW.pod_id,
        'subsystem',        NEW.subsystem,
        'severity',         NEW.severity,
        'error_code',       NEW.error_code,
        'error_stack',      NEW.error_stack,
        'healing_attempts', NEW.healing_attempts,
        'status',           NEW.status,
        'created_at',       NEW.created_at
    );

    BEGIN
        v_edge_url := current_setting('app.supabase_project_url', true);
    EXCEPTION WHEN OTHERS THEN
        RETURN NEW;
    END;

    -- Guard: If project URL is null, empty, or not configured, exit silently
    IF v_edge_url IS NULL OR v_edge_url = '' THEN
        RETURN NEW;
    END IF;

    v_edge_url := v_edge_url || '/functions/v1/notify-developer-webhook';

    -- Async HTTP POST via net.http_post (using jsonb body directly)
    PERFORM net.http_post(
        url     := v_edge_url,
        body    := v_payload,
        headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key', true)
        )
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.dispatch_critical_telemetry_webhook() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_critical_telemetry_webhook ON public.system_health_telemetry;
CREATE TRIGGER trg_critical_telemetry_webhook
    AFTER INSERT ON public.system_health_telemetry
    FOR EACH ROW
    EXECUTE FUNCTION public.dispatch_critical_telemetry_webhook();

COMMENT ON TRIGGER trg_critical_telemetry_webhook ON public.system_health_telemetry IS
    'Fires the notify-developer-webhook Edge Function asynchronously for every critical severity insert.';

-- -----------------------------------------------------------------------------
-- Reload PostgREST schema cache to register new items
-- -----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
