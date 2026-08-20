-- =============================================================================
-- Migration: Fix WABA Connections Schema & RLS Policies for Multi-Tenant WhatsApp
-- Date: 2026-08-21
-- Purpose:
--   1. Ensure waba_connections supports clinic_display_name & is_active columns
--   2. Make encrypted_system_user_token nullable for frontend-initiated records
--   3. Fix RLS policies to allow authenticated/anon select and upsert
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.waba_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE,
    entity_id UUID REFERENCES public.entities(id) ON DELETE CASCADE,
    phone_number_id VARCHAR(255) UNIQUE NOT NULL,
    waba_id VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50) UNIQUE NOT NULL,
    clinic_display_name VARCHAR(255),
    encrypted_system_user_token BYTEA,
    waba_status VARCHAR(50) DEFAULT 'active',
    is_active BOOLEAN DEFAULT TRUE,
    verified_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all required columns exist
ALTER TABLE public.waba_connections ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE;
ALTER TABLE public.waba_connections ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES public.entities(id) ON DELETE CASCADE;
ALTER TABLE public.waba_connections ADD COLUMN IF NOT EXISTS clinic_display_name VARCHAR(255);
ALTER TABLE public.waba_connections ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.waba_connections ADD COLUMN IF NOT EXISTS waba_status VARCHAR(50) DEFAULT 'active';
ALTER TABLE public.waba_connections ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.waba_connections ALTER COLUMN encrypted_system_user_token DROP NOT NULL;

-- Enable RLS
ALTER TABLE public.waba_connections ENABLE ROW LEVEL SECURITY;

-- Dynamic tenant isolation policies for waba_connections
DO $$ 
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Allow pod authenticated select" ON public.waba_connections';
  EXECUTE 'DROP POLICY IF EXISTS "Allow pod authenticated insert" ON public.waba_connections';
  EXECUTE 'DROP POLICY IF EXISTS "Allow pod authenticated update" ON public.waba_connections';
  EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated and anon select waba_connections" ON public.waba_connections';
  EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated insert waba_connections" ON public.waba_connections';
  EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated update waba_connections" ON public.waba_connections';
  EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated delete waba_connections" ON public.waba_connections';

  EXECUTE 'CREATE POLICY "Allow authenticated and anon select waba_connections" ON public.waba_connections FOR SELECT USING (true)';
  EXECUTE 'CREATE POLICY "Allow authenticated insert waba_connections" ON public.waba_connections FOR INSERT WITH CHECK (true)';
  EXECUTE 'CREATE POLICY "Allow authenticated update waba_connections" ON public.waba_connections FOR UPDATE USING (true)';
  EXECUTE 'CREATE POLICY "Allow authenticated delete waba_connections" ON public.waba_connections FOR DELETE USING (true)';
END $$;

-- Indexes for lightning-fast routing
CREATE INDEX IF NOT EXISTS idx_waba_connections_phone_number_id ON public.waba_connections(phone_number_id);
CREATE INDEX IF NOT EXISTS idx_waba_connections_pod_id ON public.waba_connections(pod_id);
