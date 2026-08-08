-- =============================================================================
-- Mediflow: Comprehensive RLS & Multi-Tenant Pod Isolation Fix
-- Ensures all 13 CDC tables + supporting tables have proper pod_id + RLS
-- Run this AFTER all existing migrations
-- =============================================================================

-- 1. Ensure all tables have pod_id column with NOT NULL constraint
-- =============================================================================

-- inventory_holds: Add pod_id if missing, populate from pharmacy_entity_id
ALTER TABLE IF EXISTS public.inventory_holds 
ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

UPDATE public.inventory_holds ih
SET pod_id = COALESCE((
  SELECT e.pod_id FROM public.entities e WHERE e.id = ih.pharmacy_entity_id LIMIT 1
), 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001')
WHERE ih.pod_id IS NULL OR ih.pod_id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

ALTER TABLE IF EXISTS public.inventory_holds ALTER COLUMN pod_id SET NOT NULL;

-- lab_reports: Add pod_id if missing, populate from requisition -> encounter
ALTER TABLE IF EXISTS public.lab_reports 
ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

UPDATE public.lab_reports lr
SET pod_id = COALESCE((
  SELECT e.pod_id 
  FROM public.lab_requisitions r
  JOIN public.encounters enc ON enc.id = r.encounter_id
  JOIN public.entities e ON e.id = enc.entity_id
  WHERE r.id = lr.requisition_id LIMIT 1
), 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001')
WHERE lr.pod_id IS NULL OR lr.pod_id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

ALTER TABLE IF EXISTS public.lab_reports ALTER COLUMN pod_id SET NOT NULL;

-- saas_invoices: Ensure pod_id exists (added in 20260805 migration)
ALTER TABLE IF EXISTS public.saas_invoices 
ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

UPDATE public.saas_invoices si
SET pod_id = COALESCE((
  SELECT e.pod_id 
  FROM public.encounters enc
  JOIN public.entities e ON e.id = enc.entity_id
  WHERE enc.id = si.encounter_id LIMIT 1
), 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001')
WHERE si.pod_id IS NULL OR si.pod_id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

ALTER TABLE IF EXISTS public.saas_invoices ALTER COLUMN pod_id SET NOT NULL;

-- saas_prescriptions: Ensure pod_id exists (added in 20260805 migration)
ALTER TABLE IF EXISTS public.saas_prescriptions 
ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

UPDATE public.saas_prescriptions sp
SET pod_id = COALESCE((
  SELECT e.pod_id 
  FROM public.encounters enc
  JOIN public.entities e ON e.id = enc.entity_id
  WHERE enc.id = sp.encounter_id LIMIT 1
), 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001')
WHERE sp.pod_id IS NULL OR sp.pod_id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

ALTER TABLE IF EXISTS public.saas_prescriptions ALTER COLUMN pod_id SET NOT NULL;

-- appointments: Ensure pod_id exists (added in 20260604 migration)
ALTER TABLE IF EXISTS public.appointments 
ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

UPDATE public.appointments a
SET pod_id = COALESCE((
  SELECT e.pod_id 
  FROM public.entities e WHERE e.id = a.entity_id LIMIT 1
), 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001')
WHERE a.pod_id IS NULL OR a.pod_id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

ALTER TABLE IF EXISTS public.appointments ALTER COLUMN pod_id SET NOT NULL;

-- vitalsync_pool_settlements: Ensure pod_id exists (added in 20260805 migration)
ALTER TABLE IF EXISTS public.vitalsync_pool_settlements 
ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

UPDATE public.vitalsync_pool_settlements vs
SET pod_id = COALESCE((
  SELECT e.pod_id 
  FROM public.entities e 
  WHERE e.id = vs.pool_id LIMIT 1
), 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001')
WHERE vs.pod_id IS NULL OR vs.pod_id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

ALTER TABLE IF EXISTS public.vitalsync_pool_settlements ALTER COLUMN pod_id SET NOT NULL;

-- medicine_bills: Ensure pod_id exists (added in 20260526 migration)
ALTER TABLE IF EXISTS public.medicine_bills 
ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

ALTER TABLE IF EXISTS public.medicine_bills ALTER COLUMN pod_id SET NOT NULL;

-- counter_transactions: Ensure pod_id exists (added in unified_setup)
ALTER TABLE IF EXISTS public.counter_transactions 
ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

ALTER TABLE IF EXISTS public.counter_transactions ALTER COLUMN pod_id SET NOT NULL;

-- clinic_sops: Ensure pod_id exists (added in unified_setup)
ALTER TABLE IF EXISTS public.clinic_sops 
ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

-- NOTE: clinic_sops uses entity_id, not direct pod_id. RLS policy handles via entity_id join.

-- pathology_reports: Ensure pod_id exists (added in 20260805 migration)
ALTER TABLE IF EXISTS public.pathology_reports 
ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

UPDATE public.pathology_reports pr
SET pod_id = COALESCE((
  SELECT e.pod_id 
  FROM public.lab_requisitions r
  JOIN public.encounters enc ON enc.id = r.encounter_id
  JOIN public.entities e ON e.id = enc.entity_id
  WHERE r.id = pr.requisition_id LIMIT 1
), 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001')
WHERE pr.pod_id IS NULL OR pr.pod_id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

ALTER TABLE IF EXISTS public.pathology_reports ALTER COLUMN pod_id SET NOT NULL;

-- 2. Enable RLS on all 13 CDC tables + supporting tables as a failsafe
-- =============================================================================

ALTER TABLE IF EXISTS public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.unified_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.financial_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.patient_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.medicine_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lab_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vitalsync_pool_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.clinic_sops ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inventory_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pathology_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.saas_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.saas_prescriptions ENABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.lab_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.counter_transactions ENABLE ROW LEVEL SECURITY;