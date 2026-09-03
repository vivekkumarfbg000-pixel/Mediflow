-- =============================================================================
-- Migration: Harmonize Lab Requisitions, Pathology Reports & Ledger Payout (Zero Dummy Data)
-- Migration ID: 20260903000010_harmonize_lab_requisitions_and_ledger_payout
-- =============================================================================

-- 1. Add test_code alias to lab_requisitions and relax loinc_code NOT-NULL
ALTER TABLE public.lab_requisitions 
  ADD COLUMN IF NOT EXISTS test_code VARCHAR(100),
  ADD COLUMN IF NOT EXISTS reagent_deductions JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.lab_requisitions 
  ALTER COLUMN loinc_code DROP NOT NULL;

UPDATE public.lab_requisitions 
SET loinc_code = COALESCE(loinc_code, test_code)
WHERE loinc_code IS NULL;

UPDATE public.lab_requisitions 
SET test_code = COALESCE(test_code, loinc_code)
WHERE test_code IS NULL;

-- 2. Relax net_payout NOT-NULL on financial_ledgers & set default 0.00
ALTER TABLE public.financial_ledgers 
  ALTER COLUMN net_payout DROP NOT NULL;

ALTER TABLE public.financial_ledgers 
  ALTER COLUMN net_payout SET DEFAULT 0.00;

-- 3. Add aliases to pathology_reports to prevent missing column errors
ALTER TABLE public.pathology_reports 
  ADD COLUMN IF NOT EXISTS results TEXT,
  ADD COLUMN IF NOT EXISTS doctor_notes TEXT,
  ADD COLUMN IF NOT EXISTS verified_by UUID,
  ADD COLUMN IF NOT EXISTS file_url TEXT;

UPDATE public.pathology_reports 
SET file_url = COALESCE(file_url, report_file_url)
WHERE file_url IS NULL;

UPDATE public.pathology_reports 
SET report_file_url = COALESCE(report_file_url, file_url)
WHERE report_file_url IS NULL;

-- 4. Relax doctor_id on chronic_care_cohorts
ALTER TABLE public.chronic_care_cohorts 
  ALTER COLUMN doctor_id DROP NOT NULL;

-- 5. Expand financial_ledgers transaction_type check constraint
ALTER TABLE public.financial_ledgers 
  DROP CONSTRAINT IF EXISTS financial_ledgers_transaction_type_check;

ALTER TABLE public.financial_ledgers 
  ADD CONSTRAINT financial_ledgers_transaction_type_check 
  CHECK (transaction_type IN (
    'appointment_fee', 'platform_fee', 'lab_commission', 'medicine_commission',
    'doctor_payout', 'pharmacy_payout', 'lab_payout', 'credit', 'debit',
    'consultation', 'medicine', 'lab_test', 'commission', 'refund'
  ));
