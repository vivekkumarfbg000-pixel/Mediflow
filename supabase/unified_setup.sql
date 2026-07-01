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
-- STEP 2: WhatsApp Business API (WABA) Multi-Tenant Schema & Cryptography
-- =============================================================================

-- Enable pgcrypto if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Create the waba_connections table
CREATE TABLE IF NOT EXISTS public.waba_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pod_id UUID NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
    phone_number_id VARCHAR(255) UNIQUE NOT NULL,
    waba_id VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(50) UNIQUE NOT NULL,
    encrypted_system_user_token BYTEA NOT NULL,
    waba_status VARCHAR(50) DEFAULT 'pending',
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.waba_connections ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

ALTER TABLE public.waba_connections ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Allow pod authenticated select" ON public.waba_connections';
  EXECUTE 'CREATE POLICY "Allow pod authenticated select" ON public.waba_connections FOR SELECT TO authenticated USING (auth.jwt() ->> ''pod_id'' = pod_id::text)';

  EXECUTE 'DROP POLICY IF EXISTS "Allow pod authenticated insert" ON public.waba_connections';
  EXECUTE 'CREATE POLICY "Allow pod authenticated insert" ON public.waba_connections FOR INSERT TO authenticated WITH CHECK (auth.jwt() ->> ''pod_id'' = pod_id::text)';

  EXECUTE 'DROP POLICY IF EXISTS "Allow pod authenticated update" ON public.waba_connections';
  EXECUTE 'CREATE POLICY "Allow pod authenticated update" ON public.waba_connections FOR UPDATE TO authenticated USING (auth.jwt() ->> ''pod_id'' = pod_id::text)';
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

REVOKE EXECUTE ON FUNCTION public.execute_autonomous_db_repair(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.execute_autonomous_db_repair(TEXT, TEXT, TEXT) TO authenticated;

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
BEGIN
    IF TG_OP = 'UPDATE' AND (OLD.status = 'completed' OR NEW.status != 'completed') THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'INSERT' AND NEW.status != 'completed' THEN
        RETURN NEW;
    END IF;

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

        INSERT INTO public.lab_requisitions (encounter_id, patient_id, lab_entity_id, loinc_code, test_name, barcode, assigned_technician_id)
        VALUES (NEW.id, NEW.patient_id, v_lab_entity_id, diag.loinc_code, diag.test_name,
                'BAR-' || upper(substring(NEW.id::text, 1, 8)) || '-' || diag.loinc_code,
                'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002');
                
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
                    batch_number, expiry_date, hold_status
                ) VALUES (
                    v_pharmacy_entity_id, NEW.id, NEW.patient_id, med.medicine_name, med.dosage, allocated_qty,
                    cur_batch.batch_number, cur_batch.expiry_date, 'held'
                );

                remaining_qty := remaining_qty - allocated_qty;
            END LOOP;

            IF remaining_qty > 0 THEN
                IF remaining_qty = needed_qty THEN
                    INSERT INTO public.inventory_holds (
                        pharmacy_entity_id, encounter_id, patient_id, medicine_name, dosage, quantity,
                        batch_number, expiry_date, hold_status
                    ) VALUES (
                        v_pharmacy_entity_id, NEW.id, NEW.patient_id, med.medicine_name, med.dosage, remaining_qty,
                        'OUT_OF_STOCK', NULL, 'held'
                    );
                ELSE
                    INSERT INTO public.inventory_holds (
                        pharmacy_entity_id, encounter_id, patient_id, medicine_name, dosage, quantity,
                        batch_number, expiry_date, hold_status
                    ) VALUES (
                        v_pharmacy_entity_id, NEW.id, NEW.patient_id, med.medicine_name, med.dosage, remaining_qty,
                        'SHORTAGE', NULL, 'held'
                    );
                END IF;

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
         'upi://pay?pa=vitalsync@icici&pn=VitalSync&am=' || total || '&cu=INR&tn=VitalSync-' || NEW.id);

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
