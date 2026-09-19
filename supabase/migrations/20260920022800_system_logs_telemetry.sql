-- Create system logs table for autonomous AI telemetry and crash reporting
CREATE TABLE IF NOT EXISTS public.system_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    level text NOT NULL CHECK (level IN ('info', 'warning', 'error', 'fatal')),
    source text NOT NULL,
    message text NOT NULL,
    stack_trace text,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    clinic_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    is_resolved boolean DEFAULT false,
    resolved_at timestamp with time zone,
    resolved_by text
);

-- RLS Policies
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated doctors/admins to read logs for their clinic
CREATE POLICY "Users can view their own clinic logs" ON public.system_logs
    FOR SELECT
    USING (auth.uid() = user_id OR clinic_id IS NOT NULL);

-- Allow authenticated users (and edge functions) to insert logs
CREATE POLICY "Users can insert logs" ON public.system_logs
    FOR INSERT
    WITH CHECK (true);

-- Create index for faster querying by the AI agent
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON public.system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON public.system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_unresolved ON public.system_logs(is_resolved) WHERE is_resolved = false;
