-- =============================================================================
-- Migration: Master Operational Resilience & Multi-Console Schema Alignment
-- Migration ID: 20260903000005_master_operational_resilience_and_schema_alignment
-- =============================================================================

-- 1. Operational Activity Logs & System Telemetry Alignment
ALTER TABLE public.activity_logs 
  ADD COLUMN IF NOT EXISTS action VARCHAR(100),
  ADD COLUMN IF NOT EXISTS event_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.system_health_telemetry 
  ADD COLUMN IF NOT EXISTS latency_ms INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS response_time_ms INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS incident_type VARCHAR(100) DEFAULT 'incident',
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS error_log TEXT;

-- 2. Patient Consents & Encounters Alignment
ALTER TABLE public.patient_consents 
  ADD COLUMN IF NOT EXISTS consented_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.encounters 
  ADD COLUMN IF NOT EXISTS vitals JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS symptoms TEXT,
  ADD COLUMN IF NOT EXISTS diagnosis TEXT,
  ADD COLUMN IF NOT EXISTS advice TEXT,
  ADD COLUMN IF NOT EXISTS follow_up_date VARCHAR(50),
  ADD COLUMN IF NOT EXISTS treatment_plan TEXT;

-- 3. Billing & Invoice Status Symmetry (Ensures status vs payment_status never crashes)
ALTER TABLE public.medicine_bills 
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'paid';

ALTER TABLE public.unified_invoices 
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'paid';

-- 4. Clinic SOPs, Entities & Pharmacy Inventory Holds Alignment
ALTER TABLE public.clinic_sops 
  ADD COLUMN IF NOT EXISTS raw_text TEXT;

ALTER TABLE public.entities 
  ADD COLUMN IF NOT EXISTS type VARCHAR(50);

ALTER TABLE public.inventory_holds 
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours');

ALTER TABLE public.seasonal_demand_forecasts 
  ADD COLUMN IF NOT EXISTS confidence NUMERIC(3,2) DEFAULT 0.85,
  ADD COLUMN IF NOT EXISTS predicted_demand INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS month VARCHAR(50);

-- 5. Trigger / Backfill to keep status and payment_status synchronized
DO $$ 
BEGIN
  -- Synchronize existing unified_invoices status column from payment_status
  UPDATE public.unified_invoices 
  SET status = payment_status 
  WHERE status IS NULL OR status = 'paid';

  -- Synchronize existing medicine_bills payment_status from status
  UPDATE public.medicine_bills 
  SET payment_status = status 
  WHERE payment_status IS NULL OR payment_status = 'paid';

  -- Synchronize entities.type from entity_type
  UPDATE public.entities 
  SET type = entity_type 
  WHERE type IS NULL;
END $$;
