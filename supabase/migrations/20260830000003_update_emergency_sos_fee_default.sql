-- ============================================================================
-- VitalSync Migration: 20260830000001_update_emergency_sos_fee_default.sql
-- Description: Ensures emergency_sos_fee is dynamically set as Consultation Fee + 20%
-- ============================================================================

DO $$
BEGIN
    -- Update existing clinic_sops where emergency_sos_fee is not explicitly set
    -- by calculating doctor_fee * 1.20 (Consultation Fee + 20%)
    UPDATE public.clinic_sops
    SET extracted_config = jsonb_set(
        extracted_config,
        '{emergency_sos_fee}',
        to_jsonb(ROUND(COALESCE((extracted_config->>'doctor_fee')::numeric * 1.20, 600.00), 2))
    )
    WHERE extracted_config IS NOT NULL
      AND (extracted_config->>'emergency_sos_fee' IS NULL OR (extracted_config->>'emergency_sos_fee')::numeric = 0);
END $$;
