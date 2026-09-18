-- ==============================================================================
-- 🏛️ VitalSync Idempotent Schema Migration
-- Migration: 20260918000004_add_unified_invoices_source_column.sql
-- Description: Adds 'source' column to public.unified_invoices and ensures
--              fail-safe trigger execution for system_health_telemetry.
-- ==============================================================================

-- 1. Idempotently add 'source' column to public.unified_invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'unified_invoices'
      AND column_name = 'source'
  ) THEN
    ALTER TABLE public.unified_invoices ADD COLUMN source TEXT DEFAULT 'direct';
    RAISE NOTICE 'Added column source to public.unified_invoices';
  ELSE
    RAISE NOTICE 'Column source already exists on public.unified_invoices';
  END IF;
END $$;

-- 2. Ensure an index exists on (pod_id, source) for high-performance ledger filtering
CREATE INDEX IF NOT EXISTS idx_unified_invoices_pod_source ON public.unified_invoices (pod_id, source);

-- 3. Provide fallback dummy function for net.http_post if pg_net is not active
-- Prevents system_health_telemetry triggers from failing inserts on local or unprivileged environments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'net' AND p.proname = 'http_post'
  ) THEN
    -- Ensure schema 'net' exists
    CREATE SCHEMA IF NOT EXISTS net;
    CREATE OR REPLACE FUNCTION net.http_post(
      url text,
      body text DEFAULT '{}',
      params jsonb DEFAULT '{}',
      headers jsonb DEFAULT '{}',
      timeout_milliseconds integer DEFAULT 5000
    ) RETURNS bigint AS $f$
    BEGIN
      -- Fallback no-op if pg_net is not compiled in the Postgres cluster
      RETURN 1;
    END;
    $f$ LANGUAGE plpgsql SECURITY DEFINER;
    RAISE NOTICE 'Created resilient fallback for net.http_post';
  END IF;
END $$;
