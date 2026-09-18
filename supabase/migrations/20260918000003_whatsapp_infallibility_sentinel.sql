-- ==============================================================================
-- 🏛️ VITALSYNC BIG TECH SOVEREIGN MIGRATION
-- Migration: 20260918000003_whatsapp_infallibility_sentinel.sql
-- Directives: Directive 100, 130, 131 (Edge Infallibility & Zero Dead-End Standard)
-- Description: Idempotent indexing, telemetry harmonization, and CDC publication
--              for the Infallible Autonomous Outbound WhatsApp Fallback Sentinel.
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

-- 3. Telemetry Table Idempotent Column Harmonization
CREATE TABLE IF NOT EXISTS public.system_health_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pod_id UUID,
    subsystem VARCHAR(50) DEFAULT 'whatsapp_api',
    severity VARCHAR(50) DEFAULT 'info',
    error_code VARCHAR(255),
    error_stack TEXT,
    healing_attempts INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'unresolved',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.system_health_telemetry 
    ADD COLUMN IF NOT EXISTS service_name TEXT,
    ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS error_message TEXT,
    ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_telemetry_pod_created 
    ON public.system_health_telemetry (pod_id, created_at DESC);

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
