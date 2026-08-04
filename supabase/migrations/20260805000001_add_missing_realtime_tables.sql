-- =============================================================================
-- 20260805000001: Add Missing Tables for Realtime Sync (Production Readiness)
-- =============================================================================
-- Tables required by RealtimeSyncService but missing from schema:
-- 1. pathology_reports - Lab report approvals and results
-- 2. vitalsync_pool_settlements - Pool settlement tracking for commission payouts
-- 3. saas_invoices - Platform-level invoice tracking
-- 4. saas_prescriptions - Platform-level prescription tracking
-- =============================================================================

-- =============================================================================
-- 1. PATHOLOGY REPORTS TABLE
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
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
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

-- =============================================================================
-- 2. VITALSYNC POOL SETTLEMENTS TABLE
-- =============================================================================
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
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
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

-- =============================================================================
-- 3. SAAS INVOICES TABLE (Platform-level invoice tracking)
-- =============================================================================
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
    status VARCHAR(50) DEFAULT 'unpaid', -- unpaid, paid, disputed
    payment_status VARCHAR(50) DEFAULT 'pending',
    payment_method VARCHAR(50),
    type VARCHAR(50), -- consult, lab, pharmacy, ot, gp_procedure
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

-- =============================================================================
-- 4. SAAS PRESCRIPTIONS TABLE (Platform-level prescription tracking)
-- =============================================================================
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

-- =============================================================================
-- UPDATED_AT TRIGGERS FOR ALL NEW TABLES
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pathology_reports_updated_at ON public.pathology_reports;
CREATE TRIGGER trg_pathology_reports_updated_at
    BEFORE UPDATE ON public.pathology_reports
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_vitalsync_pool_settlements_updated_at ON public.vitalsync_pool_settlements;
CREATE TRIGGER trg_vitalsync_pool_settlements_updated_at
    BEFORE UPDATE ON public.vitalsync_pool_settlements
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_saas_invoices_updated_at ON public.saas_invoices;
CREATE TRIGGER trg_saas_invoices_updated_at
    BEFORE UPDATE ON public.saas_invoices
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_saas_prescriptions_updated_at ON public.saas_prescriptions;
CREATE TRIGGER trg_saas_prescriptions_updated_at
    BEFORE UPDATE ON public.saas_prescriptions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- ADD TABLES TO SUPABASE REALTIME PUBLICATION
-- =============================================================================
DO $$
BEGIN
    -- Check if publication exists and add tables
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.pathology_reports';
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.vitalsync_pool_settlements';
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.saas_invoices';
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.saas_prescriptions';
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Tables might already be in publication
    RAISE NOTICE 'Tables may already be in realtime publication or publication does not exist';
END $$;