-- =============================================================================
-- Migration: Clean Orphan Pods & Set Primary Pod to Apex Eye & Dental Care (MF-001)
-- Migration ID: 20260903000008_clean_orphan_pods_and_set_apex_mf001
-- =============================================================================

-- 1. Ensure the primary pilot pod is officially Apex Eye & Dental Care Clinic (MF-001)
UPDATE public.pods 
SET 
  name = 'Apex Eye & Dental Care Clinic',
  clinic_code = 'MF-001',
  location = 'Line Bazar, Purnea',
  doctor_name = 'Dr. Vivek Kumar',
  platform_fee_percent = 3.00,
  daily_cost_budget = 500.00,
  is_verified_for_billing = true,
  health_score = 100,
  active_errors_count = 0,
  is_active = true
WHERE id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

-- If it didn't exist, insert it
INSERT INTO public.pods (
  id, name, clinic_code, location, doctor_name, platform_fee_percent, is_active
) VALUES (
  'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
  'Apex Eye & Dental Care Clinic',
  'MF-001',
  'Line Bazar, Purnea',
  'Dr. Vivek Kumar',
  3.00,
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = 'Apex Eye & Dental Care Clinic',
  clinic_code = 'MF-001',
  location = 'Line Bazar, Purnea',
  doctor_name = 'Dr. Vivek Kumar',
  platform_fee_percent = 3.00,
  is_active = true;

-- 2. Clean up all orphan / test dummy pods (keeping ONLY Apex Eye & Dental Care Clinic)
-- Unlink profiles from non-primary pods
UPDATE public.profiles 
SET entity_id = NULL 
WHERE entity_id IN (
  SELECT id FROM public.entities WHERE pod_id != 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'
);

-- Delete dependent records of test dummy pods
DELETE FROM public.vitalsync_pool_settlements WHERE pod_id != 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
DELETE FROM public.financial_ledgers WHERE pod_id != 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
DELETE FROM public.unified_invoices WHERE pod_id != 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
DELETE FROM public.appointments WHERE pod_id != 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
DELETE FROM public.whatsapp_sessions WHERE pod_id != 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
DELETE FROM public.whatsapp_billing_logs WHERE pod_id != 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
DELETE FROM public.clinic_sops WHERE pod_id != 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
DELETE FROM public.inventory_holds WHERE pod_id != 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
DELETE FROM public.medicine_bills WHERE pod_id != 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
DELETE FROM public.lab_requisitions WHERE pod_id != 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
DELETE FROM public.patient_registry WHERE pod_id != 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
DELETE FROM public.waba_connections WHERE pod_id != 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
DELETE FROM public.system_health_telemetry WHERE pod_id != 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

-- Delete entities belonging to test dummy pods
DELETE FROM public.entities WHERE pod_id != 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

-- Delete all test pods themselves
DELETE FROM public.pods WHERE id != 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

-- 3. Update primary entities under Apex Eye & Dental Care Clinic
UPDATE public.entities
SET pod_id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'
WHERE id IN ('dfb2a1a8-8e68-4f8a-929e-4a6c8e317002', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317003', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317004');
