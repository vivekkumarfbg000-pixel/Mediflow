-- ==============================================================================
-- 🏛️ VitalSync / Mediflow Enterprise Database Migration
-- Migration: 20260914000006_whatsapp_interactive_service_templates.sql
-- Purpose:
--   1. Optimize Family Directory index on patient_registry for phone slugs
--   2. Sub-millisecond encounter & medication lookup for WhatsApp Prescription Summary
--   3. Fast lab & pathology report indexing for interactive WhatsApp delivery
--   4. Idempotent schema safeguards for family member linkage and health locker
-- ==============================================================================

-- STEP 1: Fast Indexing for Family Members (phone LIKE '%-family-%')
CREATE INDEX IF NOT EXISTS idx_patient_registry_family_phone 
ON public.patient_registry (phone text_pattern_ops);

-- STEP 2: Fast Indexing for Encounters & Medications for instant Rx prescription summary
CREATE INDEX IF NOT EXISTS idx_encounters_patient_status_created 
ON public.encounters (patient_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_encounter_medications_encounter_id 
ON public.encounter_medications (encounter_id);

-- STEP 3: Fast Indexing for Pathology & Lab Reports
CREATE INDEX IF NOT EXISTS idx_pathology_reports_patient_created 
ON public.pathology_reports (patient_id, created_at DESC);

-- STEP 4: Helper RPC for retrieving patient family directory
CREATE OR REPLACE FUNCTION public.get_patient_family_members(p_primary_phone TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  age INT,
  gender TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pr.id,
    pr.name,
    pr.age,
    pr.gender,
    pr.phone,
    pr.created_at
  FROM public.patient_registry pr
  WHERE pr.phone LIKE (p_primary_phone || '-family-%')
  ORDER BY pr.created_at ASC;
END;
$$;
