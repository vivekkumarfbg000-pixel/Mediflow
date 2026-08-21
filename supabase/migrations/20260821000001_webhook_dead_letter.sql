-- =============================================================================
-- Migration: 20260821000001_webhook_dead_letter.sql
-- Description: Idempotent creation of webhook_dead_letter table for failed Meta payloads
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.webhook_dead_letter (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payload JSONB NOT NULL,
    error TEXT,
    received_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying dead-letter payloads by date
CREATE INDEX IF NOT EXISTS idx_webhook_dead_letter_received_at ON public.webhook_dead_letter (received_at DESC);

-- Enable RLS and grant service_role full access
ALTER TABLE public.webhook_dead_letter ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'webhook_dead_letter' 
        AND policyname = 'service_role_all_webhook_dead_letter'
    ) THEN
        CREATE POLICY service_role_all_webhook_dead_letter 
        ON public.webhook_dead_letter 
        FOR ALL 
        TO service_role 
        USING (true) 
        WITH CHECK (true);
    END IF;
END $$;
