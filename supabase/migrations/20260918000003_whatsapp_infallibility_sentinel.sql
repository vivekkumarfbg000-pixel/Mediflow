-- ==============================================================================
-- 🏛️ VITALSYNC BIG TECH SOVEREIGN MIGRATION
-- Migration: 20260918000003_whatsapp_infallibility_sentinel.sql
-- Directives: Directive 100, 130, 131 (Edge Infallibility & Zero Dead-End Standard)
-- Description: Idempotent indexing, telemetry, and CDC publication for the Infallible
--              Autonomous Outbound WhatsApp Fallback Sentinel.
-- ==============================================================================

-- 1. Idempotent Column Additions on appointments
ALTER TABLE IF EXISTS public.appointments 
    ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS token_number TEXT,
    ADD COLUMN IF NOT EXISTS booking_source TEXT DEFAULT 'whatsapp',
    ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- 2. Performance Indexing for Fallback Query Performance
CREATE INDEX IF NOT EXISTS idx_appointments_phone_created_desc 
    ON public.appointments (patient_phone, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_appointments_payment_status_triage 
    ON public.appointments (pod_id, payment_status, status);

-- 3. Telemetry Table Idempotent Verification
CREATE TABLE IF NOT EXISTS public.system_health_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pod_id UUID,
    service_name TEXT NOT NULL,
    status TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_pod_service_recorded 
    ON public.system_health_telemetry (pod_id, service_name, recorded_at DESC);

-- 4. Idempotent Realtime CDC Publication Verification (Directive 125)
DO $$
DECLARE
    t text;
    tables text[] := ARRAY['appointments', 'whatsapp_sessions', 'system_health_telemetry'];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
              AND schemaname = 'public' 
              AND tablename = t
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t);
        END IF;
    END LOOP;
END $$;
