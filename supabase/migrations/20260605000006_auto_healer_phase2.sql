-- Mediflow Tech Team Hardening Migration - Phase 2
DROP FUNCTION IF EXISTS public.reconstruct_missing_table(TEXT);
DROP FUNCTION IF EXISTS public.scan_and_heal_leaky_policies();

-- Create reconstruct_missing_table function
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
        CREATE POLICY "Enforce tenant pod isolation" ON public.system_health_telemetry FOR ALL TO authenticated USING (pod_id = public.get_user_pod());
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
                    WHERE t.id = telemetry_id AND t.pod_id = public.get_user_pod()
                )
            );

        -- Reload PostgREST schema cache
        NOTIFY pgrst, 'reload schema';
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create scan_and_heal_leaky_policies function
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

-- Repair and update dispatch_critical_telemetry_webhook to match net.http_post JSONB body argument
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

-- Grant permissions to authenticated role
REVOKE EXECUTE ON FUNCTION public.reconstruct_missing_table(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconstruct_missing_table(TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.scan_and_heal_leaky_policies() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.scan_and_heal_leaky_policies() TO authenticated;
