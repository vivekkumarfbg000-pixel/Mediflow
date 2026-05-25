-- Mediflow Connected Care Ecosystem v2.0 - Agentic Telemetry Integration
-- Creates agent_task_pipelines table to log validation checks and orchestrator workflows

-- 1. Create the agentic task pipelines log table
CREATE TABLE IF NOT EXISTS public.agent_task_pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pod_id UUID NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
    patient_id UUID REFERENCES public.patient_registry(id) ON DELETE SET NULL,
    original_prompt TEXT NOT NULL,
    parsed_intent VARCHAR(100) NOT NULL,
    current_step_index INTEGER DEFAULT 0,
    steps_json JSONB NOT NULL, -- Array of { name: string, status: string, message: string, detail?: string }
    status VARCHAR(50) DEFAULT 'pending', -- pending, validating, halted_error, completed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row-Level Security (RLS) on the table
ALTER TABLE public.agent_task_pipelines ENABLE ROW LEVEL SECURITY;

-- 3. Establish direct pod authenticated RLS policies
DROP POLICY IF EXISTS "Enforce tenant pod isolation" ON public.agent_task_pipelines;
CREATE POLICY "Enforce tenant pod isolation" ON public.agent_task_pipeline FOR ALL TO authenticated USING (pod_id = public.get_user_pod());

-- Re-create policy to match table name perfectly
DROP POLICY IF EXISTS "Enforce tenant pod isolation" ON public.agent_task_pipelines;
CREATE POLICY "Enforce tenant pod isolation" ON public.agent_task_pipelines FOR ALL TO authenticated USING (pod_id = public.get_user_pod());

-- 4. Create index for quick RLS searches
CREATE INDEX IF NOT EXISTS idx_agent_task_pipelines_pod_id ON public.agent_task_pipelines(pod_id);
CREATE INDEX IF NOT EXISTS idx_agent_task_pipelines_patient_id ON public.agent_task_pipelines(patient_id);
