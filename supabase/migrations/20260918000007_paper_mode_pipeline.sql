-- ═══════════════════════════════════════════════════════════════════════════════
-- VITALSYNC PAPER MODE PIPELINE — DATABASE MIGRATION
-- File: 20260918_paper_mode_pipeline.sql
-- Run in Supabase SQL Editor BEFORE deploying code changes.
-- All statements are idempotent (safe to re-run).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. patient_registry: add address + chronic care fields ────────────────────
ALTER TABLE public.patient_registry
  ADD COLUMN IF NOT EXISTS address TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_chronic BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS chronic_conditions TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.patient_registry.address IS 'Patient full address extracted from paper prescription by AI OCR';
COMMENT ON COLUMN public.patient_registry.is_chronic IS 'TRUE if AI or doctor has identified this patient as a chronic care patient';
COMMENT ON COLUMN public.patient_registry.chronic_conditions IS 'Array of chronic condition names: e.g. {Diabetes,Hypertension}';

-- ── 2. saas_prescriptions: add paper mode columns ────────────────────────────
ALTER TABLE public.saas_prescriptions
  ADD COLUMN IF NOT EXISTS prescription_image_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS patient_address TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS diagnosis TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_chronic BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS chronic_conditions TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'digital';

COMMENT ON COLUMN public.saas_prescriptions.prescription_image_url IS 'Supabase Storage signed URL for the original scanned prescription image';
COMMENT ON COLUMN public.saas_prescriptions.patient_address IS 'Patient address extracted from the prescription by AI OCR';
COMMENT ON COLUMN public.saas_prescriptions.diagnosis IS 'Diagnosis or chief complaints extracted from prescription';
COMMENT ON COLUMN public.saas_prescriptions.is_chronic IS 'TRUE if AI detected chronic condition indicators on this prescription';
COMMENT ON COLUMN public.saas_prescriptions.chronic_conditions IS 'Chronic conditions detected: e.g. {Diabetes,Hypertension}';
COMMENT ON COLUMN public.saas_prescriptions.source IS 'Source channel: digital (Doctor EMR), paper_scan (Compounder OCR), whatsapp (Bot onboard)';

-- ── 3. welcome_templates: permanent immutable template storage ────────────────
CREATE TABLE IF NOT EXISTS public.welcome_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT UNIQUE NOT NULL,
  template_body TEXT NOT NULL,
  language TEXT DEFAULT 'hinglish',
  is_locked BOOLEAN DEFAULT TRUE,  -- Prevents accidental overwrite from app layer
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.welcome_templates IS 'Permanent, locked WhatsApp message templates for patient onboarding';
COMMENT ON COLUMN public.welcome_templates.is_locked IS 'When TRUE, the template cannot be overwritten by app-layer upserts';

-- Enable RLS
ALTER TABLE public.welcome_templates ENABLE ROW LEVEL SECURITY;

-- Allow all roles to read templates (chatbot, edge functions, frontend)
DROP POLICY IF EXISTS "welcome_templates_read_all" ON public.welcome_templates;
CREATE POLICY "welcome_templates_read_all"
  ON public.welcome_templates FOR SELECT USING (TRUE);

-- Only service_role can write (prevents accidental app-layer overwrites)
DROP POLICY IF EXISTS "welcome_templates_service_write" ON public.welcome_templates;
CREATE POLICY "welcome_templates_service_write"
  ON public.welcome_templates FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── 4. Supabase Storage: ensure prescriptions bucket exists ──────────────────
-- NOTE: Run this in the Supabase Dashboard → Storage → New Bucket
-- Bucket name: prescriptions | Private (not public) | 50MB max file size
-- The following is for reference only — bucket creation via SQL is not supported:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('prescriptions', 'prescriptions', false) ON CONFLICT (id) DO NOTHING;

-- ── 5. Index for fast patient prescription lookups ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_saas_prescriptions_patient_id
  ON public.saas_prescriptions (patient_id);

CREATE INDEX IF NOT EXISTS idx_saas_prescriptions_source
  ON public.saas_prescriptions (source);

CREATE INDEX IF NOT EXISTS idx_patient_registry_is_chronic
  ON public.patient_registry (is_chronic);
