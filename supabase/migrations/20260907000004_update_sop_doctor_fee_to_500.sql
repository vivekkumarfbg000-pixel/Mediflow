-- =========================================================================================
-- VitalSync Enterprise Migration: 20260907000004_update_sop_doctor_fee_to_500.sql
-- Description: Standardize Clinic SOP doctor consultation fee to flat 500.00
-- Directives: Rule 58, Rule 103 (Doctor Consultation Fee Immunity, 0% Platform Fee, Flat ₹500.00)
-- =========================================================================================

-- 1. Standardize snake_case extracted_config.doctor_fee to 500.00
UPDATE public.clinic_sops
SET extracted_config = jsonb_set(
  COALESCE(extracted_config, '{}'::jsonb),
  '{doctor_fee}',
  '500.00'::jsonb
)
WHERE extracted_config IS NULL 
   OR extracted_config->>'doctor_fee' = '450' 
   OR extracted_config->>'doctor_fee' = '450.00'
   OR (extracted_config->>'doctor_fee')::numeric < 500;

-- 2. Update active SOP text rules to reflect INR 500 and 0% consultation platform fee
UPDATE public.clinic_sops
SET sop_text = REPLACE(sop_text, 'Doctor Consultation Fee: INR 450', 'Doctor Consultation Fee: INR 500')
WHERE sop_text LIKE '%Doctor Consultation Fee: INR 450%';

