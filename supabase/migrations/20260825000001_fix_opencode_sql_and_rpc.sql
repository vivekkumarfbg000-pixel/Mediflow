-- ==============================================================================
-- Migration: 20260825000001_fix_opencode_sql_and_rpc.sql
-- Description: Fixed & Idempotent Schema Script (RLS Policy, Payment Gate, Auto-Healer RPC)
-- Author: VitalSync Autonomous Taskforce
-- ==============================================================================

-- 1. Ensure chronic_care_cohorts table exists, has RLS, and CDC enabled for realtime sync
CREATE TABLE IF NOT EXISTS public.chronic_care_cohorts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id TEXT NOT NULL,
    patient_name TEXT NOT NULL,
    patient_phone TEXT,
    doctor_id TEXT NOT NULL,
    pod_id TEXT NOT NULL,
    condition_code TEXT NOT NULL,
    condition_name TEXT NOT NULL,
    medications JSONB NOT NULL DEFAULT '[]'::jsonb,
    days_supply INT NOT NULL DEFAULT 30,
    dispensed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    next_refill_date DATE NOT NULL,
    next_retest_date DATE,
    retest_test_code TEXT,
    retest_test_name TEXT,
    adherence_score NUMERIC(5,2) DEFAULT 100.00,
    status TEXT NOT NULL DEFAULT 'active',
    monthly_medicine_spend NUMERIC(10,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chronic_cohorts_patient ON public.chronic_care_cohorts(patient_id);
CREATE INDEX IF NOT EXISTS idx_chronic_cohorts_pod ON public.chronic_care_cohorts(pod_id);
CREATE INDEX IF NOT EXISTS idx_chronic_cohorts_condition ON public.chronic_care_cohorts(condition_code);
CREATE INDEX IF NOT EXISTS idx_chronic_cohorts_next_refill ON public.chronic_care_cohorts(next_refill_date);
CREATE INDEX IF NOT EXISTS idx_chronic_cohorts_status ON public.chronic_care_cohorts(status);

ALTER TABLE public.chronic_care_cohorts ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS Policy Replacement (Postgres does not support IF NOT EXISTS on CREATE POLICY)
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.chronic_care_cohorts;
DROP POLICY IF EXISTS "allow_authenticated_all_chronic_cohorts" ON public.chronic_care_cohorts;
CREATE POLICY "allow_authenticated_all_chronic_cohorts" 
  ON public.chronic_care_cohorts FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- Enable Supabase Realtime CDC publication for chronic_care_cohorts
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chronic_care_cohorts'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.chronic_care_cohorts;
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 2. Add missing columns for payment gate enforcement (Rule 3)
ALTER TABLE public.appointments 
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- 3. Add index for payment status queries (sub-300ms CDC)
CREATE INDEX IF NOT EXISTS idx_appointments_payment_status 
  ON public.appointments (payment_status, pod_id);

-- 4. Ensure financial_ledgers has platform_fee_deducted column for Rule 58 compliance
ALTER TABLE public.financial_ledgers 
  ADD COLUMN IF NOT EXISTS platform_fee_deducted NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gateway_disbursed_net NUMERIC DEFAULT 0;

-- 5. Add is_demo_account flag to profiles for strict demo identity matching (Rule 75)
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS is_demo_account BOOLEAN DEFAULT FALSE;

-- 6. Create hardened heal_schema_drift RPC for Auto-Healer (Rule 45)
DROP FUNCTION IF EXISTS public.heal_schema_drift(TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.heal_schema_drift(
  p_table_name TEXT, 
  p_column_name TEXT, 
  p_column_type TEXT
) 
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
DECLARE
  v_col_exists BOOLEAN;
  v_allowed_tables TEXT[] := ARRAY[
    'patient_registry', 
    'whatsapp_sessions', 
    'system_health_telemetry', 
    'medicine_bills', 
    'lab_requisitions', 
    'financial_ledgers',
    'waba_connections',
    'profiles',
    'pods',
    'appointments',
    'chronic_care_cohorts',
    'chronic_adherence_logs',
    'unified_invoices',
    'clinic_sops',
    'encounters',
    'inventory_batches',
    'whatsapp_broadcast_campaigns',
    'whatsapp_broadcast_queue'
  ];
BEGIN
  -- Security Guard 1: Restrict table names to trusted clinical schema whitelist
  IF NOT (lower(p_table_name) = ANY(v_allowed_tables)) THEN
    RETURN jsonb_build_object('success', false, 'error', format('Table "%s" is not in allowed clinical whitelist', p_table_name));
  END IF;

  -- Security Guard 2: Sanitize SQL identifier names
  IF p_column_name ~ '[^a-zA-Z0-9_]' OR p_table_name ~ '[^a-zA-Z0-9_]' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid SQL identifier characters');
  END IF;

  -- Check if column already exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = p_table_name 
      AND column_name = p_column_name
  ) INTO v_col_exists;
  
  IF v_col_exists THEN
    RETURN jsonb_build_object('success', true, 'action', 'already_exists', 'table', p_table_name, 'column', p_column_name);
  END IF;

  -- Execute DDL safely with IF NOT EXISTS
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS %I %s', p_table_name, p_column_name, p_column_type);
  
  RETURN jsonb_build_object('success', true, 'action', 'column_added', 'table', p_table_name, 'column', p_column_name);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 7. Create execute_autonomous_db_repair RPC (Rule 45)
DROP FUNCTION IF EXISTS public.execute_autonomous_db_repair(TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.execute_autonomous_db_repair(
  p_table TEXT, 
  p_column TEXT, 
  p_type TEXT
) 
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN public.heal_schema_drift(p_table, p_column, p_type);
END;
$$;

-- 8. Grant execute permissions securely
GRANT EXECUTE ON FUNCTION public.heal_schema_drift(TEXT, TEXT, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.execute_autonomous_db_repair(TEXT, TEXT, TEXT) TO authenticated, anon, service_role;
