-- =============================================================================
-- Migration: 20260916000001_webhook_idempotency.sql
-- Description: Idempotency table to prevent Meta Webhook duplicate processing
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_processed_messages (
    message_id TEXT PRIMARY KEY,
    received_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for TTL or cleanup (optional, but good for operations)
CREATE INDEX IF NOT EXISTS idx_whatsapp_processed_messages_received_at 
ON public.whatsapp_processed_messages (received_at DESC);

-- Enable RLS and grant service_role full access
ALTER TABLE public.whatsapp_processed_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'whatsapp_processed_messages' 
        AND policyname = 'service_role_all_whatsapp_processed_messages'
    ) THEN
        CREATE POLICY service_role_all_whatsapp_processed_messages 
        ON public.whatsapp_processed_messages 
        FOR ALL 
        TO service_role 
        USING (true) 
        WITH CHECK (true);
    END IF;
END $$;
