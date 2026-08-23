-- =============================================================================
-- Migration: Add direct access_token column to waba_connections for reliable outbound dispatch
-- Date: 2026-08-23
-- =============================================================================

ALTER TABLE public.waba_connections ADD COLUMN IF NOT EXISTS access_token TEXT;

-- Enable RLS and public/service access
ALTER TABLE public.waba_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated and anon select waba_connections" ON public.waba_connections;
CREATE POLICY "Allow authenticated and anon select waba_connections" ON public.waba_connections FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert waba_connections" ON public.waba_connections;
CREATE POLICY "Allow authenticated insert waba_connections" ON public.waba_connections FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update waba_connections" ON public.waba_connections;
CREATE POLICY "Allow authenticated update waba_connections" ON public.waba_connections FOR UPDATE USING (true);
