-- Mediflow Connected Care Ecosystem v2.0 Database Upgrade Migration
-- Establish high-performance direct pod_id Row-Level Security (RLS) policies

-- 1. Helper function to query the active pod UUID of the authenticated user session
CREATE OR REPLACE FUNCTION public.get_user_pod()
RETURNS UUID AS $$
  SELECT pod_id FROM public.entities WHERE id = (
    SELECT entity_id FROM public.profiles WHERE id = auth.uid()
  ) LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. Add pod_id UUID column with fallback default to all transactional tables
ALTER TABLE public.patient_registry ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
ALTER TABLE public.encounters ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
ALTER TABLE public.lab_requisitions ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
ALTER TABLE public.unified_invoices ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
ALTER TABLE public.financial_ledgers ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
ALTER TABLE public.whatsapp_sessions ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
ALTER TABLE public.clinic_staff ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

-- 3. Populate existing records based on parent-child reference chains
UPDATE public.patient_registry pr SET pod_id = COALESCE((SELECT pod_id FROM public.entities e WHERE e.id = pr.registered_at_entity LIMIT 1), 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001');
UPDATE public.encounters enc SET pod_id = COALESCE((SELECT pod_id FROM public.entities e WHERE e.id = enc.entity_id LIMIT 1), 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001');
UPDATE public.lab_requisitions lr SET pod_id = COALESCE((SELECT pod_id FROM public.encounters enc WHERE enc.id = lr.encounter_id LIMIT 1), 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001');
UPDATE public.unified_invoices ui SET pod_id = COALESCE((SELECT pod_id FROM public.encounters enc WHERE enc.id = ui.encounter_id LIMIT 1), 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001');
UPDATE public.financial_ledgers fl SET pod_id = COALESCE((SELECT pod_id FROM public.entities e WHERE e.id = fl.source_entity_id LIMIT 1), 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001');
UPDATE public.whatsapp_sessions ws SET pod_id = COALESCE((SELECT pod_id FROM public.patient_registry pr WHERE pr.id = ws.patient_id LIMIT 1), 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001');
UPDATE public.activity_logs al SET pod_id = COALESCE((SELECT pod_id FROM public.entities e WHERE e.id = al.entity_id LIMIT 1), 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001');
UPDATE public.clinic_staff cs SET pod_id = COALESCE((SELECT pod_id FROM public.entities e WHERE e.id = cs.entity_id LIMIT 1), 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001');

-- 4. Apply strict NOT NULL constraints
ALTER TABLE public.patient_registry ALTER COLUMN pod_id SET NOT NULL;
ALTER TABLE public.encounters ALTER COLUMN pod_id SET NOT NULL;
ALTER TABLE public.lab_requisitions ALTER COLUMN pod_id SET NOT NULL;
ALTER TABLE public.unified_invoices ALTER COLUMN pod_id SET NOT NULL;
ALTER TABLE public.financial_ledgers ALTER COLUMN pod_id SET NOT NULL;
ALTER TABLE public.whatsapp_sessions ALTER COLUMN pod_id SET NOT NULL;
ALTER TABLE public.activity_logs ALTER COLUMN pod_id SET NOT NULL;
ALTER TABLE public.clinic_staff ALTER COLUMN pod_id SET NOT NULL;

-- 5. Drop old join-dependent RLS policies and apply high-performance direct RLS policies
DROP POLICY IF EXISTS "Enforce tenant pod isolation" ON public.patient_registry;
CREATE POLICY "Enforce tenant pod isolation" ON public.patient_registry FOR ALL TO authenticated USING (pod_id = public.get_user_pod());

DROP POLICY IF EXISTS "Enforce tenant pod isolation" ON public.encounters;
CREATE POLICY "Enforce tenant pod isolation" ON public.encounters FOR ALL TO authenticated USING (pod_id = public.get_user_pod());

DROP POLICY IF EXISTS "Enforce tenant pod isolation" ON public.lab_requisitions;
CREATE POLICY "Enforce tenant pod isolation" ON public.lab_requisitions FOR ALL TO authenticated USING (pod_id = public.get_user_pod());

DROP POLICY IF EXISTS "Enforce tenant pod isolation" ON public.unified_invoices;
CREATE POLICY "Enforce tenant pod isolation" ON public.unified_invoices FOR ALL TO authenticated USING (pod_id = public.get_user_pod());

DROP POLICY IF EXISTS "Enforce tenant pod isolation" ON public.financial_ledgers;
CREATE POLICY "Enforce tenant pod isolation" ON public.financial_ledgers FOR ALL TO authenticated USING (pod_id = public.get_user_pod());

DROP POLICY IF EXISTS "Enforce tenant pod isolation" ON public.whatsapp_sessions;
CREATE POLICY "Enforce tenant pod isolation" ON public.whatsapp_sessions FOR ALL TO authenticated USING (pod_id = public.get_user_pod());

DROP POLICY IF EXISTS "Enforce tenant pod isolation" ON public.activity_logs;
CREATE POLICY "Enforce tenant pod isolation" ON public.activity_logs FOR ALL TO authenticated USING (pod_id = public.get_user_pod());

DROP POLICY IF EXISTS "Enforce tenant pod isolation" ON public.clinic_staff;
CREATE POLICY "Enforce tenant pod isolation" ON public.clinic_staff FOR ALL TO authenticated USING (pod_id = public.get_user_pod());
