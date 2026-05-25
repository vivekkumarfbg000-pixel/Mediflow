-- Mediflow Connected Care Ecosystem v2.0 - Self-Healing Telemetry Integration
-- Creates system_health_telemetry and repair RPCs to track anomalies autonomously

-- 1. Create the system health telemetry table
CREATE TABLE IF NOT EXISTS public.system_health_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pod_id UUID NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
    subsystem VARCHAR(50) NOT NULL, -- frontend, backend, database, whatsapp_api, agentic_ai
    severity VARCHAR(50) NOT NULL, -- info, warning, critical
    error_code VARCHAR(255),
    error_stack TEXT,
    healing_attempts INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'unresolved', -- unresolved, healing, healed, failed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on telemetry table
ALTER TABLE public.system_health_telemetry ENABLE ROW LEVEL SECURITY;

-- Apply direct pod isolation policy
DROP POLICY IF EXISTS "Enforce tenant pod isolation" ON public.system_health_telemetry;
CREATE POLICY "Enforce tenant pod isolation" ON public.system_health_telemetry FOR ALL TO authenticated USING (pod_id = public.get_user_pod());

-- 2. Create the self-healing execution logs table
CREATE TABLE IF NOT EXISTS public.self_healing_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telemetry_id UUID NOT NULL REFERENCES public.system_health_telemetry(id) ON DELETE CASCADE,
    action_taken TEXT NOT NULL,
    outcome TEXT NOT NULL,
    healed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on execution logs table
ALTER TABLE public.self_healing_execution_logs ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for execution logs (via nested telemetry check to bypass direct pod keys requirement)
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

-- 3. Create indices for high-speed indexing
CREATE INDEX IF NOT EXISTS idx_system_health_telemetry_pod_id ON public.system_health_telemetry(pod_id);
CREATE INDEX IF NOT EXISTS idx_system_health_telemetry_subsystem ON public.system_health_telemetry(subsystem);

-- 4. Create the autonomous database repair RPC function
CREATE OR REPLACE FUNCTION public.execute_autonomous_db_repair(p_table TEXT, p_column TEXT, p_type TEXT)
RETURNS BOOLEAN AS $$
BEGIN
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
