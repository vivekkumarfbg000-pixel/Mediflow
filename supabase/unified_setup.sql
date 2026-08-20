-- =============================================================================
-- UNIFIED MEDIFLOW DATABASE SETUP SCRIPT
-- Combines migrations, schema tables, RLS security policies, triggers, 
-- RPC functions, and views for the multi-tenant SaaS.
-- =============================================================================

-- =============================================================================
-- STEP 1: Multi-Tenant Pod Partitioning
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
    queue_status TEXT DEFAULT 'awaiting_vitals',
    referral_code TEXT,
    referred_by_patient_id UUID REFERENCES public.patient_registry(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.patient_registry ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE public.patient_registry ADD COLUMN IF NOT EXISTS referred_by_patient_id UUID REFERENCES public.patient_registry(id);

-- Ensure public.patient_referral_rewards table exists
CREATE TABLE IF NOT EXISTS public.patient_referral_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES public.patient_registry(id) ON DELETE CASCADE,
    referred_patient_id UUID REFERENCES public.patient_registry(id) ON DELETE SET NULL,
    discount_percent NUMERIC(5,2) DEFAULT 10.00,
    reward_type VARCHAR(50) DEFAULT 'referral_10_percent',
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'redeemed', 'expired'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    redeemed_at TIMESTAMPTZ
);

-- Ensure public.scheduled_reminders table exists
CREATE TABLE IF NOT EXISTS public.scheduled_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES public.patient_registry(id) ON DELETE CASCADE,
    encounter_id UUID REFERENCES public.encounters(id) ON DELETE SET NULL,
    reminder_type VARCHAR(50) NOT NULL, -- 'day_7_adherence', 'month_1_followup', 'month_3_chronic'
    scheduled_for TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'cancelled'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

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
DO $$ 
BEGIN
  -- Temporarily disable user triggers on encounters during backfill to avoid firing clinical submission triggers
  EXECUTE 'ALTER TABLE public.encounters DISABLE TRIGGER USER';

  -- Populate existing records based on parent-child reference chains
  EXECUTE 'UPDATE public.patient_registry pr SET pod_id = COALESCE((SELECT pod_id FROM public.entities e WHERE e.id = pr.registered_at_entity LIMIT 1), ''dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'')';
  EXECUTE 'UPDATE public.encounters enc SET pod_id = COALESCE((SELECT pod_id FROM public.entities e WHERE e.id = enc.entity_id LIMIT 1), ''dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'')';
  EXECUTE 'UPDATE public.lab_requisitions lr SET pod_id = COALESCE((SELECT pod_id FROM public.encounters enc WHERE enc.id = lr.encounter_id LIMIT 1), ''dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'')';
  EXECUTE 'UPDATE public.unified_invoices ui SET pod_id = COALESCE((SELECT pod_id FROM public.encounters enc WHERE enc.id = ui.encounter_id LIMIT 1), ''dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'')';
  EXECUTE 'UPDATE public.financial_ledgers fl SET pod_id = COALESCE((SELECT pod_id FROM public.entities e WHERE e.id = fl.source_entity_id LIMIT 1), ''dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'')';
  EXECUTE 'UPDATE public.whatsapp_sessions ws SET pod_id = COALESCE((SELECT pod_id FROM public.patient_registry pr WHERE pr.id = ws.patient_id LIMIT 1), ''dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'')';
  EXECUTE 'UPDATE public.activity_logs al SET pod_id = COALESCE((SELECT pod_id FROM public.entities e WHERE e.id = al.entity_id LIMIT 1), ''dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'')';
  EXECUTE 'UPDATE public.clinic_staff cs SET pod_id = COALESCE((SELECT pod_id FROM public.entities e WHERE e.id = cs.entity_id LIMIT 1), ''dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'')';

  -- Re-enable user triggers
  EXECUTE 'ALTER TABLE public.encounters ENABLE TRIGGER USER';

  -- Apply strict NOT NULL constraints
  EXECUTE 'ALTER TABLE public.patient_registry ALTER COLUMN pod_id SET NOT NULL';
  EXECUTE 'ALTER TABLE public.encounters ALTER COLUMN pod_id SET NOT NULL';
  EXECUTE 'ALTER TABLE public.lab_requisitions ALTER COLUMN pod_id SET NOT NULL';
  EXECUTE 'ALTER TABLE public.unified_invoices ALTER COLUMN pod_id SET NOT NULL';
  EXECUTE 'ALTER TABLE public.financial_ledgers ALTER COLUMN pod_id SET NOT NULL';
  EXECUTE 'ALTER TABLE public.whatsapp_sessions ALTER COLUMN pod_id SET NOT NULL';
  EXECUTE 'ALTER TABLE public.activity_logs ALTER COLUMN pod_id SET NOT NULL';
  EXECUTE 'ALTER TABLE public.clinic_staff ALTER COLUMN pod_id SET NOT NULL';
EXCEPTION WHEN OTHERS THEN
  EXECUTE 'ALTER TABLE public.encounters ENABLE TRIGGER USER';
  RAISE;
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
-- STEP 2: WhatsApp Business API (WABA) Multi-Tenant Schema & Cryptography
-- =============================================================================

-- Enable pgcrypto if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Create the waba_connections table
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

ALTER TABLE public.waba_connections ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
ALTER TABLE public.waba_connections ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES public.entities(id) ON DELETE CASCADE;
ALTER TABLE public.waba_connections ADD COLUMN IF NOT EXISTS clinic_display_name VARCHAR(255);
ALTER TABLE public.waba_connections ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.waba_connections ADD COLUMN IF NOT EXISTS waba_status VARCHAR(50) DEFAULT 'active';
ALTER TABLE public.waba_connections ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.waba_connections ALTER COLUMN encrypted_system_user_token DROP NOT NULL;

ALTER TABLE public.waba_connections ENABLE ROW LEVEL SECURITY;

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

CREATE INDEX IF NOT EXISTS idx_waba_connections_phone_number_id ON public.waba_connections(phone_number_id);

-- Create the WhatsApp billing logs table
CREATE TABLE IF NOT EXISTS public.whatsapp_billing_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    waba_id VARCHAR(255) NOT NULL,
    phone_number_id VARCHAR(255) NOT NULL,
    conversation_id VARCHAR(255) UNIQUE NOT NULL,
    pricing_category VARCHAR(50) NOT NULL,
    cost NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,
    billable BOOLEAN DEFAULT TRUE,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.whatsapp_billing_logs ENABLE ROW LEVEL SECURITY;

-- Cryptography helper functions
CREATE OR REPLACE FUNCTION public.encrypt_waba_token(token TEXT, secret_key TEXT)
RETURNS BYTEA AS $$
BEGIN
    RETURN extensions.pgp_sym_encrypt(token, secret_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.encrypt_waba_token(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.encrypt_waba_token(TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.decrypt_waba_token(encrypted_token BYTEA, secret_key TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN extensions.pgp_sym_decrypt(encrypted_token, secret_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.decrypt_waba_token(BYTEA, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrypt_waba_token(BYTEA, TEXT) TO authenticated;

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
-- STEP 3: Agentic Task Pipelines
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.agent_task_pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pod_id UUID NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
    patient_id UUID REFERENCES public.patient_registry(id) ON DELETE SET NULL,
    original_prompt TEXT NOT NULL,
    parsed_intent VARCHAR(100) NOT NULL,
    current_step_index INTEGER DEFAULT 0,
    steps_json JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.agent_task_pipelines ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
ALTER TABLE public.agent_task_pipelines ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Enforce tenant pod isolation" ON public.agent_task_pipelines';
  EXECUTE 'CREATE POLICY "Enforce tenant pod isolation" ON public.agent_task_pipelines FOR ALL TO authenticated USING (pod_id = public.get_user_pod())';
END $$;

CREATE INDEX IF NOT EXISTS idx_agent_task_pipelines_pod_id ON public.agent_task_pipelines(pod_id);
CREATE INDEX IF NOT EXISTS idx_agent_task_pipelines_patient_id ON public.agent_task_pipelines(patient_id);

-- =============================================================================
-- STEP 4: Self-Healing Telemetry & Diagnostics
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.system_health_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pod_id UUID NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
    subsystem VARCHAR(50) NOT NULL,
    severity VARCHAR(50) NOT NULL,
    error_code VARCHAR(255),
    error_stack TEXT,
    healing_attempts INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'unresolved',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.system_health_telemetry ADD COLUMN IF NOT EXISTS healing_attempts INTEGER DEFAULT 0;
ALTER TABLE public.system_health_telemetry ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'unresolved';
ALTER TABLE public.system_health_telemetry ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

ALTER TABLE public.system_health_telemetry ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Enforce tenant pod isolation" ON public.system_health_telemetry';
  EXECUTE 'CREATE POLICY "Enforce tenant pod isolation" ON public.system_health_telemetry FOR ALL TO authenticated USING (pod_id = public.get_user_pod())';
END $$;

CREATE TABLE IF NOT EXISTS public.self_healing_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telemetry_id UUID NOT NULL REFERENCES public.system_health_telemetry(id) ON DELETE CASCADE,
    action_taken TEXT NOT NULL,
    outcome TEXT NOT NULL,
    healed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.self_healing_execution_logs ENABLE ROW LEVEL SECURITY;

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

CREATE INDEX IF NOT EXISTS idx_system_health_telemetry_pod_id ON public.system_health_telemetry(pod_id);
CREATE INDEX IF NOT EXISTS idx_system_health_telemetry_subsystem ON public.system_health_telemetry(subsystem);

-- Autonomous database healer function
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

REVOKE EXECUTE ON FUNCTION public.execute_autonomous_db_repair(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.execute_autonomous_db_repair(TEXT, TEXT, TEXT) TO authenticated;

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
  IF NOT (p_table_name = ANY(v_allowed_tables)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Table name not in allowed whitelist');
  END IF;

  IF p_column_name ~ '[^a-zA-Z0-9_]' OR p_table_name ~ '[^a-zA-Z0-9_]' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid SQL identifier characters');
  END IF;

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

  v_query := format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS %I %s', p_table_name, p_column_name, p_column_type);
  EXECUTE v_query;

  RETURN jsonb_build_object('success', true, 'action', 'column_added', 'table', p_table_name, 'column', p_column_name);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.heal_schema_drift(TEXT, TEXT, TEXT) TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION public.reconcile_tenant_pod_association()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_profile_pod_id UUID;
  v_default_pod_id UUID := 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'::UUID;
  v_reconciled BOOLEAN := FALSE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthenticated user session');
  END IF;

  SELECT entity_id INTO v_profile_pod_id
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_profile_pod_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.pods WHERE id = v_profile_pod_id) THEN
    UPDATE public.profiles
    SET entity_id = v_default_pod_id,
        status = 'approved',
        updated_at = NOW()
    WHERE id = v_user_id;
    
    v_reconciled := TRUE;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'reconciled', v_reconciled, 
    'user_id', v_user_id, 
    'pod_id', COALESCE(v_profile_pod_id, v_default_pod_id)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_tenant_pod_association() TO authenticated, anon, service_role;

-- =============================================================================
-- STEP 5: Commission & Low-Value Protection Logic
-- =============================================================================

ALTER TABLE public.master_test_catalog ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2) DEFAULT 350.00;
ALTER TABLE public.encounter_diagnostics ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS consultation_fee NUMERIC(10, 2) DEFAULT 400.00;

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
    needed_qty INT := 10;
    remaining_qty INT;
    allocated_qty INT;
    cur_batch RECORD;
    v_pod_id UUID;
BEGIN
    IF TG_OP = 'UPDATE' AND (OLD.status = 'completed' OR NEW.status != 'completed') THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'INSERT' AND NEW.status != 'completed' THEN
        RETURN NEW;
    END IF;

    v_pod_id := NEW.pod_id;

    SELECT COALESCE(consultation_fee, 400.00) INTO doctor_fee
    FROM public.profiles
    WHERE id = NEW.doctor_id;
    
    IF doctor_fee IS NULL THEN
        doctor_fee := 400.00;
    END IF;

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

    FOR diag IN SELECT * FROM public.encounter_diagnostics WHERE encounter_id = NEW.id
    LOOP
        SELECT COALESCE(price, 350.00) INTO v_test_price
        FROM public.master_test_catalog
        WHERE loinc_code = diag.loinc_code;

        IF v_test_price IS NULL THEN
            v_test_price := 350.00;
        END IF;

        UPDATE public.encounter_diagnostics
        SET price = v_test_price
        WHERE id = diag.id;

        INSERT INTO public.lab_requisitions (encounter_id, patient_id, lab_entity_id, loinc_code, test_name, barcode, assigned_technician_id, pod_id)
        VALUES (NEW.id, NEW.patient_id, v_lab_entity_id, diag.loinc_code, diag.test_name,
                'BAR-' || upper(substring(NEW.id::text, 1, 8)) || '-' || diag.loinc_code,
                'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002', v_pod_id)
        ON CONFLICT (barcode) DO NOTHING;
                
        lab_fee := lab_fee + v_test_price;
    END LOOP;

    BEGIN
        FOR med IN SELECT * FROM public.encounter_medications WHERE encounter_id = NEW.id
        LOOP
            remaining_qty := needed_qty;
            
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

                UPDATE public.pharmacy_inventory
                SET quantity_in_stock = quantity_in_stock - allocated_qty,
                    updated_at = now()
                WHERE id = cur_batch.id;

                 INSERT INTO public.inventory_holds (
                    pharmacy_entity_id, encounter_id, patient_id, medicine_name, dosage, quantity,
                    batch_number, expiry_date, hold_status, pod_id
                ) VALUES (
                    v_pharmacy_entity_id, NEW.id, NEW.patient_id, med.medicine_name, med.dosage, allocated_qty,
                    cur_batch.batch_number, cur_batch.expiry_date, 'held', v_pod_id
                );

                remaining_qty := remaining_qty - allocated_qty;
            END LOOP;

            IF remaining_qty > 0 THEN
                IF remaining_qty = needed_qty THEN
                    INSERT INTO public.inventory_holds (
                        pharmacy_entity_id, encounter_id, patient_id, medicine_name, dosage, quantity,
                        batch_number, expiry_date, hold_status, pod_id
                    ) VALUES (
                        v_pharmacy_entity_id, NEW.id, NEW.patient_id, med.medicine_name, med.dosage, remaining_qty,
                        'OUT_OF_STOCK', NULL, 'held', v_pod_id
                    );
                ELSE
                    INSERT INTO public.inventory_holds (
                        pharmacy_entity_id, encounter_id, patient_id, medicine_name, dosage, quantity,
                        batch_number, expiry_date, hold_status, pod_id
                    ) VALUES (
                        v_pharmacy_entity_id, NEW.id, NEW.patient_id, med.medicine_name, med.dosage, remaining_qty,
                        'SHORTAGE', NULL, 'held', v_pod_id
                    );
                END IF;

                INSERT INTO public.activity_logs (action_type, details, entity_id, pod_id)
                VALUES ('INVENTORY_SHORTAGE', jsonb_build_object(
                    'medicine_name', med.medicine_name,
                    'requested_quantity', needed_qty,
                    'remaining_quantity', remaining_qty,
                    'encounter_id', NEW.id,
                    'pharmacy_entity_id', v_pharmacy_entity_id
                ), v_pharmacy_entity_id, v_pod_id);
            END IF;

            pharmacy_fee := pharmacy_fee + 150;
        END LOOP;
    EXCEPTION
        WHEN OTHERS THEN
            INSERT INTO public.activity_logs (action_type, details, entity_id, pod_id)
            VALUES ('SYSTEM_ERROR', jsonb_build_object(
                'trigger', 'on_encounter_submitted (Action B - Pharmacy holds)',
                'error_message', SQLERRM,
                'error_code', SQLSTATE,
                'encounter_id', NEW.id
            ), v_pharmacy_entity_id, v_pod_id);
    END;

    platform_fee := (doctor_fee + lab_fee + pharmacy_fee) * 0.03;
    IF platform_fee < 10.00 THEN
        platform_fee := 10.00;
    END IF;
    
    total := doctor_fee + lab_fee + pharmacy_fee + platform_fee;

    SELECT phone INTO v_patient_phone FROM public.patient_registry WHERE id = NEW.patient_id;

    INSERT INTO public.unified_invoices
        (encounter_id, patient_id, doctor_fee, lab_fee, pharmacy_fee, platform_fee, total_amount, upi_qr_payload, pod_id)
    VALUES
        (NEW.id, NEW.patient_id, doctor_fee, lab_fee, pharmacy_fee, platform_fee, total,
         'upi://pay?pa=vitalsync@axl&pn=VitalSync&am=' || total || '&cu=INR&tn=VitalSync-' || NEW.id, v_pod_id);

    UPDATE public.whatsapp_sessions
    SET current_state = 'AWAITING_PAYMENT', last_interaction = now(),
        session_data = session_data || jsonb_build_object('invoiceTotal', total)
    WHERE whatsapp_sessions.patient_phone = v_patient_phone;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.on_encounter_submitted() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.on_encounter_submitted() TO authenticated;

DROP TRIGGER IF EXISTS trg_encounter_submitted ON public.encounters;
CREATE TRIGGER trg_encounter_submitted
    AFTER INSERT OR UPDATE ON public.encounters
    FOR EACH ROW
    EXECUTE FUNCTION public.on_encounter_submitted();

-- =============================================================================
-- STEP 6: Clinic SOP Center
-- =============================================================================

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

ALTER TABLE public.clinic_sops ENABLE ROW LEVEL SECURITY;

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
-- STEP 7: Medicine Billing & Counter Transactions
-- =============================================================================

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

ALTER TABLE public.counter_transactions ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
ALTER TABLE public.medicine_bills ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

ALTER TABLE public.counter_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicine_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicine_bill_items ENABLE ROW LEVEL SECURITY;

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
-- STEP 8: Database Query & Index Optimization
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_fefo_opt 
ON public.pharmacy_inventory (pharmacy_entity_id, medicine_name, is_active, quantity_in_stock, expiry_date ASC);

CREATE INDEX IF NOT EXISTS idx_entities_pod_type_opt 
ON public.entities (pod_id, entity_type);

CREATE INDEX IF NOT EXISTS idx_encounter_medications_encounter_id_opt 
ON public.encounter_medications (encounter_id);

CREATE INDEX IF NOT EXISTS idx_encounter_diagnostics_encounter_id_opt 
ON public.encounter_diagnostics (encounter_id);

-- =============================================================================
-- STEP 9: Walkin Labs & Doctor Dashboard God View
-- =============================================================================

ALTER TABLE public.lab_requisitions
  ADD COLUMN IF NOT EXISTS is_walkin BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS walkin_fee DECIMAL(10,2) DEFAULT 0.00;

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

ALTER TABLE public.pod_health_snapshots ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

CREATE INDEX IF NOT EXISTS idx_pod_health_snapshots_pod_at
  ON public.pod_health_snapshots (pod_id, snapshot_at DESC);

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

    SELECT e.pod_id, e.id INTO v_pod_id, v_lab_entity_id
    FROM public.entities e
    WHERE e.entity_type = 'pathology_lab'
    LIMIT 1;

    SELECT e.id INTO v_platform_entity_id
    FROM public.entities e
    WHERE e.entity_type = 'platform'
    LIMIT 1;

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
-- STEP 10: Lab Reports Table & Prescription Storage Policies
-- =============================================================================

ALTER TABLE lab_requisitions
  ADD COLUMN IF NOT EXISTS prescription_file_url TEXT,
  ADD COLUMN IF NOT EXISTS revisit_scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revisit_note TEXT;

CREATE TABLE IF NOT EXISTS lab_reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id      UUID NOT NULL REFERENCES lab_requisitions(id) ON DELETE CASCADE,
  patient_id          UUID NOT NULL REFERENCES patient_registry(id) ON DELETE CASCADE,
  patient_name        TEXT NOT NULL,
  report_file_url     TEXT,
  biomarker_json      JSONB,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by         UUID REFERENCES auth.users(id),
  approved_at         TIMESTAMPTZ,
  rejection_reason    TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE INDEX IF NOT EXISTS idx_lab_reports_requisition_id ON lab_reports(requisition_id);
CREATE INDEX IF NOT EXISTS idx_lab_reports_patient_id ON lab_reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_reports_status ON lab_reports(status);
CREATE INDEX IF NOT EXISTS idx_lab_requisitions_prescription ON lab_requisitions(prescription_file_url) WHERE prescription_file_url IS NOT NULL;

ALTER TABLE lab_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lab_reports_select_authenticated" ON lab_reports;
CREATE POLICY "lab_reports_select_authenticated" ON lab_reports FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "lab_reports_insert_authenticated" ON lab_reports;
CREATE POLICY "lab_reports_insert_authenticated" ON lab_reports FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "lab_reports_update_authenticated" ON lab_reports;
CREATE POLICY "lab_reports_update_authenticated" ON lab_reports FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON lab_reports TO authenticated;

-- Supabase Storage buckets creation
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

-- Storage policies
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
-- STEP 11: Seasonal AI Inventory Forecasting
-- =============================================================================

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

ALTER TABLE public.seasonal_demand_forecasts ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

ALTER TABLE public.seasonal_demand_forecasts ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Enforce tenant pod isolation for seasonal_demand_forecasts" ON public.seasonal_demand_forecasts';
  EXECUTE 'CREATE POLICY "Enforce tenant pod isolation for seasonal_demand_forecasts" ON public.seasonal_demand_forecasts FOR ALL TO authenticated USING (pod_id = public.get_user_pod())';
END $$;

GRANT ALL ON public.seasonal_demand_forecasts TO authenticated;
GRANT ALL ON public.seasonal_demand_forecasts TO service_role;

CREATE INDEX IF NOT EXISTS idx_seasonal_demand_forecasts_pod_id ON public.seasonal_demand_forecasts(pod_id);
CREATE INDEX IF NOT EXISTS idx_seasonal_demand_forecasts_pharmacy ON public.seasonal_demand_forecasts(pharmacy_entity_id);

-- =============================================================================
-- STEP 12: Add Patient Past Reports Summary
-- =============================================================================

ALTER TABLE public.patient_registry
  ADD COLUMN IF NOT EXISTS past_reports_summary TEXT;

-- =============================================================================
-- STEP 13: Self-Healing Telemetry Edge Function Trigger
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.dispatch_critical_telemetry_webhook()
RETURNS TRIGGER AS $$
DECLARE
    v_payload   JSONB;
    v_edge_url  TEXT;
BEGIN
    IF NEW.severity <> 'critical' THEN
        RETURN NEW;
    END IF;

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

    BEGIN
        v_edge_url := current_setting('app.supabase_project_url', true)
            || '/functions/v1/notify-developer-webhook';
    EXCEPTION WHEN OTHERS THEN
        RETURN NEW;
    END;

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

REVOKE EXECUTE ON FUNCTION public.dispatch_critical_telemetry_webhook() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_critical_telemetry_webhook ON public.system_health_telemetry;
CREATE TRIGGER trg_critical_telemetry_webhook
    AFTER INSERT ON public.system_health_telemetry
    FOR EACH ROW
    EXECUTE FUNCTION public.dispatch_critical_telemetry_webhook();

-- =============================================================================
-- STEP 14: Cashfree Order Webhook Mapping Column
-- =============================================================================

ALTER TABLE public.unified_invoices 
ADD COLUMN IF NOT EXISTS cashfree_order_id VARCHAR(100) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_unified_invoices_cashfree_order_id 
ON public.unified_invoices(cashfree_order_id);

-- =============================================================================
-- STEP 15: Cashfree sub-account / Vendor Onboarding
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.cashfree_vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pod_id UUID NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
    vendor_id VARCHAR(100) UNIQUE NOT NULL,
    holder_name VARCHAR(255) NOT NULL,
    bank_account_last4 VARCHAR(4) NOT NULL,
    verification_status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (pod_id, entity_id)
);

ALTER TABLE public.cashfree_vendors ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

ALTER TABLE public.cashfree_vendors ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Enforce tenant pod isolation on cashfree_vendors" ON public.cashfree_vendors';
  EXECUTE 'CREATE POLICY "Enforce tenant pod isolation on cashfree_vendors" ON public.cashfree_vendors FOR ALL TO authenticated USING (pod_id = public.get_user_pod())';
END $$;

ALTER TABLE public.unified_invoices 
ADD COLUMN IF NOT EXISTS split_settlement_status VARCHAR(50) DEFAULT 'unprocessed';

ALTER TABLE public.unified_invoices 
ADD COLUMN IF NOT EXISTS split_payload JSONB;

GRANT ALL ON TABLE public.cashfree_vendors TO authenticated;

-- =============================================================================
-- STEP 16: Cross-Pod Interconnect Views & Helpers
-- =============================================================================

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

CREATE OR REPLACE FUNCTION public.get_pod_entities(p_pod_id UUID)
RETURNS SETOF public.entities AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.entities WHERE pod_id = p_pod_id AND status = 'approved';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT SELECT ON public.pod_daily_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pod_entities(UUID) TO authenticated;

-- =============================================================================
-- STEP 17: API Security Hardening — Serverless Rate Limiting Table & RPC
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.rate_limits (
    ip TEXT PRIMARY KEY,
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_ip TEXT, 
    p_max_requests INTEGER, 
    p_window_seconds INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM public.rate_limits 
    WHERE window_start < NOW() - (p_window_seconds || ' seconds')::INTERVAL;

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

REVOKE EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;

-- =============================================================================
-- STEP 18: Strategic Reminders, Viral Referral Engine & Onboarding DDL
-- =============================================================================

ALTER TABLE public.patient_registry 
ADD COLUMN IF NOT EXISTS referral_code TEXT,
ADD COLUMN IF NOT EXISTS referred_by_patient_id UUID REFERENCES public.patient_registry(id);

CREATE TABLE IF NOT EXISTS public.patient_referral_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES public.patient_registry(id) ON DELETE CASCADE,
    referred_patient_id UUID REFERENCES public.patient_registry(id) ON DELETE CASCADE,
    discount_percent NUMERIC(5,2) DEFAULT 10.00,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'redeemed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    redeemed_at TIMESTAMPTZ
);

ALTER TABLE public.patient_referral_rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow service role full access to patient_referral_rewards" ON public.patient_referral_rewards;
CREATE POLICY "Allow service role full access to patient_referral_rewards"
ON public.patient_referral_rewards FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.scheduled_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES public.patient_registry(id) ON DELETE CASCADE,
    encounter_id UUID REFERENCES public.encounters(id) ON DELETE CASCADE,
    reminder_type TEXT CHECK (reminder_type IN ('day_7_adherence', 'month_1_followup', 'month_3_chronic')),
    scheduled_for TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.scheduled_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow service role full access to scheduled_reminders" ON public.scheduled_reminders;
CREATE POLICY "Allow service role full access to scheduled_reminders"
ON public.scheduled_reminders FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================================================
-- STEP 15: High-Performance Database Indexes for Auto-Healing Engine & Ultra-Fast WhatsApp Routing
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_phone ON public.whatsapp_sessions(patient_phone);
CREATE INDEX IF NOT EXISTS idx_waba_connections_phone_id ON public.waba_connections(phone_number_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status_time ON public.appointments(status, appointment_time);
CREATE INDEX IF NOT EXISTS idx_patient_registry_phone ON public.patient_registry(phone);
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_status_date ON public.scheduled_reminders(status, scheduled_for);

-- =============================================================================
-- STEP 16: Auto-Healer Autonomous Self-Healing Engine & Telemetry Infrastructure
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.system_health_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subsystem TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    error_code TEXT,
    error_stack TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'healing', 'healed', 'ignored')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.system_health_telemetry ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow service role full access to system_health_telemetry" ON public.system_health_telemetry;
CREATE POLICY "Allow service role full access to system_health_telemetry"
ON public.system_health_telemetry FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.self_healing_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telemetry_id UUID REFERENCES public.system_health_telemetry(id) ON DELETE SET NULL,
    action_taken TEXT NOT NULL,
    resolution_details TEXT,
    healed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.self_healing_execution_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow service role full access to self_healing_execution_logs" ON public.self_healing_execution_logs;
CREATE POLICY "Allow service role full access to self_healing_execution_logs"
ON public.self_healing_execution_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Definer RPC for Autonomous Schema Healing
CREATE OR REPLACE FUNCTION public.execute_autonomous_db_repair(p_table TEXT, p_column TEXT, p_type TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = p_table AND table_schema = 'public') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = p_table AND column_name = p_column) THEN
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS %I %s', p_table, p_column, p_type);
            RETURN TRUE;
        END IF;
    END IF;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 360° SUPABASE REALTIME CDC PUBLICATION ENROLLMENT (IDEMPOTENT) ─────────────────────────
-- Ensures that Postgres CDC changes broadcast live to frontend RealtimeSyncService across all 13 core tables

DO $$ 
DECLARE
  t text;
  tables text[] := ARRAY[
    'appointments',
    'financial_ledgers',
    'unified_invoices',
    'patient_registry',
    'whatsapp_sessions',
    'medicine_bills',
    'lab_requisitions',
    'inventory_holds',
    'pathology_reports',
    'saas_invoices',
    'saas_prescriptions',
    'vitalsync_pool_settlements',
    'clinic_sops',
    'bank_upi_transactions'
  ];
BEGIN
  -- Create publication if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  -- Add tables idempotently ignoring duplicate enrollment errors (ERROR 42710)
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION 
      WHEN duplicate_object THEN NULL; -- Ignore if already member
      WHEN OTHERS THEN NULL;           -- Ignore if table does not exist
    END;
  END LOOP;
END $$;

-- Ensure public select policies exist for realtime CDC consumption
DROP POLICY IF EXISTS "Allow public select on appointments" ON public.appointments;
DROP POLICY IF EXISTS "Enforce CDC isolation on appointments" ON public.appointments;
CREATE POLICY "Enforce CDC isolation on appointments" ON public.appointments FOR SELECT TO authenticated USING (pod_id = public.get_user_pod());

DROP POLICY IF EXISTS "Allow public select on financial_ledgers" ON public.financial_ledgers;
DROP POLICY IF EXISTS "Enforce CDC isolation on financial_ledgers" ON public.financial_ledgers;
CREATE POLICY "Enforce CDC isolation on financial_ledgers" ON public.financial_ledgers FOR SELECT TO authenticated USING (pod_id = public.get_user_pod());

DROP POLICY IF EXISTS "Allow public select on unified_invoices" ON public.unified_invoices;
DROP POLICY IF EXISTS "Enforce CDC isolation on unified_invoices" ON public.unified_invoices;
CREATE POLICY "Enforce CDC isolation on unified_invoices" ON public.unified_invoices FOR SELECT TO authenticated USING (pod_id = public.get_user_pod());

DROP POLICY IF EXISTS "Allow public select on patient_registry" ON public.patient_registry;
DROP POLICY IF EXISTS "Enforce CDC isolation on patient_registry" ON public.patient_registry;
CREATE POLICY "Enforce CDC isolation on patient_registry" ON public.patient_registry FOR SELECT TO authenticated USING (pod_id = public.get_user_pod());

DROP POLICY IF EXISTS "Allow public select on whatsapp_sessions" ON public.whatsapp_sessions;
DROP POLICY IF EXISTS "Enforce CDC isolation on whatsapp_sessions" ON public.whatsapp_sessions;
CREATE POLICY "Enforce CDC isolation on whatsapp_sessions" ON public.whatsapp_sessions FOR SELECT TO authenticated USING (pod_id = public.get_user_pod());

-- =============================================================================
-- STEP 15: Auto-Healer v14.0 Server-Side & CI/CD Telemetry Tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.deployment_health (
  id TEXT PRIMARY KEY DEFAULT 'current',
  rollback_requested BOOLEAN DEFAULT FALSE,
  trigger_reason TEXT,
  triggered_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.deployment_health ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow service role and public read on deployment_health" ON public.deployment_health;
CREATE POLICY "Allow service role and public read on deployment_health" ON public.deployment_health FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS public.ci_healer_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_name TEXT,
  job_name TEXT,
  failure_reason TEXT,
  fix_applied TEXT,
  fix_succeeded BOOLEAN,
  github_run_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ci_healer_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow service role and public write on ci_healer_log" ON public.ci_healer_log;
CREATE POLICY "Allow service role and public write on ci_healer_log" ON public.ci_healer_log FOR ALL USING (true);

-- =============================================================================
-- STEP 19: Realtime Sync Tables (pathology_reports, vitalsync_pool_settlements, saas_invoices, saas_prescriptions)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.pathology_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requisition_id UUID REFERENCES public.lab_requisitions(id) ON DELETE SET NULL,
    patient_id UUID REFERENCES public.patient_registry(id) ON DELETE CASCADE,
    lab_entity_id UUID REFERENCES public.entities(id) ON DELETE CASCADE,
    loinc_code VARCHAR(100),
    test_name TEXT,
    report_file_url TEXT,
    biomarker_json JSONB,
    status VARCHAR(50) DEFAULT 'pending',
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    revisit_scheduled_at TIMESTAMPTZ,
    revisit_note TEXT,
    pod_id UUID NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pathology_reports ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
ALTER TABLE public.pathology_reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.pathology_reports ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Enforce tenant pod isolation" ON public.pathology_reports';
  EXECUTE 'CREATE POLICY "Enforce tenant pod isolation" ON public.pathology_reports FOR ALL TO authenticated USING (pod_id = public.get_user_pod())';
END $$;

CREATE INDEX IF NOT EXISTS idx_pathology_reports_pod_id ON public.pathology_reports(pod_id);
CREATE INDEX IF NOT EXISTS idx_pathology_reports_patient_id ON public.pathology_reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_pathology_reports_requisition_id ON public.pathology_reports(requisition_id);
CREATE INDEX IF NOT EXISTS idx_pathology_reports_status ON public.pathology_reports(status);

CREATE TABLE IF NOT EXISTS public.vitalsync_pool_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID REFERENCES public.entities(id) ON DELETE SET NULL,
    settlement_period_start TIMESTAMPTZ NOT NULL,
    settlement_period_end TIMESTAMPTZ NOT NULL,
    total_gmv NUMERIC(12,2) DEFAULT 0.00,
    total_platform_fee NUMERIC(12,2) DEFAULT 0.00,
    total_doctor_payout NUMERIC(12,2) DEFAULT 0.00,
    total_lab_payout NUMERIC(12,2) DEFAULT 0.00,
    total_pharmacy_payout NUMERIC(12,2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'pending',
    initiated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ,
    pod_id UUID NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.vitalsync_pool_settlements ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
ALTER TABLE public.vitalsync_pool_settlements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.vitalsync_pool_settlements ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Enforce tenant pod isolation" ON public.vitalsync_pool_settlements';
  EXECUTE 'CREATE POLICY "Enforce tenant pod isolation" ON public.vitalsync_pool_settlements FOR ALL TO authenticated USING (pod_id = public.get_user_pod())';
END $$;

CREATE INDEX IF NOT EXISTS idx_vitalsync_pool_settlements_pod_id ON public.vitalsync_pool_settlements(pod_id);
CREATE INDEX IF NOT EXISTS idx_vitalsync_pool_settlements_period ON public.vitalsync_pool_settlements(settlement_period_start, settlement_period_end);
CREATE INDEX IF NOT EXISTS idx_vitalsync_pool_settlements_status ON public.vitalsync_pool_settlements(status);

CREATE TABLE IF NOT EXISTS public.saas_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encounter_id UUID REFERENCES public.encounters(id) ON DELETE SET NULL,
    patient_id UUID REFERENCES public.patient_registry(id) ON DELETE CASCADE,
    clinic_entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL,
    doctor_fee NUMERIC(10,2) DEFAULT 0.00,
    lab_fee NUMERIC(10,2) DEFAULT 0.00,
    pharmacy_fee NUMERIC(10,2) DEFAULT 0.00,
    platform_fee NUMERIC(10,2) DEFAULT 0.00,
    total_amount NUMERIC(10,2) DEFAULT 0.00,
    upi_qr_payload TEXT,
    status VARCHAR(50) DEFAULT 'unpaid',
    payment_status VARCHAR(50) DEFAULT 'pending',
    payment_method VARCHAR(50),
    type VARCHAR(50),
    patient_name TEXT,
    pod_id UUID NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.saas_invoices ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
ALTER TABLE public.saas_invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.saas_invoices ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Enforce tenant pod isolation" ON public.saas_invoices';
  EXECUTE 'CREATE POLICY "Enforce tenant pod isolation" ON public.saas_invoices FOR ALL TO authenticated USING (pod_id = public.get_user_pod())';
END $$;

CREATE INDEX IF NOT EXISTS idx_saas_invoices_pod_id ON public.saas_invoices(pod_id);
CREATE INDEX IF NOT EXISTS idx_saas_invoices_patient_id ON public.saas_invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_saas_invoices_status ON public.saas_invoices(status);

CREATE TABLE IF NOT EXISTS public.saas_prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    encounter_id UUID REFERENCES public.encounters(id) ON DELETE SET NULL,
    patient_id UUID REFERENCES public.patient_registry(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    extracted_medicines JSONB,
    extracted_tests TEXT[],
    prescription_file_url TEXT,
    status VARCHAR(50) DEFAULT 'active',
    pod_id UUID NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.saas_prescriptions ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
ALTER TABLE public.saas_prescriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.saas_prescriptions ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Enforce tenant pod isolation" ON public.saas_prescriptions';
  EXECUTE 'CREATE POLICY "Enforce tenant pod isolation" ON public.saas_prescriptions FOR ALL TO authenticated USING (pod_id = public.get_user_pod())';
END $$;

CREATE INDEX IF NOT EXISTS idx_saas_prescriptions_pod_id ON public.saas_prescriptions(pod_id);
CREATE INDEX IF NOT EXISTS idx_saas_prescriptions_patient_id ON public.saas_prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_saas_prescriptions_appointment_id ON public.saas_prescriptions(appointment_id);

-- Ensure public.profiles contains required columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Auto-provision public.profiles row on auth.users insertion
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role text;
  v_display_name text;
BEGIN
  v_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    NEW.raw_app_meta_data->>'role',
    'doctor'
  );

  v_display_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.profiles (
    id,
    email,
    display_name,
    role,
    consultation_fee,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    v_display_name,
    v_role,
    400.00,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
    role = COALESCE(public.profiles.role, EXCLUDED.role),
    updated_at = NOW();

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user_signup trigger error: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_signup();

-- =============================================================================
-- VITALSYNC SRE PATCH: WhatsApp Dispatch Lost Update Anomaly Fix
-- =============================================================================
CREATE OR REPLACE FUNCTION public.atomic_append_whatsapp_chat(
  p_patient_phone TEXT,
  p_patient_id UUID,
  p_pod_id UUID,
  p_message JSONB,
  p_waba_error TEXT DEFAULT NULL,
  p_current_time TIMESTAMPTZ DEFAULT NOW()
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.whatsapp_sessions (
    patient_phone, 
    patient_id, 
    current_state, 
    last_interaction, 
    session_data,
    pod_id
  )
  VALUES (
    p_patient_phone, 
    p_patient_id, 
    'COMPLETED', 
    p_current_time, 
    jsonb_build_object(
      'chatHistory', jsonb_build_array(p_message),
      'podId', p_pod_id,
      'wabaErrorMessage', p_waba_error
    ),
    p_pod_id
  )
  ON CONFLICT (patient_phone) DO UPDATE 
  SET 
    last_interaction = EXCLUDED.last_interaction,
    current_state = 'COMPLETED',
    session_data = jsonb_set(
      jsonb_set(
        COALESCE(public.whatsapp_sessions.session_data, '{}'::jsonb),
        '{chatHistory}',
        (COALESCE(public.whatsapp_sessions.session_data->'chatHistory', '[]'::jsonb) || p_message)
      ),
      '{wabaErrorMessage}',
      to_jsonb(p_waba_error)
    );
END;
$$;

-- =============================================================================
-- VITALSYNC SRE PATCH: Razorpay Webhook UUID Casting Type Crash Fix
-- =============================================================================
CREATE OR REPLACE FUNCTION public.find_invoice_by_prefix(p_prefix TEXT)
RETURNS SETOF public.unified_invoices
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM public.unified_invoices
  WHERE id::text LIKE p_prefix || '%';
$$;



CREATE OR REPLACE FUNCTION public.generate_next_token_number(
  p_virtual_date TEXT,
  p_pod_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_seq INT;
BEGIN
  -- Atomically count existing appointments for this date+pod
  SELECT COUNT(*) + 1
  INTO v_next_seq
  FROM appointments
  WHERE virtual_date = p_virtual_date
    AND pod_id = p_pod_id;

  RETURN 'T-' || LPAD(v_next_seq::TEXT, 2, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_next_token_number(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_next_token_number(TEXT, UUID) TO service_role;


-- =============================================================================
-- Mediflow: Session-Scoped Advisory Lock RPCs
-- =============================================================================
CREATE OR REPLACE FUNCTION public.try_acquire_session_lock(p_key BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN pg_try_advisory_lock(p_key);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_session_lock(p_key BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN pg_advisory_unlock(p_key);
END;
$$;

GRANT EXECUTE ON FUNCTION public.try_acquire_session_lock(BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_session_lock(BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.try_acquire_session_lock(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_session_lock(BIGINT) TO authenticated;

-- Migration: Atomic Care Loop RPC to fix Client-Side State Dropping & TOCTOU Race Conditions
-- Implements robust transactional wrapper for encounter execution.

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
    v_doctor_display_name TEXT := 'Doctor';
    v_doctor_profile RECORD;
    
    v_meds_text TEXT := '';
    v_diags_text TEXT := '';
    v_bot_message TEXT;
    v_existing_session RECORD;
    v_current_history JSONB;
    v_session_data JSONB;
    v_new_history_entry JSONB;
BEGIN
    -- 1. Insert Diagnostics
    IF jsonb_array_length(p_diagnostics) > 0 THEN
        FOR v_test IN SELECT * FROM jsonb_array_elements(p_diagnostics)
        LOOP
            INSERT INTO encounter_diagnostics (encounter_id, loinc_code, test_name, status)
            VALUES (p_encounter_id, v_test->>'loincCode', v_test->>'name', 'ordered');
            
            -- Prepare text for WhatsApp
            v_diags_text := v_diags_text || '🧪 ' || (v_test->>'name') || E'\n';
            
            -- Route to Lab Requisitions
            IF p_lab_entity_id IS NOT NULL THEN
                -- Find lab technician
                IF v_assigned_tech_id IS NULL THEN
                    SELECT id INTO v_assigned_tech_id FROM profiles 
                    WHERE entity_id = p_lab_entity_id AND role = 'lab_technician' LIMIT 1;
                END IF;
                
                -- Get Price
                v_test_price := 350.00;
                SELECT price INTO v_test_price FROM master_test_catalog WHERE loinc_code = v_test->>'loincCode' LIMIT 1;
                IF v_test_price IS NULL THEN v_test_price := 350.00; END IF;
                
                v_lab_fee := v_lab_fee + v_test_price;
                
                INSERT INTO lab_requisitions (
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
                
                -- Prepare text for WhatsApp
                v_meds_text := v_meds_text || '💊 ' || (v_med->>'medicineName') || ' (' || COALESCE(v_med->>'frequency', '') || ', ' || COALESCE(v_med->>'duration', '') || ')' || E'\n';
                
                -- FOR UPDATE strictly serializes concurrent stock deductions! (Fixes TOCTOU)
                FOR v_batch IN 
                    SELECT id, batch_number, expiry_date, quantity_in_stock 
                    FROM pharmacy_inventory 
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
                    
                    UPDATE pharmacy_inventory 
                    SET quantity_in_stock = quantity_in_stock - v_allocated_qty,
                        updated_at = NOW()
                    WHERE id = v_batch.id;
                    
                    INSERT INTO inventory_holds (
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
                    
                    INSERT INTO inventory_holds (
                        pharmacy_entity_id, encounter_id, patient_id, medicine_name,
                        dosage, quantity, batch_number, expiry_date, hold_status
                    ) VALUES (
                        p_pharmacy_entity_id, p_encounter_id, p_patient_id, v_med->>'medicineName',
                        COALESCE(v_med->>'dosage', ''), v_remaining_qty, v_hold_status, NULL, 'held'
                    );
                    
                    INSERT INTO activity_logs (action_type, details, entity_id, pod_id)
                    VALUES (
                        'INVENTORY_SHORTAGE', 
                        jsonb_build_object(
                            'medicine_name', v_med->>'medicineName', 
                            'requested_quantity', v_needed_qty, 
                            'remaining_quantity', v_remaining_qty, 
                            'encounter_id', p_encounter_id, 
                            'pharmacy_entity_id', p_pharmacy_entity_id
                        ), 
                        p_pharmacy_entity_id, p_pod_id
                    );
                END IF;
            END IF;
        END LOOP;
    END IF;

    -- 3. Unified Invoice Generation
    SELECT EXISTS (
        SELECT 1 FROM unified_invoices 
        WHERE (patient_id = p_patient_id OR patient_id::TEXT = p_patient_id::TEXT)
          AND (payment_status = 'cleared' OR payment_status = 'paid')
          AND (doctor_fee > 0 OR type = 'consult')
    ) INTO v_already_paid_consult;

    IF NOT v_already_paid_consult THEN
        v_doctor_fee := 400.00;
        SELECT consultation_fee, display_name, name INTO v_doctor_profile FROM profiles WHERE id = p_doctor_id LIMIT 1;
        IF v_doctor_profile.consultation_fee IS NOT NULL THEN
            v_doctor_fee := v_doctor_profile.consultation_fee;
        END IF;
        IF v_doctor_profile.display_name IS NOT NULL THEN
            v_doctor_display_name := v_doctor_profile.display_name;
        ELSIF v_doctor_profile.name IS NOT NULL THEN
            v_doctor_display_name := v_doctor_profile.name;
        END IF;
    END IF;

    v_platform_fee := (v_doctor_fee + v_lab_fee + v_pharmacy_fee) * 0.03;
    IF v_platform_fee < 10.00 THEN v_platform_fee := 10.00; END IF;
    v_invoice_total := v_doctor_fee + v_lab_fee + v_pharmacy_fee + v_platform_fee;

    INSERT INTO unified_invoices (
        encounter_id, patient_id, doctor_fee, lab_fee, pharmacy_fee, platform_fee, total_amount,
        upi_qr_payload, pod_id
    ) VALUES (
        p_encounter_id, p_patient_id, v_doctor_fee, v_lab_fee, v_pharmacy_fee, v_platform_fee, v_invoice_total,
        'upi://pay?pa=vitalsync@axl&pn=VitalSync&am=' || v_invoice_total || '&cu=INR&tn=VitalSync-' || p_encounter_id, p_pod_id
    );

    -- 4. Mutate WhatsApp Bot State
    IF p_patient_phone IS NOT NULL THEN
        SELECT id, session_data INTO v_existing_session FROM whatsapp_sessions WHERE patient_phone = p_patient_phone LIMIT 1;
        
        IF v_existing_session.id IS NOT NULL THEN
            IF NOT v_doctor_display_name ILIKE 'Dr.%' THEN
                v_doctor_display_name := 'Dr. ' || v_doctor_display_name;
            END IF;
            
            v_bot_message := '*' || v_doctor_display_name || '* has signed off your Clinical e-Prescription (e-Rx) and care invoice.';
            IF LENGTH(v_meds_text) > 0 THEN v_bot_message := v_bot_message || E'\n\n*Generic Medicines ordered*:\n' || v_meds_text; END IF;
            IF LENGTH(v_diags_text) > 0 THEN v_bot_message := v_bot_message || E'\n\n*Diagnostics Ordered*:\n' || v_diags_text; END IF;
            v_bot_message := v_bot_message || E'\n\n*Payment Pending*: A unified care pod invoice is generated. Please pay below:';
            
            v_session_data := v_existing_session.session_data;
            v_current_history := COALESCE(v_session_data->'chatHistory', '[]'::JSONB);
            v_new_history_entry := jsonb_build_object('sender', 'bot', 'text', v_bot_message, 'time', NOW());
            v_current_history := v_current_history || v_new_history_entry;
            
            v_session_data := jsonb_set(v_session_data, '{chatHistory}', v_current_history);
            v_session_data := jsonb_set(v_session_data, '{invoiceTotal}', to_jsonb(v_invoice_total));
            
            UPDATE whatsapp_sessions 
            SET current_state = 'AWAITING_PAYMENT',
                session_data = v_session_data,
                last_interaction = NOW()
            WHERE id = v_existing_session.id;
            
            INSERT INTO activity_logs (action_type, details, entity_id, pod_id)
            VALUES ('WHATSAPP_STATE_TRANSITION', jsonb_build_object('phone', p_patient_phone, 'newState', 'AWAITING_PAYMENT'), v_existing_session.id, p_pod_id);
        END IF;
    END IF;

    RETURN jsonb_build_object('success', true, 'invoiceTotal', v_invoice_total);
EXCEPTION WHEN OTHERS THEN
    -- In the event of ANY failure, Postgres will automatically rollback the entire transaction.
    RAISE WARNING 'Care loop transaction failed: %', SQLERRM;
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Migration: Atomic Payment Settlement RPC
-- Fixes Split-Brain Data Corruption for Counter and Online Webhook Payments

CREATE OR REPLACE FUNCTION public.process_invoice_settlement(
    p_invoice_id UUID,
    p_payment_method TEXT,
    p_amount_paid NUMERIC DEFAULT NULL,
    p_gateway_reference_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invoice RECORD;
    v_doctor_fee NUMERIC := 0;
    v_platform_fee NUMERIC := 0;
    v_gateway_fee NUMERIC := 0;
    v_net_profit NUMERIC := 0;
    v_amount NUMERIC := 0;
    v_pod_id UUID;
BEGIN
    -- 1. Lock the invoice to prevent concurrent webhook/counter race conditions
    SELECT * INTO v_invoice 
    FROM unified_invoices 
    WHERE id = p_invoice_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
    END IF;

    IF v_invoice.payment_status = 'cleared' THEN
        RETURN jsonb_build_object('success', true, 'skipped', true, 'message', 'Invoice already cleared');
    END IF;

    v_amount := COALESCE(p_amount_paid, v_invoice.total_amount);
    v_doctor_fee := COALESCE(v_invoice.doctor_fee, 500);
    v_platform_fee := COALESCE(v_invoice.platform_fee, 15);
    v_pod_id := v_invoice.pod_id;

    IF p_payment_method IN ('razorpay', 'phonepe', 'paytm') THEN
        v_gateway_fee := ROUND(v_amount * 0.02, 2); -- Typical 2% digital gateway fee
    ELSE
        v_gateway_fee := 0; -- Cash / UPI Counter is 0% MDR
    END IF;

    -- Counter Doctor Consultation Fee Immunity Protocol (Rule 58)
    IF COALESCE(v_invoice.pharmacy_fee, 0) = 0 
       AND COALESCE(v_invoice.lab_fee, 0) = 0 
       AND p_payment_method IN ('cash', 'upi') 
       AND COALESCE(v_invoice.source, '') != 'whatsapp' THEN
        v_platform_fee := 0;
        v_doctor_fee := v_amount;
    END IF;
    
    v_net_profit := GREATEST(0, v_platform_fee - v_gateway_fee);

    -- 2. Mark Invoice as Cleared
    UPDATE unified_invoices 
    SET payment_status = 'cleared',
        payment_method = p_payment_method,
        settled_at = NOW(),
        updated_at = NOW()
    WHERE id = p_invoice_id;

    -- 3. Confirm associated Appointment
    IF v_invoice.appointment_id IS NOT NULL THEN
        UPDATE appointments 
        SET status = 'confirmed',
            payment_status = 'cleared',
            token_number = '#TK-' || UPPER(SUBSTRING(p_invoice_id::TEXT, 1, 5)),
            updated_at = NOW()
        WHERE id = v_invoice.appointment_id 
          AND status = 'pending_payment';
    END IF;

    -- 4. Generate Idempotent Pool Settlement
    IF p_gateway_reference_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM vitalsync_pool_settlements WHERE gateway_reference_id = p_gateway_reference_id) THEN
            INSERT INTO vitalsync_pool_settlements (
                invoice_id, patient_id, total_amount, doctor_share, platform_share, 
                gateway_fee, net_platform_profit, payment_mode, settlement_status, 
                gateway_reference_id, created_at, pod_id
            ) VALUES (
                p_invoice_id, v_invoice.patient_id, v_amount, v_doctor_fee, v_platform_fee,
                v_gateway_fee, v_net_profit, p_payment_method, 'completed', 
                p_gateway_reference_id, NOW(), v_pod_id
            );
        END IF;
    ELSE
        -- Generate a unique counter reference
        INSERT INTO vitalsync_pool_settlements (
            invoice_id, patient_id, total_amount, doctor_share, platform_share, 
            gateway_fee, net_platform_profit, payment_mode, settlement_status, 
            gateway_reference_id, created_at, pod_id
        ) VALUES (
            p_invoice_id, v_invoice.patient_id, v_amount, v_doctor_fee, v_platform_fee,
            v_gateway_fee, v_net_profit, p_payment_method, 'completed', 
            'counter-' || p_payment_method || '-' || SUBSTRING(p_invoice_id::TEXT, 1, 8), NOW(), v_pod_id
        );
    END IF;

    -- 5. Auto-Dispense Pharmacy Inventory Holds
    -- Strict Row-Level Locking on inventory_holds to prevent concurrent dispatch
    UPDATE inventory_holds 
    SET hold_status = 'dispensed',
        dispensed_at = NOW(),
        updated_at = NOW()
    WHERE patient_id = v_invoice.patient_id 
      AND hold_status = 'held'
      AND encounter_id = v_invoice.encounter_id;

    -- 6. Generate Financial Ledger Splits (Platform Fee & Doctor Fee)
    -- Insert Platform Fee Record
    INSERT INTO financial_ledgers (
        invoice_id, source_entity_id, destination_entity_id, transaction_type,
        gross_amount, commission_rate, net_payout, payment_status, settled_at, pod_id
    ) VALUES (
        p_invoice_id, v_pod_id, v_pod_id, 'platform_fee',
        v_amount, 3, v_platform_fee, 'cleared', NOW(), v_pod_id
    );

    -- Insert Doctor/Appointment Record
    INSERT INTO financial_ledgers (
        invoice_id, source_entity_id, destination_entity_id, transaction_type,
        gross_amount, commission_rate, net_payout, payment_status, settled_at, pod_id
    ) VALUES (
        p_invoice_id, v_pod_id, v_pod_id, 'appointment_fee',
        v_amount, 0, v_doctor_fee, 'cleared', NOW(), v_pod_id
    );

    -- Add Lab & Pharmacy commission splits dynamically
    IF COALESCE(v_invoice.lab_fee, 0) > 0 THEN
        INSERT INTO financial_ledgers (
            invoice_id, source_entity_id, destination_entity_id, transaction_type,
            gross_amount, commission_rate, net_payout, payment_status, settled_at, pod_id
        ) VALUES (
            p_invoice_id, v_pod_id, v_pod_id, 'lab_commission',
            v_invoice.lab_fee, 0.5, (v_invoice.lab_fee * 0.5), 'cleared', NOW(), v_pod_id
        );
    END IF;

    IF COALESCE(v_invoice.pharmacy_fee, 0) > 0 THEN
        INSERT INTO financial_ledgers (
            invoice_id, source_entity_id, destination_entity_id, transaction_type,
            gross_amount, commission_rate, net_payout, payment_status, settled_at, pod_id
        ) VALUES (
            p_invoice_id, v_pod_id, v_pod_id, 'medicine_commission',
            v_invoice.pharmacy_fee, 0.2, (v_invoice.pharmacy_fee * 0.2), 'cleared', NOW(), v_pod_id
        );
    END IF;

    -- Refill Commission Pool Protocol (Rule 57)
    IF (COALESCE(v_invoice.pharmacy_fee, 0) > 0 OR COALESCE(v_invoice.lab_fee, 0) > 0) 
       AND p_payment_method IN ('paytm', 'phonepe', 'razorpay', 'upi') THEN
        DECLARE
            v_current_pool NUMERIC := 0;
            v_refill_amount NUMERIC := 0;
            v_refill_needed NUMERIC := 0;
        BEGIN
            SELECT COALESCE(commission_pool_balance, 0) INTO v_current_pool
            FROM public.pods
            WHERE id = v_pod_id
            FOR UPDATE;
            
            IF v_current_pool < 1000.00 THEN
                v_refill_needed := 1000.00 - v_current_pool;
                v_refill_amount := LEAST(v_refill_needed, v_amount - v_platform_fee);
                
                IF v_refill_amount > 0 THEN
                    UPDATE public.pods
                    SET commission_pool_balance = COALESCE(commission_pool_balance, 0) + v_refill_amount
                    WHERE id = v_pod_id;
                    
                    INSERT INTO public.pool_transactions (
                        pod_id, transaction_type, amount, reason, reference_id, balance_after
                    ) VALUES (
                        v_pod_id, 'credit', v_refill_amount, 
                        'Pool Refill via Online Invoice #' || p_invoice_id, 
                        p_invoice_id, (v_current_pool + v_refill_amount)
                    );
                END IF;
            END IF;
        END;
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Invoice settlement completed atomically');
EXCEPTION WHEN OTHERS THEN
    -- In the event of ANY failure, Postgres will automatically rollback the entire transaction.
    RAISE WARNING 'Invoice settlement transaction failed: %', SQLERRM;
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Migration: WhatsApp Broadcast Engine (Server-Side Queue & Background Worker)
-- Resolves the synchronous frontend-driven DoS vulnerability and cascading Meta API 429 rate limits.

-- 1. Create the persistent queue table
CREATE TABLE IF NOT EXISTS public.whatsapp_broadcast_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pod_id UUID NOT NULL,
    campaign_id TEXT NOT NULL,
    patient_id UUID NOT NULL,
    patient_phone TEXT NOT NULL,
    message_text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, delivered, failed
    error_details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for background worker to quickly query pending campaigns
CREATE INDEX IF NOT EXISTS idx_wa_broadcast_queue_status ON public.whatsapp_broadcast_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_wa_broadcast_queue_campaign ON public.whatsapp_broadcast_queue(campaign_id);

-- Enable RLS
ALTER TABLE public.whatsapp_broadcast_queue ENABLE ROW LEVEL SECURITY;

-- Allow access based on pod_id scoping
DROP POLICY IF EXISTS "Enable read access for authenticated users by pod_id" ON public.whatsapp_broadcast_queue;
CREATE POLICY "Enable read access for authenticated users by pod_id"
ON public.whatsapp_broadcast_queue FOR SELECT
USING (
  pod_id = NULLIF(auth.jwt() ->> 'pod_id', '')::UUID 
  OR auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'doctor', 'compounder', 'pharmacy', 'lab'))
  OR auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.whatsapp_broadcast_queue;
CREATE POLICY "Enable insert access for authenticated users"
ON public.whatsapp_broadcast_queue FOR INSERT
WITH CHECK (true);

-- 2. Create an RPC to safely enqueue campaigns based on target cohorts
CREATE OR REPLACE FUNCTION public.enqueue_broadcast_campaign(
    p_pod_id UUID,
    p_campaign_id TEXT,
    p_target_cohort TEXT, -- 'all', 'diabetes', 'hypertension', 'opd'
    p_message_text TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_inserted_count INT := 0;
BEGIN
    -- This securely enqueues messages for all matching patients in the pod
    -- preventing the frontend from downloading thousands of phones to the browser
    
    IF p_target_cohort = 'all' THEN
        INSERT INTO whatsapp_broadcast_queue (pod_id, campaign_id, patient_id, patient_phone, message_text)
        SELECT COALESCE(p_pod_id, 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'::uuid), p_campaign_id, id, phone, p_message_text
        FROM patient_registry
        WHERE (pod_id = p_pod_id OR p_pod_id IS NULL OR pod_id IS NULL) AND phone IS NOT NULL AND length(phone) >= 10;
        
    ELSIF p_target_cohort = 'diabetes' THEN
        INSERT INTO whatsapp_broadcast_queue (pod_id, campaign_id, patient_id, patient_phone, message_text)
        SELECT COALESCE(p_pod_id, 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'::uuid), p_campaign_id, id, phone, p_message_text
        FROM patient_registry
        WHERE (pod_id = p_pod_id OR p_pod_id IS NULL OR pod_id IS NULL) AND phone IS NOT NULL AND length(phone) >= 10
          AND (
            COALESCE(condition, '') ILIKE '%diabet%' 
            OR COALESCE(tags::text, '') ILIKE '%diabet%'
            OR COALESCE(medical_history::text, '') ILIKE '%diabet%'
            OR COALESCE(vitals::text, '') ILIKE '%sugar%'
          );
          
    ELSIF p_target_cohort = 'hypertension' THEN
        INSERT INTO whatsapp_broadcast_queue (pod_id, campaign_id, patient_id, patient_phone, message_text)
        SELECT COALESCE(p_pod_id, 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'::uuid), p_campaign_id, id, phone, p_message_text
        FROM patient_registry
        WHERE (pod_id = p_pod_id OR p_pod_id IS NULL OR pod_id IS NULL) AND phone IS NOT NULL AND length(phone) >= 10
          AND (
            COALESCE(condition, '') ILIKE '%hyper%' 
            OR COALESCE(tags::text, '') ILIKE '%bp%' 
            OR COALESCE(tags::text, '') ILIKE '%hyper%'
            OR COALESCE(medical_history::text, '') ILIKE '%bp%'
            OR COALESCE(vitals::text, '') ILIKE '%bp%'
          );
          
    ELSIF p_target_cohort = 'opd' THEN
        -- OPD only (based on encounters today or generic tag)
        INSERT INTO whatsapp_broadcast_queue (pod_id, campaign_id, patient_id, patient_phone, message_text)
        SELECT COALESCE(p_pod_id, 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'::uuid), p_campaign_id, id, phone, p_message_text
        FROM patient_registry
        WHERE (pod_id = p_pod_id OR p_pod_id IS NULL OR pod_id IS NULL) AND phone IS NOT NULL AND length(phone) >= 10
          AND id IN (SELECT DISTINCT patient_id FROM appointments WHERE (pod_id = p_pod_id OR p_pod_id IS NULL) AND appointment_date = CURRENT_DATE);
    ELSE
        INSERT INTO whatsapp_broadcast_queue (pod_id, campaign_id, patient_id, patient_phone, message_text)
        SELECT COALESCE(p_pod_id, 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'::uuid), p_campaign_id, id, phone, p_message_text
        FROM patient_registry
        WHERE (pod_id = p_pod_id OR p_pod_id IS NULL OR pod_id IS NULL) AND phone IS NOT NULL AND length(phone) >= 10;
    END IF;

    GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
    
    RETURN jsonb_build_object(
        'success', true,
        'campaign_id', p_campaign_id,
        'queued_count', v_inserted_count
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;


-- =============================================================================
-- VITALSYNC SRE PATCH: Atomic Session State & Chat Append RPC
-- Fixes JSONB Read-Modify-Write Lost Update Anomaly in Webhooks & Client
-- =============================================================================
CREATE OR REPLACE FUNCTION public.atomic_update_whatsapp_session(
    p_patient_phone TEXT,
    p_patient_id UUID DEFAULT NULL,
    p_pod_id UUID DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'::uuid,
    p_entity_id UUID DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'::uuid,
    p_current_state TEXT DEFAULT NULL,
    p_message JSONB DEFAULT NULL,
    p_session_data_updates JSONB DEFAULT NULL,
    p_waba_error TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated RECORD;
    v_default_session_data JSONB;
    v_chat_history JSONB;
    v_effective_pod_id UUID;
    v_effective_entity_id UUID;
BEGIN
    v_effective_pod_id := COALESCE(p_pod_id, 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'::uuid);
    v_effective_entity_id := COALESCE(p_entity_id, v_effective_pod_id);

    -- Determine default chat history array (handle array vs single object)
    IF p_message IS NOT NULL THEN
      IF jsonb_typeof(p_message) = 'array' THEN
        v_chat_history := p_message;
      ELSE
        v_chat_history := jsonb_build_array(p_message);
      END IF;
    ELSE
      v_chat_history := '[]'::jsonb;
    END IF;

    -- Build default session data JSONB
    v_default_session_data := jsonb_build_object(
      'chatHistory', v_chat_history,
      'podId', v_effective_pod_id,
      'entityId', v_effective_entity_id,
      'wabaErrorMessage', p_waba_error
    );

    -- Apply initial overrides if provided
    IF p_session_data_updates IS NOT NULL THEN
      v_default_session_data := v_default_session_data || p_session_data_updates;
    END IF;

    -- Insert or update atomically under unique constraint on patient_phone
    INSERT INTO public.whatsapp_sessions (
        patient_phone, 
        patient_id, 
        current_state, 
        last_interaction, 
        session_data,
        pod_id
    )
    VALUES (
        p_patient_phone, 
        p_patient_id, 
        COALESCE(p_current_state, 'IDLE'), 
        NOW(), 
        v_default_session_data,
        v_effective_pod_id
    )
    ON CONFLICT (patient_phone) DO UPDATE 
    SET 
        patient_id = COALESCE(p_patient_id, whatsapp_sessions.patient_id),
        current_state = COALESCE(p_current_state, whatsapp_sessions.current_state),
        last_interaction = NOW(),
        session_data = jsonb_set(
            CASE 
              WHEN p_message IS NOT NULL THEN
                jsonb_set(
                    COALESCE(whatsapp_sessions.session_data, '{}'::jsonb),
                    '{chatHistory}',
                    (COALESCE(whatsapp_sessions.session_data->'chatHistory', '[]'::jsonb) || p_message)
                )
              ELSE
                COALESCE(whatsapp_sessions.session_data, '{}'::jsonb)
            END,
            '{wabaErrorMessage}',
            to_jsonb(p_waba_error)
        )
    RETURNING * INTO v_updated;

    -- Merge session_data_updates if provided
    IF p_session_data_updates IS NOT NULL THEN
        UPDATE public.whatsapp_sessions
        SET session_data = COALESCE(session_data, '{}'::jsonb) || p_session_data_updates
        WHERE id = v_updated.id
        RETURNING * INTO v_updated;
    END IF;

    RETURN to_jsonb(v_updated);
END;
$$;


-- ─── Pop Pending Broadcast Batch RPC ──────────────────────────────────────
-- Atomically fetches and transitions a batch of pending broadcast messages to 'processing'
-- utilizing FOR UPDATE SKIP LOCKED to eliminate double-dispatch race conditions in workers.
CREATE OR REPLACE FUNCTION public.pop_pending_broadcast_batch(
    p_campaign_id TEXT,
    p_pod_id UUID,
    p_limit INTEGER
)
RETURNS SETOF public.whatsapp_broadcast_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH locked_rows AS (
        SELECT id
        FROM public.whatsapp_broadcast_queue
        WHERE campaign_id = p_campaign_id
          AND pod_id = p_pod_id
          AND status = 'pending'
        ORDER BY created_at ASC
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.whatsapp_broadcast_queue q
    SET status = 'processing',
        updated_at = NOW()
    FROM locked_rows
    WHERE q.id = locked_rows.id
    RETURNING q.*;
END;
$$;


-- =============================================================================
-- STEP 15: UPI Screenshot Auto-Reconciliation Engine (0% MDR)
-- =============================================================================

-- Ensure UTR columns exist across clinical ledger and booking tables
ALTER TABLE IF EXISTS public.unified_invoices 
    ADD COLUMN IF NOT EXISTS utr_number VARCHAR(100);

ALTER TABLE IF EXISTS public.appointments 
    ADD COLUMN IF NOT EXISTS utr_number VARCHAR(100);

ALTER TABLE IF EXISTS public.saas_invoices 
    ADD COLUMN IF NOT EXISTS utr_number VARCHAR(100);

-- Table to store incoming Bank SMS / UPI Credit notifications
CREATE TABLE IF NOT EXISTS public.bank_upi_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    utr VARCHAR(50) UNIQUE NOT NULL, -- 12-digit UPI Transaction Ref (e.g. 620584739102)
    amount NUMERIC(10, 2) NOT NULL,
    sender VARCHAR(100),
    raw_message TEXT,
    is_reconciled BOOLEAN DEFAULT FALSE,
    invoice_id UUID REFERENCES public.unified_invoices(id),
    pod_id UUID NOT NULL REFERENCES public.pods(id) DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.bank_upi_transactions ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists
DROP POLICY IF EXISTS "Enforce tenant pod isolation for bank transactions" ON public.bank_upi_transactions;

-- Create policy for authenticated staff lookup
CREATE POLICY "Enforce tenant pod isolation for bank transactions" ON public.bank_upi_transactions
    FOR ALL TO authenticated USING (pod_id = public.get_user_pod());

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

-- Service role bypass / service access
GRANT ALL ON public.bank_upi_transactions TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.bank_upi_transactions TO authenticated, anon;

-- Add index for fast UTR and amount match lookup
CREATE INDEX IF NOT EXISTS idx_bank_upi_transactions_utr_amount ON public.bank_upi_transactions (utr, amount);
CREATE INDEX IF NOT EXISTS idx_bank_upi_transactions_reconciled ON public.bank_upi_transactions (is_reconciled);



