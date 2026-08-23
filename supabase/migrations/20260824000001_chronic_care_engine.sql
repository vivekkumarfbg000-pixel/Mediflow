-- ==============================================================================
-- Migration: 20260824000001_chronic_care_engine.sql
-- Description: Multi-Chronic Disease Care & Recurring Refill Goldmine Engine
-- Author: VitalSync Autonomous Taskforce
-- ==============================================================================

CREATE TABLE IF NOT EXISTS chronic_care_cohorts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id TEXT NOT NULL,
    patient_name TEXT NOT NULL,
    patient_phone TEXT,
    doctor_id TEXT NOT NULL,
    pod_id TEXT NOT NULL,
    condition_code TEXT NOT NULL, -- 'DIABETES', 'HYPERTENSION', 'THYROID', 'CARDIAC', 'RESPIRATORY', 'CKD', 'ARTHRITIS', 'EPILEPSY'
    condition_name TEXT NOT NULL,
    medications JSONB NOT NULL DEFAULT '[]'::jsonb,
    days_supply INT NOT NULL DEFAULT 30,
    dispensed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    next_refill_date DATE NOT NULL,
    next_retest_date DATE,
    retest_test_code TEXT, -- e.g. '4544-3' for HbA1c, '2160-0' for Creatinine
    retest_test_name TEXT,
    adherence_score NUMERIC(5,2) DEFAULT 100.00,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'due_refill', 'defaulter_7d', 'defaulter_15d', 'resolved'
    monthly_medicine_spend NUMERIC(10,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexing for sub-300ms live lookups and CDC queries
CREATE INDEX IF NOT EXISTS idx_chronic_cohorts_patient ON chronic_care_cohorts(patient_id);
CREATE INDEX IF NOT EXISTS idx_chronic_cohorts_pod ON chronic_care_cohorts(pod_id);
CREATE INDEX IF NOT EXISTS idx_chronic_cohorts_condition ON chronic_care_cohorts(condition_code);
CREATE INDEX IF NOT EXISTS idx_chronic_cohorts_next_refill ON chronic_care_cohorts(next_refill_date);
CREATE INDEX IF NOT EXISTS idx_chronic_cohorts_status ON chronic_care_cohorts(status);

-- Chronic Adherence Logs
CREATE TABLE IF NOT EXISTS chronic_adherence_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort_id UUID REFERENCES chronic_care_cohorts(id) ON DELETE CASCADE,
    patient_id TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'REFILL_NUDGE_SENT', 'REFILL_CONFIRMED', 'DOSE_CONFIRMED', 'MISSED_DOSE', 'LAB_RETEST_BOOKED', 'LAB_RETEST_COMPLETED'
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_adherence_logs_cohort ON chronic_adherence_logs(cohort_id);

-- Enable Row Level Security (RLS)
ALTER TABLE chronic_care_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE chronic_adherence_logs ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'chronic_care_cohorts' AND policyname = 'allow_authenticated_all_chronic_cohorts'
    ) THEN
        CREATE POLICY allow_authenticated_all_chronic_cohorts ON chronic_care_cohorts 
        FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'chronic_adherence_logs' AND policyname = 'allow_authenticated_all_chronic_logs'
    ) THEN
        CREATE POLICY allow_authenticated_all_chronic_logs ON chronic_adherence_logs 
        FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
    END IF;
END $$;

-- RPC: Assert Chronic Refill
CREATE OR REPLACE FUNCTION process_chronic_refill_assertion(
    p_cohort_id UUID,
    p_action TEXT DEFAULT 'confirm_refill'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cohort chronic_care_cohorts%ROWTYPE;
    v_new_refill_date DATE;
    v_new_dispensed_at TIMESTAMPTZ := now();
BEGIN
    SELECT * INTO v_cohort FROM chronic_care_cohorts WHERE id = p_cohort_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cohort not found');
    END IF;

    IF p_action = 'confirm_refill' THEN
        v_new_refill_date := CURRENT_DATE + (v_cohort.days_supply || ' days')::INTERVAL;
        
        UPDATE chronic_care_cohorts
        SET dispensed_at = v_new_dispensed_at,
            next_refill_date = v_new_refill_date,
            status = 'active',
            adherence_score = LEAST(100.00, COALESCE(adherence_score, 90.00) + 5.00),
            updated_at = now()
        WHERE id = p_cohort_id;

        INSERT INTO chronic_adherence_logs (cohort_id, patient_id, event_type, details)
        VALUES (p_cohort_id, v_cohort.patient_id, 'REFILL_CONFIRMED', jsonb_build_object(
            'previous_refill_date', v_cohort.next_refill_date,
            'new_refill_date', v_new_refill_date,
            'days_supply', v_cohort.days_supply
        ));

        RETURN jsonb_build_object(
            'success', true,
            'patient_id', v_cohort.patient_id,
            'next_refill_date', v_new_refill_date,
            'status', 'active'
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Action logged');
END;
$$;
