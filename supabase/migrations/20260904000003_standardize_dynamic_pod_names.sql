-- ==============================================================================
-- Migration: Standardize Dynamic Pod Names & In-App Identity Schema
-- Migration ID: 20260904000001_standardize_dynamic_pod_names.sql
-- Purpose: Ensures idempotent schema columns (upi_vpa, gstin, doctor_name)
--          on public.pods and standardizes default sovereign pod naming.
-- ==============================================================================

-- 1. Ensure pods table has identity columns for direct in-app customization
ALTER TABLE public.pods ADD COLUMN IF NOT EXISTS upi_vpa TEXT DEFAULT 'vitalsync@axl';
ALTER TABLE public.pods ADD COLUMN IF NOT EXISTS gstin TEXT DEFAULT '10AAAAA0000A1Z5';
ALTER TABLE public.pods ADD COLUMN IF NOT EXISTS doctor_name TEXT;

-- 2. Standardize default sovereign pod naming away from legacy dummy placeholders
UPDATE public.pods
SET 
  name = 'VitalSync Smart PolyClinic',
  location = 'Line Bazar, Purnea, Bihar',
  upi_vpa = COALESCE(upi_vpa, 'vitalsync@axl'),
  gstin = COALESCE(gstin, '10AAAAA0000A1Z5'),
  clinic_code = 'VS-V01R',
  is_active = true,
  health_score = 100,
  is_verified_for_billing = true
WHERE id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001' 
   OR clinic_code = 'VS-V01R'
   OR name IN ('Apex Care Pod & PolyClinic', 'Apex Eye & Dental Care Clinic', 'Kankarbagh Medical Pod, Patna');

-- 3. Standardize primary clinic entity
UPDATE public.entities
SET 
  name = 'VitalSync Smart PolyClinic OPD',
  address = 'Line Bazar, Purnea, Bihar',
  gstin = COALESCE(gstin, '10AAAAA0000A1Z5'),
  status = 'approved',
  is_active = true
WHERE pod_id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001' AND entity_type = 'clinic';

-- 4. Notify Realtime CDC
DO $$
BEGIN
  BEGIN
    PERFORM pg_notify('supabase_realtime', json_build_object(
      'table', 'pods',
      'action', 'UPDATE',
      'id', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'
    )::text);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;
