-- ==============================================================================
-- Migration: 20260724000000_schema_drift_healer_rpc.sql
-- Description: Idempotent Postgres RPC for autonomous schema drift repair
-- ==============================================================================

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
  v_query TEXT;
  v_allowed_tables TEXT[] := ARRAY[
    'patient_registry', 
    'whatsapp_sessions', 
    'system_health_telemetry', 
    'medicine_bills', 
    'lab_requisitions', 
    'financial_ledgers',
    'waba_connections',
    'profiles',
    'pods'
  ];
BEGIN
  -- Safety Guard: Restrict table names to trusted clinical schema tables
  IF NOT (p_table_name = ANY(v_allowed_tables)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Table name not in allowed whitelist');
  END IF;

  -- Safety Guard: Sanitize identifier names
  IF p_column_name ~ '[^a-zA-Z0-9_]' OR p_table_name ~ '[^a-zA-Z0-9_]' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid SQL identifier characters');
  END IF;

  -- Check if column already exists
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = p_table_name 
      AND column_name = p_column_name
  ) INTO v_col_exists;

  IF v_col_exists THEN
    RETURN jsonb_build_object('success', true, 'action', 'already_exists', 'table', p_table_name, 'column', p_column_name);
  END IF;

  -- Execute DDL safely
  v_query := format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS %I %s', p_table_name, p_column_name, p_column_type);
  EXECUTE v_query;

  RETURN jsonb_build_object('success', true, 'action', 'column_added', 'table', p_table_name, 'column', p_column_name);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.heal_schema_drift(TEXT, TEXT, TEXT) TO authenticated, anon, service_role;
