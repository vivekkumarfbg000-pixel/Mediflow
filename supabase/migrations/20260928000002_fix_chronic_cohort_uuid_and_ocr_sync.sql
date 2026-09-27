-- ============================================================================
-- VITALSYNC CLINIC OS: CHRONIC CARE UUID & OCR SYNC IDEMPOTENT UPGRADE
-- Migration: 20260928000002_fix_chronic_cohort_uuid_and_ocr_sync.sql
-- Date: 2026-09-28
-- Description: Ensures idempotent storage buckets, RLS policies, and realtime CDC
-- for autonomous prescription ingestion, chronic care cohorts, and patient billing.
-- ============================================================================

-- 1. Ensure Supabase storage buckets exist for prescription uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'prescription-scans',
  'prescription-scans',
  true,
  10485760, -- 10 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'prescriptions',
  'prescriptions',
  true,
  10485760, -- 10 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Storage RLS policies for prescription-scans
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow public uploads to prescription-scans'
  ) THEN
    CREATE POLICY "Allow public uploads to prescription-scans"
    ON storage.objects FOR INSERT TO authenticated, anon
    WITH CHECK (bucket_id = 'prescription-scans');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow public reads from prescription-scans'
  ) THEN
    CREATE POLICY "Allow public reads from prescription-scans"
    ON storage.objects FOR SELECT TO authenticated, anon
    USING (bucket_id = 'prescription-scans');
  END IF;
END $$;

-- 3. Idempotent columns for chronic_care_cohorts
ALTER TABLE public.chronic_care_cohorts ADD COLUMN IF NOT EXISTS care_program_status TEXT DEFAULT 'not_enrolled';
ALTER TABLE public.chronic_care_cohorts ADD COLUMN IF NOT EXISTS care_program_fee NUMERIC(10, 2) DEFAULT 4000.00;
ALTER TABLE public.chronic_care_cohorts ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.chronic_care_cohorts ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

-- 4. Enable RLS and permissive policies for chronic_care_cohorts
ALTER TABLE public.chronic_care_cohorts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'chronic_care_cohorts' AND policyname = 'allow_authenticated_all_chronic_cohorts_v2'
  ) THEN
    CREATE POLICY allow_authenticated_all_chronic_cohorts_v2 
    ON public.chronic_care_cohorts FOR ALL TO authenticated, anon 
    USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 5. Add chronic_care_cohorts and saas_prescriptions to supabase_realtime CDC
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.chronic_care_cohorts;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.saas_prescriptions;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;
