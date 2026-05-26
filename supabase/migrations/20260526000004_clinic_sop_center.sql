-- Mediflow Connected Care Ecosystem v2.1 - Clinic SOP (Standard Operating Procedure) Center
-- Creates the clinic_sops table to store AI-extracted per-clinic configuration (fees, splits, guidelines)

-- 1. Create the clinic_sops table
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

-- 2. Enable RLS
ALTER TABLE public.clinic_sops ENABLE ROW LEVEL SECURITY;

-- 3. Apply pod isolation policy
DROP POLICY IF EXISTS "Enforce tenant pod isolation" ON public.clinic_sops;
CREATE POLICY "Enforce tenant pod isolation" ON public.clinic_sops
    FOR ALL TO authenticated
    USING (
        entity_id IN (
            SELECT id FROM public.entities WHERE pod_id = public.get_user_pod()
        )
    );

-- 4. Seed the default SOP for the pilot clinic (Kankarbagh Connected Clinic)
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

-- 5. Refresh on_encounter_submitted to read from SOP for doctor fee & test prices
-- (Already updated in 20260526000003 — no-op here, just documenting the dependency)
