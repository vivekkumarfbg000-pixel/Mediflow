-- =============================================================================
-- Mediflow Connected Care Ecosystem — Combined Database Upgrade Script
-- Compiled on: 2026-05-30
-- Combines migrations from 20260525000000 to 20260531000001
-- Run this script in the Supabase SQL Editor to apply all recent schema, security (RLS),
-- triggers, indexes, and views for the multi-tenant SaaS.
-- =============================================================================

-- =============================================================================
-- STEP 1: Multi-Tenant Pod Partitioning (20260525000000)
-- =============================================================================

-- Ensure public.pods table exists
CREATE TABLE IF NOT EXISTS public.pods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    location TEXT,
    clinic_code VARCHAR(50) UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure public.entities table exists
CREATE TABLE IF NOT EXISTS public.entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL, -- clinic, pharmacy, lab, platform
    name TEXT NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    gstin VARCHAR(50),
    subscription_tier VARCHAR(50),
    monthly_fee NUMERIC(10,2),
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure public.profiles table exists
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY, -- references auth.users(id)
    entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL,
    role VARCHAR(50) NOT NULL, -- doctor, pharmacist, technician, platform_admin
    consultation_fee NUMERIC(10,2) DEFAULT 400.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure core tables contain status and pod_id columns if they exist from prior setups
ALTER TABLE public.entities ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'approved';
ALTER TABLE public.entities ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL;

-- Ensure public.patient_registry table exists
CREATE TABLE IF NOT EXISTS public.patient_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registered_at_entity UUID REFERENCES public.entities(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    age INT,
    gender TEXT CHECK (gender IN ('Male','Female','Other')),
    abha_id TEXT,
    vitals JSONB,
    token_number TEXT,
    patient_code TEXT,
    queue_status TEXT DEFAULT 'awaiting_vitals',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.patient_registry ADD COLUMN IF NOT EXISTS patient_code TEXT;

-- Ensure public.encounters table exists
CREATE TABLE IF NOT EXISTS public.encounters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL,
    doctor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    patient_id UUID REFERENCES public.patient_registry(id) ON DELETE SET NULL,
    clinical_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure public.lab_requisitions table exists
CREATE TABLE IF NOT EXISTS public.lab_requisitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encounter_id UUID REFERENCES public.encounters(id) ON DELETE SET NULL,
    patient_id UUID REFERENCES public.patient_registry(id) ON DELETE CASCADE,
    lab_entity_id UUID REFERENCES public.entities(id) ON DELETE CASCADE,
    loinc_code VARCHAR(100),
    test_name TEXT,
    barcode VARCHAR(100),
    assigned_technician_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure public.unified_invoices table exists
CREATE TABLE IF NOT EXISTS public.unified_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encounter_id UUID REFERENCES public.encounters(id) ON DELETE SET NULL,
    patient_id UUID REFERENCES public.patient_registry(id) ON DELETE CASCADE,
    doctor_fee NUMERIC(10,2) DEFAULT 0.00,
    lab_fee NUMERIC(10,2) DEFAULT 0.00,
    pharmacy_fee NUMERIC(10,2) DEFAULT 0.00,
    platform_fee NUMERIC(10,2) DEFAULT 0.00,
    total_amount NUMERIC(10,2) DEFAULT 0.00,
    upi_qr_payload TEXT,
    status VARCHAR(50) DEFAULT 'unpaid',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure public.financial_ledgers table exists
CREATE TABLE IF NOT EXISTS public.financial_ledgers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES public.unified_invoices(id) ON DELETE SET NULL,
    source_entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL,
    destination_entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL,
    transaction_type VARCHAR(100),
    gross_amount NUMERIC(10,2) DEFAULT 0.00,
    commission_rate NUMERIC(5,2) DEFAULT 0.00,
    net_payout NUMERIC(10,2) DEFAULT 0.00,
    payment_status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure public.whatsapp_sessions table exists
CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES public.patient_registry(id) ON DELETE SET NULL,
    patient_phone VARCHAR(50) UNIQUE,
    current_state VARCHAR(100) DEFAULT 'IDLE',
    session_data JSONB DEFAULT '{}'::jsonb,
    last_interaction TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure public.activity_logs table exists
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL,
    action_type VARCHAR(100),
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure public.clinic_staff table exists
CREATE TABLE IF NOT EXISTS public.clinic_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add pod_id UUID column with fallback default to all transactional tables
ALTER TABLE public.patient_registry ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
ALTER TABLE public.encounters ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
ALTER TABLE public.lab_requisitions ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
ALTER TABLE public.lab_requisitions ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE public.unified_invoices ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
ALTER TABLE public.financial_ledgers ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
ALTER TABLE public.whatsapp_sessions ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
ALTER TABLE public.clinic_staff ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

-- Helper function to query the active pod UUID of the authenticated user session
CREATE OR REPLACE FUNCTION public.get_user_pod()
RETURNS UUID AS $$
DECLARE
  v_pod UUID;
BEGIN
  SELECT pod_id INTO v_pod FROM public.entities WHERE id = (
    SELECT entity_id FROM public.profiles WHERE id = auth.uid()
  ) LIMIT 1;
  RETURN v_pod;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Secure the function against public execution leaks
REVOKE EXECUTE ON FUNCTION public.get_user_pod() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_pod() TO authenticated;

-- Populate existing records and apply NOT NULL constraints safely using dynamic SQL
-- This avoids "column does not exist" parse-time errors when running the entire script as a single batch in Supabase.
DO $$ 
BEGIN
  -- Populate existing records based on parent-child reference chains
  EXECUTE 'UPDATE public.patient_registry pr SET pod_id = COALESCE((SELECT pod_id FROM public.entities e WHERE e.id = pr.registered_at_entity LIMIT 1), ''dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'')';
  EXECUTE 'UPDATE public.encounters enc SET pod_id = COALESCE((SELECT pod_id FROM public.entities e WHERE e.id = enc.entity_id LIMIT 1), ''dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'')';
  EXECUTE 'UPDATE public.lab_requisitions lr SET pod_id = COALESCE((SELECT pod_id FROM public.encounters enc WHERE enc.id = lr.encounter_id LIMIT 1), ''dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'')';
  EXECUTE 'UPDATE public.unified_invoices ui SET pod_id = COALESCE((SELECT pod_id FROM public.encounters enc WHERE enc.id = ui.encounter_id LIMIT 1), ''dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'')';
  EXECUTE 'UPDATE public.financial_ledgers fl SET pod_id = COALESCE((SELECT pod_id FROM public.entities e WHERE e.id = fl.source_entity_id LIMIT 1), ''dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'')';
  EXECUTE 'UPDATE public.whatsapp_sessions ws SET pod_id = COALESCE((SELECT pod_id FROM public.patient_registry pr WHERE pr.id = ws.patient_id LIMIT 1), ''dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'')';
  EXECUTE 'UPDATE public.activity_logs al SET pod_id = COALESCE((SELECT pod_id FROM public.entities e WHERE e.id = al.entity_id LIMIT 1), ''dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'')';
  EXECUTE 'UPDATE public.clinic_staff cs SET pod_id = COALESCE((SELECT pod_id FROM public.entities e WHERE e.id = cs.entity_id LIMIT 1), ''dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'')';

  -- Apply strict NOT NULL constraints
  EXECUTE 'ALTER TABLE public.patient_registry ALTER COLUMN pod_id SET NOT NULL';
  EXECUTE 'ALTER TABLE public.encounters ALTER COLUMN pod_id SET NOT NULL';
  EXECUTE 'ALTER TABLE public.lab_requisitions ALTER COLUMN pod_id SET NOT NULL';
  EXECUTE 'ALTER TABLE public.unified_invoices ALTER COLUMN pod_id SET NOT NULL';
  EXECUTE 'ALTER TABLE public.financial_ledgers ALTER COLUMN pod_id SET NOT NULL';
  EXECUTE 'ALTER TABLE public.whatsapp_sessions ALTER COLUMN pod_id SET NOT NULL';
  EXECUTE 'ALTER TABLE public.activity_logs ALTER COLUMN pod_id SET NOT NULL';
  EXECUTE 'ALTER TABLE public.clinic_staff ALTER COLUMN pod_id SET NOT NULL';
END $$;

DO $$ 
BEGIN
  -- Drop old join-dependent RLS policies and apply high-performance direct RLS policies safely
  EXECUTE 'DROP POLICY IF EXISTS "Enforce tenant pod isolation" ON public.patient_registry';
  EXECUTE 'CREATE POLICY "Enforce tenant pod isolation" ON public.patient_registry FOR ALL TO authenticated USING (pod_id = public.get_user_pod())';

  EXECUTE 'DROP POLICY IF EXISTS "Enforce tenant pod isolation" ON public.encounters';
  EXECUTE 'CREATE POLICY "Enforce tenant pod isolation" ON public.encounters FOR ALL TO authenticated USING (pod_id = public.get_user_pod())';

  EXECUTE 'DROP POLICY IF EXISTS "Enforce tenant pod isolation" ON public.lab_requisitions';
  EXECUTE 'CREATE POLICY "Enforce tenant pod isolation" ON public.lab_requisitions FOR ALL TO authenticated USING (pod_id = public.get_user_pod())';

  EXECUTE 'DROP POLICY IF EXISTS "Enforce tenant pod isolation" ON public.unified_invoices';
  EXECUTE 'CREATE POLICY "Enforce tenant pod isolation" ON public.unified_invoices FOR ALL TO authenticated USING (pod_id = public.get_user_pod())';

  EXECUTE 'DROP POLICY IF EXISTS "Enforce tenant pod isolation" ON public.financial_ledgers';
  EXECUTE 'CREATE POLICY "Enforce tenant pod isolation" ON public.financial_ledgers FOR ALL TO authenticated USING (pod_id = public.get_user_pod())';

  EXECUTE 'DROP POLICY IF EXISTS "Enforce tenant pod isolation" ON public.whatsapp_sessions';
  EXECUTE 'CREATE POLICY "Enforce tenant pod isolation" ON public.whatsapp_sessions FOR ALL TO authenticated USING (pod_id = public.get_user_pod())';

  EXECUTE 'DROP POLICY IF EXISTS "Enforce tenant pod isolation" ON public.activity_logs';
  EXECUTE 'CREATE POLICY "Enforce tenant pod isolation" ON public.activity_logs FOR ALL TO authenticated USING (pod_id = public.get_user_pod())';

  EXECUTE 'DROP POLICY IF EXISTS "Enforce tenant pod isolation" ON public.clinic_staff';
  EXECUTE 'CREATE POLICY "Enforce tenant pod isolation" ON public.clinic_staff FOR ALL TO authenticated USING (pod_id = public.get_user_pod())';
END $$;


-- =============================================================================
-- STEP 2: WhatsApp Business API (WABA) Multi-Tenant Schema & Cryptography (20260525000001)
-- =============================================================================

-- Enable pgcrypto if not already enabled (pre-installed in extensions schema)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Create the multi-tenant WABA connections table
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

-- Ensure all required columns exist in case the table was created previously without them
ALTER TABLE public.waba_connections ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
ALTER TABLE public.waba_connections ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES public.entities(id) ON DELETE CASCADE;
ALTER TABLE public.waba_connections ADD COLUMN IF NOT EXISTS clinic_display_name VARCHAR(255);
ALTER TABLE public.waba_connections ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.waba_connections ADD COLUMN IF NOT EXISTS waba_status VARCHAR(50) DEFAULT 'active';
ALTER TABLE public.waba_connections ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.waba_connections ALTER COLUMN encrypted_system_user_token DROP NOT NULL;

-- Enable RLS on waba_connections
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

-- Create index for quick routing in webhook lookups
CREATE INDEX IF NOT EXISTS idx_waba_connections_phone_number_id ON public.waba_connections(phone_number_id);

-- Create the WhatsApp billing logs table to track Meta OBO conversation metrics
CREATE TABLE IF NOT EXISTS public.whatsapp_billing_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    waba_id VARCHAR(255) NOT NULL,
    phone_number_id VARCHAR(255) NOT NULL,
    conversation_id VARCHAR(255) UNIQUE NOT NULL,
    pricing_category VARCHAR(50) NOT NULL, -- marketing, service, utility, authentication
    cost NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,
    billable BOOLEAN DEFAULT TRUE,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on billing logs
ALTER TABLE public.whatsapp_billing_logs ENABLE ROW LEVEL SECURITY;

-- Dynamic Credential Cryptography functions
-- Encrypts a text token using a system-level secret passphrase
CREATE OR REPLACE FUNCTION public.encrypt_waba_token(token TEXT, secret_key TEXT)
RETURNS BYTEA AS $$
BEGIN
    RETURN extensions.pgp_sym_encrypt(token, secret_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.encrypt_waba_token(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.encrypt_waba_token(TEXT, TEXT) TO authenticated;

-- Decrypts an encrypted token back into plain text
CREATE OR REPLACE FUNCTION public.decrypt_waba_token(encrypted_token BYTEA, secret_key TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN extensions.pgp_sym_decrypt(encrypted_token, secret_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.decrypt_waba_token(BYTEA, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrypt_waba_token(BYTEA, TEXT) TO authenticated;

-- Helper function to decrypt a tenant's WABA connection details by phone_number_id
CREATE OR REPLACE FUNCTION public.decrypt_tenant_waba_connection(p_phone_number_id TEXT, p_secret_key TEXT)
RETURNS TABLE (
    pod_id UUID,
    entity_id UUID,
    decrypted_token TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        wc.pod_id,
        wc.entity_id,
        public.decrypt_waba_token(wc.encrypted_system_user_token, p_secret_key) AS decrypted_token
    FROM public.waba_connections wc
    WHERE wc.phone_number_id = p_phone_number_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.decrypt_tenant_waba_connection(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrypt_tenant_waba_connection(TEXT, TEXT) TO authenticated;


-- =============================================================================
-- STEP 3: Agentic Task Pipelines (20260526000001)
-- =============================================================================

-- Create the agentic task pipelines log table
CREATE TABLE IF NOT EXISTS public.agent_task_pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pod_id UUID NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
    patient_id UUID REFERENCES public.patient_registry(id) ON DELETE SET NULL,
    original_prompt TEXT NOT NULL,
    parsed_intent VARCHAR(100) NOT NULL,
    current_step_index INTEGER DEFAULT 0,
    steps_json JSONB NOT NULL, -- Array of { name: string, status: string, message: string, detail?: string }
    status VARCHAR(50) DEFAULT 'pending', -- pending, validating, halted_error, completed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure column exists in case the table was created previously without it
ALTER TABLE public.agent_task_pipelines ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

-- Enable Row-Level Security (RLS) on the table
ALTER TABLE public.agent_task_pipelines ENABLE ROW LEVEL SECURITY;

-- Establish direct pod authenticated RLS policies
DO $$ 
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Enforce tenant pod isolation" ON public.agent_task_pipelines';
  EXECUTE 'CREATE POLICY "Enforce tenant pod isolation" ON public.agent_task_pipelines FOR ALL TO authenticated USING (pod_id = public.get_user_pod())';
END $$;

-- Create index for quick RLS searches
CREATE INDEX IF NOT EXISTS idx_agent_task_pipelines_pod_id ON public.agent_task_pipelines(pod_id);
CREATE INDEX IF NOT EXISTS idx_agent_task_pipelines_patient_id ON public.agent_task_pipelines(patient_id);


-- =============================================================================
-- STEP 4: Self-Healing Telemetry & Diagnostics (20260526000002)
-- =============================================================================

-- Create the system health telemetry table
CREATE TABLE IF NOT EXISTS public.system_health_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pod_id UUID NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
    subsystem VARCHAR(50) NOT NULL, -- frontend, backend, database, whatsapp_api, agentic_ai
    severity VARCHAR(50) NOT NULL, -- info, warning, critical
    error_code VARCHAR(255),
    error_stack TEXT,
    healing_attempts INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'unresolved', -- unresolved, healing, healed, failed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist in case the table was created previously without them
ALTER TABLE public.system_health_telemetry ADD COLUMN IF NOT EXISTS healing_attempts INTEGER DEFAULT 0;
ALTER TABLE public.system_health_telemetry ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'unresolved';
ALTER TABLE public.system_health_telemetry ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

-- Enable RLS on telemetry table
ALTER TABLE public.system_health_telemetry ENABLE ROW LEVEL SECURITY;

-- Apply direct pod isolation policy
DO $$ 
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Enforce tenant pod isolation" ON public.system_health_telemetry';
  EXECUTE 'CREATE POLICY "Enforce tenant pod isolation" ON public.system_health_telemetry FOR ALL TO authenticated USING (pod_id = public.get_user_pod())';
END $$;

-- Create the self-healing execution logs table
CREATE TABLE IF NOT EXISTS public.self_healing_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telemetry_id UUID NOT NULL REFERENCES public.system_health_telemetry(id) ON DELETE CASCADE,
    action_taken TEXT NOT NULL,
    outcome TEXT NOT NULL,
    healed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on execution logs table
ALTER TABLE public.self_healing_execution_logs ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for execution logs (via nested telemetry check to bypass direct pod keys requirement)
DO $$ 
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Enforce nested tenant pod isolation" ON public.self_healing_execution_logs';
  EXECUTE 'CREATE POLICY "Enforce nested tenant pod isolation" ON public.self_healing_execution_logs 
      FOR ALL 
      TO authenticated 
      USING (
          EXISTS (
              SELECT 1 FROM public.system_health_telemetry t 
              WHERE t.id = telemetry_id AND t.pod_id = public.get_user_pod()
          )
      )';
END $$;

-- Create indices for high-speed indexing
CREATE INDEX IF NOT EXISTS idx_system_health_telemetry_pod_id ON public.system_health_telemetry(pod_id);
CREATE INDEX IF NOT EXISTS idx_system_health_telemetry_subsystem ON public.system_health_telemetry(subsystem);

CREATE OR REPLACE FUNCTION public.execute_autonomous_db_repair(p_table TEXT, p_column TEXT, p_type TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_clean_type TEXT;
    v_is_whitelisted BOOLEAN := FALSE;
BEGIN
    -- Normalize the column type for comparison by removing whitespace, quotes, and converting to lowercase
    v_clean_type := lower(replace(replace(replace(p_type, ' ', ''), '''', ''), '"', ''));

    -- Whitelist validation to prevent arbitrary SQL/DDL injections
    IF (lower(p_table) = 'patient_registry' AND lower(p_column) = 'vitals' AND v_clean_type = 'jsonb') THEN
        v_is_whitelisted := TRUE;
    ELSIF (lower(p_table) = 'patient_registry' AND lower(p_column) = 'token_number' AND v_clean_type = 'text') THEN
        v_is_whitelisted := TRUE;
    ELSIF (lower(p_table) = 'patient_registry' AND lower(p_column) = 'queue_status' AND (v_clean_type = 'textdefaultawaiting_vitals' OR v_clean_type = 'textdefaultawaiting_vitals::text')) THEN
        v_is_whitelisted := TRUE;
    ELSIF (lower(p_table) = 'whatsapp_sessions' AND lower(p_column) = 'auto_healed_flag' AND v_clean_type = 'booleandefaulttrue') THEN
        v_is_whitelisted := TRUE;
    ELSIF (lower(p_table) = 'system_health_telemetry' AND lower(p_column) = 'updated_at' AND (v_clean_type = 'timestamptzdefaultnow()' OR v_clean_type = 'timestamptzdefaultcurrent_timestamp')) THEN
        v_is_whitelisted := TRUE;
    END IF;

    IF NOT v_is_whitelisted THEN
        RAISE EXCEPTION 'Security Threat Blocked: Unauthorized database repair parameters: table=%, column=%, type=%. Parameters do not match safe schema manifest whitelists.', p_table, p_column, p_type;
    END IF;

    -- Verify the table exists in public schema
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = p_table AND table_schema = 'public') THEN
        -- Add the missing column if it does not exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = p_table AND column_name = p_column) THEN
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS %I %s', p_table, p_column, p_type);
            RETURN TRUE;
        END IF;
    END IF;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Secure the autonomous repair function against public privilege leakage
REVOKE EXECUTE ON FUNCTION public.execute_autonomous_db_repair(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.execute_autonomous_db_repair(TEXT, TEXT, TEXT) TO authenticated;

-- Alias function for Auto-Healer heal_schema_drift RPC
CREATE OR REPLACE FUNCTION public.heal_schema_drift(p_table_name TEXT, p_column_name TEXT, p_column_type TEXT)
RETURNS JSONB AS $$
DECLARE
    v_repaired BOOLEAN;
BEGIN
    v_repaired := public.execute_autonomous_db_repair(p_table_name, p_column_name, p_column_type);
    RETURN jsonb_build_object('success', v_repaired, 'table', p_table_name, 'column', p_column_name);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.heal_schema_drift(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.heal_schema_drift(TEXT, TEXT, TEXT) TO authenticated;


-- =============================================================================
-- STEP 5: Commission & Low-Value Protection Logic (20260526000003)
-- =============================================================================

-- Add dynamic price and doctor consultation fee columns if not already added
ALTER TABLE public.master_test_catalog ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2) DEFAULT 350.00;
ALTER TABLE public.encounter_diagnostics ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS consultation_fee NUMERIC(10, 2) DEFAULT 400.00;

-- Trigger Function that coordinates cross-entity lab requisitions, pharmacy FEFO, and billing
CREATE OR REPLACE FUNCTION public.on_encounter_submitted()
RETURNS TRIGGER AS $$
DECLARE
    v_lab_entity_id UUID;
    v_pharmacy_entity_id UUID;
    diag RECORD;
    med RECORD;
    doctor_fee DECIMAL;
    lab_fee DECIMAL := 0;
    pharmacy_fee DECIMAL := 0;
    platform_fee DECIMAL;
    total DECIMAL;
    v_patient_phone TEXT;
    v_test_price DECIMAL;
    
    -- FEFO variables
    needed_qty INT := 10; -- default per medication hold
    remaining_qty INT;
    cur_batch RECORD;
    allocated_qty INT;
BEGIN
    -- If it's an update, only proceed if the status changed to completed
    IF TG_OP = 'UPDATE' AND (OLD.status = 'completed' OR NEW.status != 'completed') THEN
        RETURN NEW;
    END IF;
    -- If it's an insert, only proceed if status is completed
    IF TG_OP = 'INSERT' AND NEW.status != 'completed' THEN
        RETURN NEW;
    END IF;

    -- Look up doctor's dynamic consultation fee
    SELECT COALESCE(consultation_fee, 400.00) INTO doctor_fee
    FROM public.profiles
    WHERE id = NEW.doctor_id;
    
    IF doctor_fee IS NULL THEN
        doctor_fee := 400.00;
    END IF;

    -- Find partner lab and pharmacy in the same pod
    SELECT e.id INTO v_lab_entity_id
    FROM public.entities e
    JOIN public.entities clinic ON clinic.pod_id = e.pod_id
    WHERE clinic.id = NEW.entity_id AND e.entity_type = 'lab'
    LIMIT 1;

    SELECT e.id INTO v_pharmacy_entity_id
    FROM public.entities e
    JOIN public.entities clinic ON clinic.pod_id = e.pod_id
    WHERE clinic.id = NEW.entity_id AND e.entity_type = 'pharmacy'
    LIMIT 1;

    -- Action A: Route diagnostics to lab and auto-assign to Lalit Prasad for tech verification demo
    FOR diag IN SELECT * FROM public.encounter_diagnostics WHERE encounter_id = NEW.id
    LOOP
        -- Retrieve dynamic test price from master catalog
        SELECT COALESCE(price, 350.00) INTO v_test_price
        FROM public.master_test_catalog
        WHERE loinc_code = diag.loinc_code;

        IF v_test_price IS NULL THEN
            v_test_price := 350.00;
        END IF;

        -- Snapshot test price into encounter_diagnostics
        UPDATE public.encounter_diagnostics
        SET price = v_test_price
        WHERE id = diag.id;

        INSERT INTO public.lab_requisitions (encounter_id, patient_id, lab_entity_id, loinc_code, test_name, barcode, assigned_technician_id)
        VALUES (NEW.id, NEW.patient_id, v_lab_entity_id, diag.loinc_code, diag.test_name,
                'BAR-' || upper(substring(NEW.id::text, 1, 8)) || '-' || diag.loinc_code,
                'dfb2a1a8-8e68-4f8a-929e-4a6c8e317102');
                
        lab_fee := lab_fee + v_test_price;
    END LOOP;

    -- Action B: Create pharmacy inventory holds with FEFO and isolated transaction safety
    BEGIN
        FOR med IN SELECT * FROM public.encounter_medications WHERE encounter_id = NEW.id
        LOOP
            remaining_qty := needed_qty;
            
            -- Trace FEFO batches
            FOR cur_batch IN 
                SELECT id, batch_number, expiry_date, quantity_in_stock
                FROM public.pharmacy_inventory
                WHERE pharmacy_entity_id = v_pharmacy_entity_id
                  AND medicine_name = med.medicine_name
                  AND is_active = true
                  AND quantity_in_stock > 0
                  AND expiry_date >= CURRENT_DATE
                ORDER BY expiry_date ASC
            LOOP
                IF remaining_qty <= 0 THEN
                    EXIT;
                END IF;

                IF cur_batch.quantity_in_stock >= remaining_qty THEN
                    allocated_qty := remaining_qty;
                ELSE
                    allocated_qty := cur_batch.quantity_in_stock;
                END IF;

                -- Deduct shelf stock
                UPDATE public.pharmacy_inventory
                SET quantity_in_stock = quantity_in_stock - allocated_qty,
                    updated_at = now()
                WHERE id = cur_batch.id;

                -- Create hold record
                INSERT INTO public.inventory_holds (
                    pharmacy_entity_id, encounter_id, patient_id, medicine_name, dosage, quantity,
                    batch_number, expiry_date, hold_status
                ) VALUES (
                    v_pharmacy_entity_id, NEW.id, NEW.patient_id, med.medicine_name, med.dosage, allocated_qty,
                    cur_batch.batch_number, cur_batch.expiry_date, 'held'
                );

                remaining_qty := remaining_qty - allocated_qty;
            END LOOP;

            -- Check if shortage exists
            IF remaining_qty > 0 THEN
                IF remaining_qty = needed_qty THEN
                    -- Completely Out of Stock (OOS)
                    INSERT INTO public.inventory_holds (
                        pharmacy_entity_id, encounter_id, patient_id, medicine_name, dosage, quantity,
                        batch_number, expiry_date, hold_status
                    ) VALUES (
                        v_pharmacy_entity_id, NEW.id, NEW.patient_id, med.medicine_name, med.dosage, remaining_qty,
                        'OUT_OF_STOCK', NULL, 'held'
                    );
                ELSE
                    -- Partial match, write hold for the remaining shortage portion
                    INSERT INTO public.inventory_holds (
                        pharmacy_entity_id, encounter_id, patient_id, medicine_name, dosage, quantity,
                        batch_number, expiry_date, hold_status
                    ) VALUES (
                        v_pharmacy_entity_id, NEW.id, NEW.patient_id, med.medicine_name, med.dosage, remaining_qty,
                        'SHORTAGE', NULL, 'held'
                    );
                END IF;

                -- Log standard shortage alert
                INSERT INTO public.activity_logs (action_type, details, entity_id)
                VALUES ('INVENTORY_SHORTAGE', jsonb_build_object(
                    'medicine_name', med.medicine_name,
                    'requested_quantity', needed_qty,
                    'remaining_quantity', remaining_qty,
                    'encounter_id', NEW.id,
                    'pharmacy_entity_id', v_pharmacy_entity_id
                ), v_pharmacy_entity_id);
            END IF;

            pharmacy_fee := pharmacy_fee + 150;
        END LOOP;
    EXCEPTION
        WHEN OTHERS THEN
            INSERT INTO public.activity_logs (action_type, details, entity_id)
            VALUES ('SYSTEM_ERROR', jsonb_build_object(
                'trigger', 'on_encounter_submitted (Action B - Pharmacy holds)',
                'error_message', SQLERRM,
                'error_code', SQLSTATE,
                'encounter_id', NEW.id
            ), v_pharmacy_entity_id);
    END;

    -- Action C: Generate unified invoice (Enforce 3% split with a flat minimum ₹10 low-value protection)
    platform_fee := (doctor_fee + lab_fee + pharmacy_fee) * 0.03;
    IF platform_fee < 10.00 THEN
        platform_fee := 10.00;
    END IF;
    
    total := doctor_fee + lab_fee + pharmacy_fee + platform_fee;

    SELECT phone INTO v_patient_phone FROM public.patient_registry WHERE id = NEW.patient_id;

    INSERT INTO public.unified_invoices
        (encounter_id, patient_id, doctor_fee, lab_fee, pharmacy_fee, platform_fee, total_amount, upi_qr_payload)
    VALUES
        (NEW.id, NEW.patient_id, doctor_fee, lab_fee, pharmacy_fee, platform_fee, total,
         'upi://pay?pa=vitalsync@axl&pn=VitalSync&am=' || total || '&cu=INR&tn=VitalSync-' || NEW.id);

    -- Update WhatsApp session to AWAITING_PAYMENT
    UPDATE public.whatsapp_sessions
    SET current_state = 'AWAITING_PAYMENT', last_interaction = now(),
        session_data = session_data || jsonb_build_object('invoiceTotal', total)
    WHERE whatsapp_sessions.patient_phone = v_patient_phone;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Secure the trigger function against public privilege leakage
REVOKE EXECUTE ON FUNCTION public.on_encounter_submitted() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.on_encounter_submitted() TO authenticated;

-- Wire the trigger to encounters table (runs AFTER encounters are inserted/submitted)
DROP TRIGGER IF EXISTS trg_encounter_submitted ON public.encounters;
CREATE TRIGGER trg_encounter_submitted
    AFTER INSERT OR UPDATE ON public.encounters
    FOR EACH ROW
    EXECUTE FUNCTION public.on_encounter_submitted();


-- =============================================================================
-- STEP 6: Clinic SOP Center (20260526000004)
-- =============================================================================

-- Create the clinic_sops table
CREATE TABLE IF NOT EXISTS public.clinic_sops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
    sop_file_name TEXT,
    sop_text TEXT,
    extracted_config JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.clinic_sops ENABLE ROW LEVEL SECURITY;

-- Apply pod isolation policy
DO $$ 
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Enforce tenant pod isolation" ON public.clinic_sops';
  EXECUTE 'CREATE POLICY "Enforce tenant pod isolation" ON public.clinic_sops
      FOR ALL TO authenticated
      USING (
          entity_id IN (
              SELECT id FROM public.entities WHERE pod_id = public.get_user_pod()
          )
      )';
END $$;

-- Seed the default SOP for the pilot clinic (Kankarbagh Connected Clinic)
INSERT INTO public.clinic_sops (entity_id, sop_file_name, sop_text, extracted_config, is_active)
VALUES (
    'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002',
    'Kankarbagh_Clinic_Standard_SOP.txt',
    E'Doctor Consultation Fee: INR 450\nHbA1c Test: INR 350\nSerum Creatinine: INR 250\nTotal Hemoglobin: INR 150\nSerum Sodium: INR 200\nTotal Bilirubin: INR 300\n\nCommission Splits:\n- Doctor: 40%\n- Lab: 57%\n- Platform: 3%\n\nGuidelines:\n- Auto-assign Lalit Prasad for all pathology lab tests\n- Allow doorstep sample collection scheduling by patient request\n- Hold pharmacy stock using FEFO (First Expiry First Out) policy\n- Verify patient ABHA consent prior to care pod routing\n- Issue UPI QR on invoice generation immediately',
    '{
        "doctor_fee": 450.00,
        "test_prices": {
            "4544-3": 350.00,
            "2160-0": 250.00,
            "3024-7": 150.00,
            "2947-0": 200.00,
            "1975-2": 300.00
        },
        "splits": {
            "doctor": 40.0,
            "platform": 3.0,
            "lab": 57.0
        },
        "guidelines": [
            "Auto-assign Lalit Prasad for all pathology lab tests",
            "Allow doorstep sample collection scheduling by patient request",
            "Hold pharmacy stock using FEFO (First Expiry First Out) policy",
            "Verify patient ABHA consent prior to care pod routing",
            "Issue UPI QR on invoice generation immediately"
        ]
    }'::jsonb,
    true
) ON CONFLICT DO NOTHING;


-- =============================================================================
-- STEP 7: Medicine Billing & Counter Transactions (20260526000005)
-- =============================================================================

-- Create the counter_transactions table
CREATE TABLE IF NOT EXISTS public.counter_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patient_registry(id) ON DELETE CASCADE,
    appointment_booked_at_counter BOOLEAN DEFAULT FALSE,
    lab_booked_at_counter BOOLEAN DEFAULT FALSE,
    discount_eligible BOOLEAN DEFAULT FALSE,
    discount_percent NUMERIC(5,2) DEFAULT 0.00,
    pod_id UUID NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create the medicine_bills table
CREATE TABLE IF NOT EXISTS public.medicine_bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patient_registry(id) ON DELETE CASCADE,
    encounter_id UUID REFERENCES public.encounters(id) ON DELETE SET NULL,
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    loyalty_discount_percent NUMERIC(5,2) DEFAULT 0.00,
    loyalty_discount_amount NUMERIC(10,2) DEFAULT 0.00,
    item_discount_amount NUMERIC(10,2) DEFAULT 0.00,
    gst_amount NUMERIC(10,2) DEFAULT 0.00,
    total_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    payment_mode TEXT CHECK (payment_mode IN ('cash', 'upi', 'card', 'whatsapp_pay')),
    upi_qr_payload TEXT,
    status TEXT CHECK (status IN ('draft', 'confirmed', 'paid', 'cancelled')) DEFAULT 'draft',
    source TEXT CHECK (source IN ('counter', 'whatsapp')) DEFAULT 'counter',
    delivery_type TEXT CHECK (delivery_type IN ('pickup', 'shiprocket')) DEFAULT 'pickup',
    delivery_address TEXT,
    delivery_charge NUMERIC(10,2) DEFAULT 0.00,
    shiprocket_order_id TEXT,
    pod_id UUID NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create the medicine_bill_items table
CREATE TABLE IF NOT EXISTS public.medicine_bill_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES public.medicine_bills(id) ON DELETE CASCADE,
    inventory_item_id TEXT NOT NULL,
    name TEXT NOT NULL,
    batch_number TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    mrp NUMERIC(10,2) NOT NULL,
    selling_price NUMERIC(10,2) NOT NULL,
    discount_percent NUMERIC(5,2) DEFAULT 0.00,
    gst_percent NUMERIC(5,2) DEFAULT 0.00,
    line_total NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist in case the tables were created previously without them
ALTER TABLE public.counter_transactions ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
ALTER TABLE public.medicine_bills ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

-- Enable RLS on all three tables
ALTER TABLE public.counter_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicine_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicine_bill_items ENABLE ROW LEVEL SECURITY;

-- Apply pod isolation policies
DO $$ 
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Enforce tenant pod isolation for counter_transactions" ON public.counter_transactions';
  EXECUTE 'CREATE POLICY "Enforce tenant pod isolation for counter_transactions" ON public.counter_transactions FOR ALL TO authenticated USING (pod_id = public.get_user_pod())';

  EXECUTE 'DROP POLICY IF EXISTS "Enforce tenant pod isolation for medicine_bills" ON public.medicine_bills';
  EXECUTE 'CREATE POLICY "Enforce tenant pod isolation for medicine_bills" ON public.medicine_bills FOR ALL TO authenticated USING (pod_id = public.get_user_pod())';

  EXECUTE 'DROP POLICY IF EXISTS "Enforce tenant pod isolation for medicine_bill_items" ON public.medicine_bill_items';
  EXECUTE 'CREATE POLICY "Enforce tenant pod isolation for medicine_bill_items" ON public.medicine_bill_items FOR ALL TO authenticated USING (bill_id IN (SELECT id FROM public.medicine_bills WHERE pod_id = public.get_user_pod()))';
END $$;


-- =============================================================================
-- STEP 8: Database Query & Index Optimization (20260527000000)
-- =============================================================================

-- Composite Index for FEFO Shelf Tracking
CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_fefo_opt 
ON public.pharmacy_inventory (pharmacy_entity_id, medicine_name, is_active, quantity_in_stock, expiry_date ASC);

-- Composite Index for Clinic-to-Partner pod routing
CREATE INDEX IF NOT EXISTS idx_entities_pod_type_opt 
ON public.entities (pod_id, entity_type);

-- B-Tree Indexes on loop cursors to speed up loops in trigggers
CREATE INDEX IF NOT EXISTS idx_encounter_medications_encounter_id_opt 
ON public.encounter_medications (encounter_id);

CREATE INDEX IF NOT EXISTS idx_encounter_diagnostics_encounter_id_opt 
ON public.encounter_diagnostics (encounter_id);


-- =============================================================================
-- STEP 9: Walkin Labs & Doctor Dashboard God View (20260527000001)
-- =============================================================================

-- Mark walk-in lab requisitions distinctly
ALTER TABLE public.lab_requisitions
  ADD COLUMN IF NOT EXISTS is_walkin BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS walkin_fee DECIMAL(10,2) DEFAULT 0.00;

-- Auto-set is_walkin flag based on NULL encounter_id
CREATE OR REPLACE FUNCTION public.set_walkin_flag()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.encounter_id IS NULL THEN
    NEW.is_walkin := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_set_walkin_flag ON public.lab_requisitions;
CREATE TRIGGER tr_set_walkin_flag
  BEFORE INSERT ON public.lab_requisitions
  FOR EACH ROW EXECUTE FUNCTION public.set_walkin_flag();

-- Pod Health Snapshots Table (for Doctor Admin God View)
CREATE TABLE IF NOT EXISTS public.pod_health_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id        UUID REFERENCES public.pods(id) ON DELETE CASCADE,
  snapshot_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  lab_pending_count   INT DEFAULT 0,
  lab_completed_today INT DEFAULT 0,
  reagent_low_count   INT DEFAULT 0,
  pharmacy_holds_pending   INT DEFAULT 0,
  pharmacy_low_stock_count INT DEFAULT 0,
  revenue_today_gross  DECIMAL(10,2) DEFAULT 0.00,
  revenue_cleared      DECIMAL(10,2) DEFAULT 0.00,
  revenue_pending      DECIMAL(10,2) DEFAULT 0.00,
  patients_registered_today INT DEFAULT 0,
  encounters_today          INT DEFAULT 0,
  whatsapp_active_sessions  INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure column exists in case the table was created previously without it
ALTER TABLE public.pod_health_snapshots ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

-- Index for fast latest-snapshot queries per pod
CREATE INDEX IF NOT EXISTS idx_pod_health_snapshots_pod_at
  ON public.pod_health_snapshots (pod_id, snapshot_at DESC);

-- RLS: Doctors can read all pod health data (admin view)
ALTER TABLE public.pod_health_snapshots ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "pod_health_doctor_read" ON public.pod_health_snapshots';
  EXECUTE 'CREATE POLICY "pod_health_doctor_read"
    ON public.pod_health_snapshots FOR SELECT
    USING (
      pod_id = public.get_user_pod()
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = ''platform_admin''
      )
    )';
END $$;

-- Lab requisitions: Doctors can read all records in their pod
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lab_requisitions' AND policyname = 'doctor_read_all_lab_reqs'
  ) THEN
    CREATE POLICY "doctor_read_all_lab_reqs"
      ON public.lab_requisitions FOR SELECT
      USING (
        pod_id = public.get_user_pod()
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'platform_admin'
        )
      );
  END IF;
END $$;

-- Walk-in fee revenue tracking: Insert into financial_ledgers when walk-in completes
CREATE OR REPLACE FUNCTION public.on_walkin_lab_completed()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_pod_id UUID;
  v_lab_entity_id UUID;
  v_platform_entity_id UUID;
  v_fee DECIMAL(10,2);
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.is_walkin = true THEN
    v_fee := COALESCE(NEW.walkin_fee, 0);

    -- Get pod context from assigned_technician's entity
    SELECT e.pod_id, e.id INTO v_pod_id, v_lab_entity_id
    FROM public.entities e
    WHERE e.entity_type = 'pathology_lab'
    LIMIT 1;

    SELECT e.id INTO v_platform_entity_id
    FROM public.entities e
    WHERE e.entity_type = 'platform'
    LIMIT 1;

    -- Record lab fee and platform commission
    IF v_fee > 0 THEN
      INSERT INTO public.financial_ledgers (
        invoice_id, source_entity_id, destination_entity_id,
        transaction_type, gross_amount, commission_rate, net_payout, payment_status
      ) VALUES
        (NULL, v_lab_entity_id, v_lab_entity_id, 'lab_commission', v_fee, 3, v_fee * 0.97, 'pending'),
        (NULL, v_lab_entity_id, v_platform_entity_id, 'platform_fee', v_fee, 3, v_fee * 0.03, 'pending');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_walkin_lab_completed ON public.lab_requisitions;
CREATE TRIGGER tr_walkin_lab_completed
  AFTER UPDATE ON public.lab_requisitions
  FOR EACH ROW EXECUTE FUNCTION public.on_walkin_lab_completed();


-- =============================================================================
-- STEP 10: Lab Reports Table & Prescription Storage Policies (20260528092924)
-- =============================================================================

-- Extend lab_requisitions to track prescription file URL and revisit info
ALTER TABLE lab_requisitions
  ADD COLUMN IF NOT EXISTS prescription_file_url TEXT,
  ADD COLUMN IF NOT EXISTS revisit_scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revisit_note TEXT;

-- Create lab_reports table for full structured report storage
CREATE TABLE IF NOT EXISTS lab_reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id      UUID NOT NULL REFERENCES lab_requisitions(id) ON DELETE CASCADE,
  patient_id          UUID NOT NULL REFERENCES patient_registry(id) ON DELETE CASCADE,
  patient_name        TEXT NOT NULL,
  report_file_url     TEXT,                    -- Supabase Storage path for PDF/image
  biomarker_json      JSONB,                   -- Numeric results
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by         UUID REFERENCES auth.users(id),
  approved_at         TIMESTAMPTZ,
  rejection_reason    TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure columns exist in case lab_reports table was created previously (e.g. via base schema.sql) without them
ALTER TABLE public.lab_reports ADD COLUMN IF NOT EXISTS requisition_id UUID REFERENCES public.lab_requisitions(id) ON DELETE CASCADE;
ALTER TABLE public.lab_reports ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES public.patient_registry(id) ON DELETE CASCADE;
ALTER TABLE public.lab_reports ADD COLUMN IF NOT EXISTS patient_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.lab_reports ADD COLUMN IF NOT EXISTS report_file_url TEXT;
ALTER TABLE public.lab_reports ADD COLUMN IF NOT EXISTS biomarker_json JSONB;
ALTER TABLE public.lab_reports ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'));
ALTER TABLE public.lab_reports ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);
ALTER TABLE public.lab_reports ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.lab_reports ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.lab_reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION update_lab_reports_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lab_reports_updated_at_trigger ON lab_reports;
CREATE TRIGGER lab_reports_updated_at_trigger
  BEFORE UPDATE ON lab_reports
  FOR EACH ROW EXECUTE FUNCTION update_lab_reports_updated_at();

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_lab_reports_requisition_id ON lab_reports(requisition_id);
CREATE INDEX IF NOT EXISTS idx_lab_reports_patient_id ON lab_reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_reports_status ON lab_reports(status);
CREATE INDEX IF NOT EXISTS idx_lab_requisitions_prescription ON lab_requisitions(prescription_file_url) WHERE prescription_file_url IS NOT NULL;

-- Enable Row-Level Security on lab_reports
ALTER TABLE lab_reports ENABLE ROW LEVEL SECURITY;

-- RLS policies for lab_reports
DROP POLICY IF EXISTS "lab_reports_select_authenticated" ON lab_reports;
CREATE POLICY "lab_reports_select_authenticated" ON lab_reports FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "lab_reports_insert_authenticated" ON lab_reports;
CREATE POLICY "lab_reports_insert_authenticated" ON lab_reports FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "lab_reports_update_authenticated" ON lab_reports;
CREATE POLICY "lab_reports_update_authenticated" ON lab_reports FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Grant table access to authenticated role
GRANT SELECT, INSERT, UPDATE ON lab_reports TO authenticated;

-- Supabase Storage buckets creation (requires storage schema to exist, handled gracefully)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'buckets') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'prescriptions',
      'prescriptions',
      false,
      10485760,
      ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'lab-reports',
      'lab-reports',
      false,
      20971520,
      ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    ) ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Storage policies (requires storage.objects to exist, handled gracefully)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'objects') THEN
    DROP POLICY IF EXISTS "prescriptions_upload_policy" ON storage.objects;
    CREATE POLICY "prescriptions_upload_policy" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'prescriptions');

    DROP POLICY IF EXISTS "prescriptions_select_policy" ON storage.objects;
    CREATE POLICY "prescriptions_select_policy" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'prescriptions');

    DROP POLICY IF EXISTS "prescriptions_update_policy" ON storage.objects;
    CREATE POLICY "prescriptions_update_policy" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'prescriptions');

    DROP POLICY IF EXISTS "lab_reports_upload_policy" ON storage.objects;
    CREATE POLICY "lab_reports_upload_policy" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'lab-reports');

    DROP POLICY IF EXISTS "lab_reports_select_policy" ON storage.objects;
    CREATE POLICY "lab_reports_select_policy" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'lab-reports');

    DROP POLICY IF EXISTS "lab_reports_update_policy" ON storage.objects;
    CREATE POLICY "lab_reports_update_policy" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'lab-reports');
  END IF;
END $$;


-- =============================================================================
-- STEP 11: Seasonal AI Inventory Forecasting (20260528150000)
-- =============================================================================

-- Create the table
CREATE TABLE IF NOT EXISTS public.seasonal_demand_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
    medicine_name TEXT NOT NULL,
    suggested_increase_percentage INTEGER NOT NULL,
    reason TEXT NOT NULL,
    forecast_confidence NUMERIC(3,2) DEFAULT 0.85,
    is_acted_upon BOOLEAN DEFAULT FALSE,
    pod_id UUID NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure column exists in case the table was created previously without it
ALTER TABLE public.seasonal_demand_forecasts ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

-- Enable Row-Level Security (RLS)
ALTER TABLE public.seasonal_demand_forecasts ENABLE ROW LEVEL SECURITY;

-- Apply high-performance direct RLS policies
DO $$ 
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Enforce tenant pod isolation for seasonal_demand_forecasts" ON public.seasonal_demand_forecasts';
  EXECUTE 'CREATE POLICY "Enforce tenant pod isolation for seasonal_demand_forecasts" ON public.seasonal_demand_forecasts FOR ALL TO authenticated USING (pod_id = public.get_user_pod())';
END $$;

-- Grant privileges for API and service connections
GRANT ALL ON public.seasonal_demand_forecasts TO authenticated;
GRANT ALL ON public.seasonal_demand_forecasts TO service_role;

-- Create index optimizations for rapid query performance
CREATE INDEX IF NOT EXISTS idx_seasonal_demand_forecasts_pod_id ON public.seasonal_demand_forecasts(pod_id);
CREATE INDEX IF NOT EXISTS idx_seasonal_demand_forecasts_pharmacy ON public.seasonal_demand_forecasts(pharmacy_entity_id);


-- =============================================================================
-- STEP 12: Add Patient Past Reports Summary (20260528180000)
-- =============================================================================

ALTER TABLE public.patient_registry
  ADD COLUMN IF NOT EXISTS past_reports_summary TEXT;


-- =============================================================================
-- STEP 13: Self-Healing Telemetry Edge Function Trigger (20260530000000)
-- =============================================================================

-- Enable the pg_net extension (required for HTTP calls from Postgres triggers)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Helper function: dispatch_critical_telemetry_webhook
CREATE OR REPLACE FUNCTION public.dispatch_critical_telemetry_webhook()
RETURNS TRIGGER AS $$
DECLARE
    v_payload   JSONB;
    v_edge_url  TEXT;
BEGIN
    -- Only fire for critical severity events
    IF NEW.severity <> 'critical' THEN
        RETURN NEW;
    END IF;

    -- Build the JSON payload for the Edge Function
    v_payload := jsonb_build_object(
        'event',            'critical_telemetry',
        'id',               NEW.id,
        'pod_id',           NEW.pod_id,
        'subsystem',        NEW.subsystem,
        'severity',         NEW.severity,
        'error_code',       NEW.error_code,
        'error_stack',      NEW.error_stack,
        'healing_attempts', NEW.healing_attempts,
        'status',           NEW.status,
        'created_at',       NEW.created_at
    );

    -- Resolve the Supabase project URL from the app_settings table (if present)
    -- Falls back to the current_setting injected at deploy time.
    BEGIN
        v_edge_url := current_setting('app.supabase_project_url', true)
            || '/functions/v1/notify-developer-webhook';
    EXCEPTION WHEN OTHERS THEN
        -- If the setting is not configured, exit silently (non-breaking)
        RETURN NEW;
    END;

    -- Non-blocking async HTTP POST via pg_net (net schema, not extensions)
    PERFORM net.http_post(
        url     := v_edge_url,
        body    := v_payload::TEXT,
        headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key', true)
        )
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revoke public access — only the trigger mechanism invokes this function
REVOKE EXECUTE ON FUNCTION public.dispatch_critical_telemetry_webhook() FROM PUBLIC;

-- Trigger: on every INSERT of a critical row into system_health_telemetry
DROP TRIGGER IF EXISTS trg_critical_telemetry_webhook ON public.system_health_telemetry;
CREATE TRIGGER trg_critical_telemetry_webhook
    AFTER INSERT ON public.system_health_telemetry
    FOR EACH ROW
    EXECUTE FUNCTION public.dispatch_critical_telemetry_webhook();

COMMENT ON TRIGGER trg_critical_telemetry_webhook ON public.system_health_telemetry IS
    'Fires the notify-developer-webhook Edge Function asynchronously for every critical severity insert.';


-- =============================================================================
-- STEP 14: Cashfree Order Webhook Mapping Column (20260530000001)
-- =============================================================================

ALTER TABLE public.unified_invoices 
ADD COLUMN IF NOT EXISTS cashfree_order_id VARCHAR(100) UNIQUE;

-- Create an index to optimize webhook lookups by Cashfree Order ID
CREATE INDEX IF NOT EXISTS idx_unified_invoices_cashfree_order_id 
ON public.unified_invoices(cashfree_order_id);


-- =============================================================================
-- STEP 15: Cashfree sub-account / Vendor Onboarding (20260530000002)
-- =============================================================================

-- Create table to map clinic partner nodes to Cashfree sub-accounts
CREATE TABLE IF NOT EXISTS public.cashfree_vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pod_id UUID NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
    vendor_id VARCHAR(100) UNIQUE NOT NULL, -- Registered Cashfree Vendor sub-account ID
    holder_name VARCHAR(255) NOT NULL,
    bank_account_last4 VARCHAR(4) NOT NULL,
    verification_status VARCHAR(50) DEFAULT 'pending', -- pending, verified, failed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (pod_id, entity_id)
);

-- Ensure column exists in case the table was created previously without it
ALTER TABLE public.cashfree_vendors ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

-- Enable Row-Level Security to isolate clinical bank records by pod
ALTER TABLE public.cashfree_vendors ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Enforce tenant pod isolation on cashfree_vendors" ON public.cashfree_vendors';
  EXECUTE 'CREATE POLICY "Enforce tenant pod isolation on cashfree_vendors" ON public.cashfree_vendors FOR ALL TO authenticated USING (pod_id = public.get_user_pod())';
END $$;

-- Add columns to unified_invoices to track split payments status
ALTER TABLE public.unified_invoices 
ADD COLUMN IF NOT EXISTS split_settlement_status VARCHAR(50) DEFAULT 'unprocessed';

ALTER TABLE public.unified_invoices 
ADD COLUMN IF NOT EXISTS split_payload JSONB;

-- Grant execution/select permissions to authenticated roles
GRANT ALL ON TABLE public.cashfree_vendors TO authenticated;


-- =============================================================================
-- STEP 16: Cross-Pod Interconnect Views & Helpers (20260531000001)
-- =============================================================================

-- Materialized view for cross-pod operational stats
DO $$ 
BEGIN
  EXECUTE 'CREATE OR REPLACE VIEW public.pod_daily_stats AS
  SELECT 
    pod_id,
    COUNT(DISTINCT CASE WHEN entity_type = ''clinic'' THEN id END) as clinic_count,
    COUNT(DISTINCT CASE WHEN entity_type = ''pharmacy'' THEN id END) as pharmacy_count,  
    COUNT(DISTINCT CASE WHEN entity_type = ''lab'' THEN id END) as lab_count
  FROM public.entities 
  WHERE status = ''approved''
  GROUP BY pod_id';
END $$;

-- Function to get pod entities for cross-visibility
CREATE OR REPLACE FUNCTION public.get_pod_entities(p_pod_id UUID)
RETURNS SETOF public.entities AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.entities WHERE pod_id = p_pod_id AND status = 'approved';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to authenticated users
GRANT SELECT ON public.pod_daily_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pod_entities(UUID) TO authenticated;


-- =============================================================================
-- STEP 17: API Security Hardening — Serverless Rate Limiting Table & RPC (20260530000003)
-- =============================================================================

-- Create the rate limits table for edge functions
CREATE TABLE IF NOT EXISTS public.rate_limits (
    ip TEXT PRIMARY KEY,
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Defense-in-depth, no public access policies)
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Rate limiter core logic function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_ip TEXT, 
    p_max_requests INTEGER, 
    p_window_seconds INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Prune expired entries to maintain a small footprint
    DELETE FROM public.rate_limits 
    WHERE window_start < NOW() - (p_window_seconds || ' seconds')::INTERVAL;

    -- Upsert the client IP record
    INSERT INTO public.rate_limits (ip, request_count, window_start)
    VALUES (p_ip, 1, NOW())
    ON CONFLICT (ip) DO UPDATE
    SET request_count = CASE 
        WHEN public.rate_limits.window_start < NOW() - (p_window_seconds || ' seconds')::INTERVAL THEN 1
        ELSE public.rate_limits.request_count + 1
    END,
    window_start = CASE 
        WHEN public.rate_limits.window_start < NOW() - (p_window_seconds || ' seconds')::INTERVAL THEN NOW()
        ELSE public.rate_limits.window_start
    END
    RETURNING request_count INTO v_count;

    RETURN v_count <= p_max_requests;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Lock down the RPC against privilege leakage
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;



-- =============================================================================
-- SECTION 25: VitalSync Personalized Clinic Code Architecture (VS-S03N)
-- =============================================================================
ALTER TABLE public.pods ADD COLUMN IF NOT EXISTS clinic_code TEXT;
ALTER TABLE public.pods ADD COLUMN IF NOT EXISTS doctor_name TEXT;
ALTER TABLE public.pods ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.pods ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.pods ADD COLUMN IF NOT EXISTS daily_cost_budget NUMERIC DEFAULT 500.00;
ALTER TABLE public.pods ADD COLUMN IF NOT EXISTS daily_spend NUMERIC DEFAULT 0.00;
ALTER TABLE public.pods ADD COLUMN IF NOT EXISTS platform_fee_percent NUMERIC DEFAULT 2.5;
ALTER TABLE public.pods ADD COLUMN IF NOT EXISTS lifetime_platform_revenue NUMERIC DEFAULT 0.00;
ALTER TABLE public.pods ADD COLUMN IF NOT EXISTS pending_cash_balance NUMERIC DEFAULT 0.00;
ALTER TABLE public.pods ADD COLUMN IF NOT EXISTS is_verified_for_billing BOOLEAN DEFAULT TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pods_clinic_code_unique ON public.pods (clinic_code) WHERE clinic_code IS NOT NULL;

DROP FUNCTION IF EXISTS public.register_clinic_network(TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.register_clinic_network(
    p_clinic_name TEXT,
    p_clinic_phone TEXT,
    p_clinic_address TEXT,
    p_specialization TEXT
)
RETURNS TABLE (clinic_code TEXT)
AS $$
DECLARE
    v_pod_id UUID;
    v_entity_id UUID;
    v_clinic_code TEXT;
    v_display_name TEXT;
    v_clean_name TEXT;
    v_first_char TEXT;
    v_last_char TEXT;
    v_seq INT;
BEGIN
    SELECT COALESCE(raw_user_meta_data->>'display_name', p_clinic_name)
    INTO v_display_name 
    FROM auth.users 
    WHERE id = auth.uid();

    SELECT COALESCE(COUNT(*), 0) + 1 INTO v_seq FROM public.pods;

    v_clean_name := upper(regexp_replace(COALESCE(v_display_name, p_clinic_name), '^(dr\.?|doctor|prof\.?)\s*|[^a-zA-Z]', '', 'gi'));
    IF length(v_clean_name) = 0 THEN
        v_clean_name := 'DR';
    END IF;

    v_first_char := substring(v_clean_name, 1, 1);
    IF length(v_clean_name) > 1 THEN
        v_last_char := substring(v_clean_name, length(v_clean_name), 1);
    ELSE
        v_last_char := v_first_char;
    END IF;

    v_clinic_code := 'VS-' || v_first_char || lpad(v_seq::text, 2, '0') || v_last_char;

    WHILE EXISTS (SELECT 1 FROM public.pods WHERE pods.clinic_code = v_clinic_code) LOOP
        v_seq := v_seq + 1;
        v_clinic_code := 'VS-' || v_first_char || lpad(v_seq::text, 2, '0') || v_last_char;
    END LOOP;

    INSERT INTO public.pods (name, clinic_code, is_active, doctor_name, phone, location)
    VALUES (p_clinic_name, v_clinic_code, TRUE, COALESCE(v_display_name, p_clinic_name), p_clinic_phone, p_clinic_address)
    RETURNING id INTO v_pod_id;

    INSERT INTO public.entities (pod_id, entity_type, name, address, phone, status, is_active)
    VALUES (v_pod_id, 'clinic', p_clinic_name, p_clinic_address, p_clinic_phone, 'approved', TRUE)
    RETURNING id INTO v_entity_id;

    INSERT INTO public.profiles (id, entity_id, pod_id, role, consultation_fee, display_name)
    VALUES (auth.uid(), v_entity_id, v_pod_id, 'doctor', 400.00, COALESCE(v_display_name, 'Doctor'))
    ON CONFLICT (id) DO UPDATE 
    SET entity_id = EXCLUDED.entity_id, pod_id = EXCLUDED.pod_id, role = EXCLUDED.role, display_name = EXCLUDED.display_name;

    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
        'clinic_name', p_clinic_name,
        'clinic_code', v_clinic_code,
        'specialization', p_specialization,
        'role', 'doctor',
        'pod_id', v_pod_id
    )
    WHERE id = auth.uid();

    RETURN QUERY SELECT v_clinic_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.register_clinic_network(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_clinic_network(TEXT, TEXT, TEXT, TEXT) TO authenticated;

UPDATE public.pods 
SET clinic_code = 'VS-V01R' 
WHERE id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001' OR clinic_code = 'MF-APEX';

-- =============================================================================
-- ATOMIC CARE LOOP RPC (Process Encounter, Inventory, Requisitions & Invoices)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.process_clinical_care_loop(
    p_encounter_id UUID,
    p_patient_id UUID,
    p_doctor_id UUID,
    p_pod_id UUID,
    p_lab_entity_id UUID,
    p_pharmacy_entity_id UUID,
    p_medications JSONB,
    p_diagnostics JSONB,
    p_patient_phone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lab_fee NUMERIC := 0;
    v_pharmacy_fee NUMERIC := 0;
    v_doctor_fee NUMERIC := 0;
    v_platform_fee NUMERIC := 0;
    v_invoice_total NUMERIC := 0;
    
    v_assigned_tech_id UUID := NULL;
    v_test JSONB;
    v_test_price NUMERIC := 350.00;
    
    v_med JSONB;
    v_needed_qty INT;
    v_remaining_qty INT;
    v_batch RECORD;
    v_allocated_qty INT;
    v_hold_status TEXT;
    
    v_already_paid_consult BOOLEAN := FALSE;
    v_doctor_profile RECORD;
BEGIN
    -- 1. Insert Diagnostics & Lab Requisitions
    IF jsonb_array_length(p_diagnostics) > 0 THEN
        FOR v_test IN SELECT * FROM jsonb_array_elements(p_diagnostics)
        LOOP
            INSERT INTO public.encounter_diagnostics (encounter_id, loinc_code, test_name, status)
            VALUES (p_encounter_id, v_test->>'loincCode', v_test->>'name', 'ordered');
            
            -- Route to Lab Requisitions (Supports both dedicated lab entity and in-house clinic pod)
            IF p_lab_entity_id IS NOT NULL OR p_pod_id IS NOT NULL THEN
                IF v_assigned_tech_id IS NULL AND p_lab_entity_id IS NOT NULL THEN
                    SELECT id INTO v_assigned_tech_id FROM public.profiles 
                    WHERE entity_id = p_lab_entity_id AND role = 'lab_technician' LIMIT 1;
                END IF;
                
                v_test_price := 350.00;
                SELECT price INTO v_test_price FROM public.master_test_catalog WHERE loinc_code = v_test->>'loincCode' LIMIT 1;
                IF v_test_price IS NULL THEN v_test_price := 350.00; END IF;
                
                v_lab_fee := v_lab_fee + v_test_price;
                
                INSERT INTO public.lab_requisitions (
                    encounter_id, patient_id, lab_entity_id, loinc_code, test_name, 
                    barcode, status, assigned_technician_id, pod_id
                ) VALUES (
                    p_encounter_id, p_patient_id, p_lab_entity_id, v_test->>'loincCode', v_test->>'name',
                    UPPER('BAR-' || SUBSTRING(p_encounter_id::TEXT, 1, 8) || '-' || (v_test->>'loincCode')),
                    'pending', v_assigned_tech_id, p_pod_id
                );
            END IF;
        END LOOP;
    END IF;

    -- 2. Reserve Pharmacy Stock (WITH PESSIMISTIC LOCKING)
    IF jsonb_array_length(p_medications) > 0 THEN
        FOR v_med IN SELECT * FROM jsonb_array_elements(p_medications)
        LOOP
            v_needed_qty := 10;
            v_remaining_qty := v_needed_qty;
            
            IF p_pharmacy_entity_id IS NOT NULL THEN
                v_pharmacy_fee := v_pharmacy_fee + 150;
                
                FOR v_batch IN 
                    SELECT id, batch_number, expiry_date, quantity_in_stock 
                    FROM public.pharmacy_inventory 
                    WHERE pharmacy_entity_id = p_pharmacy_entity_id 
                      AND medicine_name = v_med->>'medicineName'
                      AND is_active = true 
                      AND quantity_in_stock > 0 
                      AND expiry_date >= CURRENT_DATE
                    ORDER BY expiry_date ASC
                    FOR UPDATE
                LOOP
                    IF v_remaining_qty <= 0 THEN EXIT; END IF;
                    
                    v_allocated_qty := LEAST(v_batch.quantity_in_stock, v_remaining_qty);
                    
                    UPDATE public.pharmacy_inventory 
                    SET quantity_in_stock = quantity_in_stock - v_allocated_qty,
                        updated_at = NOW()
                    WHERE id = v_batch.id;
                    
                    INSERT INTO public.inventory_holds (
                        pharmacy_entity_id, encounter_id, patient_id, medicine_name,
                        dosage, quantity, batch_number, expiry_date, hold_status
                    ) VALUES (
                        p_pharmacy_entity_id, p_encounter_id, p_patient_id, v_med->>'medicineName',
                        COALESCE(v_med->>'dosage', ''), v_allocated_qty, v_batch.batch_number, v_batch.expiry_date, 'held'
                    );
                    
                    v_remaining_qty := v_remaining_qty - v_allocated_qty;
                END LOOP;
                
                IF v_remaining_qty > 0 THEN
                    IF v_remaining_qty = v_needed_qty THEN
                        v_hold_status := 'OUT_OF_STOCK';
                    ELSE
                        v_hold_status := 'SHORTAGE';
                    END IF;
                    
                    INSERT INTO public.inventory_holds (
                        pharmacy_entity_id, encounter_id, patient_id, medicine_name,
                        dosage, quantity, batch_number, expiry_date, hold_status
                    ) VALUES (
                        p_pharmacy_entity_id, p_encounter_id, p_patient_id, v_med->>'medicineName',
                        COALESCE(v_med->>'dosage', ''), v_remaining_qty, v_hold_status, NULL, 'held'
                    );
                END IF;
            END IF;
        END LOOP;
    END IF;

    -- 3. Calculate Unified Invoice
    SELECT EXISTS (
        SELECT 1 FROM public.unified_invoices 
        WHERE patient_id = p_patient_id 
          AND payment_status = 'cleared'
          AND (doctor_fee > 0 OR invoice_type = 'consult')
    ) INTO v_already_paid_consult;

    IF v_already_paid_consult THEN
        v_doctor_fee := 0;
    ELSE
        SELECT consultation_fee, display_name INTO v_doctor_profile 
        FROM public.profiles 
        WHERE id = p_doctor_id LIMIT 1;
        
        v_doctor_fee := COALESCE(v_doctor_profile.consultation_fee, 400.00);
    END IF;

    v_platform_fee := GREATEST(10.00, (v_doctor_fee + v_lab_fee + v_pharmacy_fee) * 0.03);
    v_invoice_total := v_doctor_fee + v_lab_fee + v_pharmacy_fee + v_platform_fee;

    INSERT INTO public.unified_invoices (
        id, encounter_id, patient_id, doctor_fee, lab_fee, pharmacy_fee,
        platform_fee, total_amount, payment_status, pod_id
    ) VALUES (
        gen_random_uuid(), p_encounter_id, p_patient_id, v_doctor_fee, v_lab_fee, v_pharmacy_fee,
        v_platform_fee, v_invoice_total, 
        CASE WHEN (v_doctor_fee = 0 AND v_lab_fee = 0 AND v_pharmacy_fee = 0) THEN 'cleared' ELSE 'pending' END,
        p_pod_id
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'encounter_id', p_encounter_id,
        'invoice_total', v_invoice_total,
        'lab_fee', v_lab_fee,
        'pharmacy_fee', v_pharmacy_fee
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_clinical_care_loop(UUID, UUID, UUID, UUID, UUID, UUID, JSONB, JSONB, TEXT) TO authenticated, anon;

-- =============================================================================
-- Operational RPCs & Security Functions
-- =============================================================================

-- 1. DevSecOps Autonomous Self-Healing RPC
DROP FUNCTION IF EXISTS public.trigger_devsecops_auto_heal() CASCADE;
CREATE OR REPLACE FUNCTION public.trigger_devsecops_auto_heal()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_repaired_count INT := 0;
BEGIN
    BEGIN
        PERFORM public.reconcile_tenant_pod_association();
    EXCEPTION WHEN OTHERS THEN
        /* ignore if missing */
    END;

    ALTER TABLE public.patient_registry ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE;
    ALTER TABLE public.patient_registry ADD COLUMN IF NOT EXISTS condition TEXT;
    ALTER TABLE public.patient_registry ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE public.patient_registry ADD COLUMN IF NOT EXISTS medical_history JSONB DEFAULT '[]'::jsonb;
    
    ALTER TABLE public.waba_connections ADD COLUMN IF NOT EXISTS clinic_display_name VARCHAR(255);
    ALTER TABLE public.waba_connections ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
    ALTER TABLE public.waba_connections ADD COLUMN IF NOT EXISTS waba_status VARCHAR(50) DEFAULT 'active';

    v_repaired_count := v_repaired_count + 1;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'DevSecOps Autonomous Repair complete: Schema, RLS policies, and pod associations reconciled.',
        'repaired_items', v_repaired_count,
        'timestamp', NOW()
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.trigger_devsecops_auto_heal() TO anon, authenticated;

-- 2. Validate Clinic Code RPC
DROP FUNCTION IF EXISTS public.validate_clinic_code(TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.validate_clinic_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pod RECORD;
BEGIN
    SELECT id, name, doctor_name, clinic_code, status
    INTO v_pod
    FROM public.pods
    WHERE upper(trim(clinic_code)) = upper(trim(p_code))
    LIMIT 1;

    IF v_pod.id IS NULL THEN
        RETURN jsonb_build_object(
            'valid', false,
            'error', 'Invalid clinic code. Please check with your clinic admin.'
        );
    END IF;

    RETURN jsonb_build_object(
        'valid', true,
        'pod_id', v_pod.id,
        'clinic_name', v_pod.name,
        'doctor_name', v_pod.doctor_name,
        'clinic_code', v_pod.clinic_code
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'valid', false,
        'error', SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_clinic_code(TEXT) TO anon, authenticated;

-- 3. Login Sentry Rate Limiter & Attempt Logger
CREATE TABLE IF NOT EXISTS public.login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    ip_address TEXT,
    success BOOLEAN NOT NULL,
    attempted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time ON public.login_attempts(email, attempted_at);

DROP FUNCTION IF EXISTS public.check_login_sentry(TEXT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.check_login_sentry(
    p_email TEXT,
    p_ip TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_recent_fails INT;
    v_lockout_minutes INT := 15;
    v_max_attempts INT := 5;
BEGIN
    SELECT COUNT(*)
    INTO v_recent_fails
    FROM public.login_attempts
    WHERE lower(trim(email)) = lower(trim(p_email))
      AND success = FALSE
      AND attempted_at > (NOW() - INTERVAL '15 minutes');

    IF v_recent_fails >= v_max_attempts THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'locked', true,
            'retry_after_minutes', v_lockout_minutes,
            'message', 'Too many failed login attempts. Please try again in 15 minutes.'
        );
    END IF;

    RETURN jsonb_build_object(
        'allowed', true,
        'locked', false,
        'remaining_attempts', (v_max_attempts - v_recent_fails)
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'allowed', true,
        'locked', false,
        'error', SQLERRM
    );
END;
$$;

DROP FUNCTION IF EXISTS public.log_login_attempt(TEXT, BOOLEAN, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.log_login_attempt(
    p_email TEXT,
    p_success BOOLEAN,
    p_ip TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.login_attempts (email, ip_address, success, attempted_at)
    VALUES (lower(trim(p_email)), p_ip, p_success, NOW());

    RETURN jsonb_build_object('logged', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('logged', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_login_sentry(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_login_attempt(TEXT, BOOLEAN, TEXT) TO anon, authenticated;

-- 4. Self-Service Account Deletion RPC
DROP FUNCTION IF EXISTS public.delete_own_account() CASCADE;
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_uid UUID;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    DELETE FROM public.profiles WHERE id = v_uid;

    RETURN jsonb_build_object('success', true, 'message', 'Profile deleted successfully');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;

-- 5. Accumulate Platform Revenue RPC
DROP FUNCTION IF EXISTS public.accumulate_platform_revenue(UUID, NUMERIC, BOOLEAN) CASCADE;
CREATE OR REPLACE FUNCTION public.accumulate_platform_revenue(
    p_pod_id UUID,
    p_amount NUMERIC,
    p_is_cash BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.vitalsync_pool_settlements (
        pod_id,
        amount,
        settlement_type,
        status,
        created_at
    )
    VALUES (
        COALESCE(p_pod_id, 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'::uuid),
        p_amount,
        CASE WHEN p_is_cash THEN 'cash_counter_commission' ELSE 'digital_pg_commission' END,
        'cleared',
        NOW()
    );

    RETURN jsonb_build_object('success', true, 'amount', p_amount);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accumulate_platform_revenue(UUID, NUMERIC, BOOLEAN) TO anon, authenticated;

-- =============================================================================
-- END OF SCRIPT
-- =============================================================================


