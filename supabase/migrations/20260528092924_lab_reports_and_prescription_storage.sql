-- ============================================================
-- Mediflow: Lab Reports Table + Prescription Storage Policies
-- Migration: 20260528092924_lab_reports_and_prescription_storage
-- ============================================================

-- 1. Extend lab_requisitions to track prescription file URL and revisit info
ALTER TABLE lab_requisitions
  ADD COLUMN IF NOT EXISTS prescription_file_url TEXT,
  ADD COLUMN IF NOT EXISTS revisit_scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revisit_note TEXT;

-- 2. Create lab_reports table for full structured report storage
CREATE TABLE IF NOT EXISTS lab_reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id      UUID NOT NULL REFERENCES lab_requisitions(id) ON DELETE CASCADE,
  patient_id          UUID NOT NULL REFERENCES patient_registry(id) ON DELETE CASCADE,
  patient_name        TEXT NOT NULL,
  report_file_url     TEXT,                    -- Supabase Storage path for PDF/image
  biomarker_json      JSONB,                   -- Numeric results (existing logic)
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by         UUID REFERENCES auth.users(id),
  approved_at         TIMESTAMPTZ,
  rejection_reason    TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION update_lab_reports_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lab_reports_updated_at_trigger ON lab_reports;
CREATE TRIGGER lab_reports_updated_at_trigger
  BEFORE UPDATE ON lab_reports
  FOR EACH ROW EXECUTE FUNCTION update_lab_reports_updated_at();

-- 3. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_lab_reports_requisition_id ON lab_reports(requisition_id);
CREATE INDEX IF NOT EXISTS idx_lab_reports_patient_id ON lab_reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_reports_status ON lab_reports(status);
CREATE INDEX IF NOT EXISTS idx_lab_requisitions_prescription ON lab_requisitions(prescription_file_url) WHERE prescription_file_url IS NOT NULL;

-- 4. Enable Row-Level Security on lab_reports
ALTER TABLE lab_reports ENABLE ROW LEVEL SECURITY;

-- 4a. Authenticated users (doctors, compounders, lab techs) can SELECT lab reports
CREATE POLICY "lab_reports_select_authenticated"
  ON lab_reports
  FOR SELECT
  TO authenticated
  USING (true);

-- 4b. Lab technicians can INSERT new reports
CREATE POLICY "lab_reports_insert_authenticated"
  ON lab_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 4c. Compounders and doctors can UPDATE (approve/reject)
CREATE POLICY "lab_reports_update_authenticated"
  ON lab_reports
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5. Grant table access to authenticated role
GRANT SELECT, INSERT, UPDATE ON lab_reports TO authenticated;
GRANT USAGE ON SEQUENCE lab_reports_id_seq TO authenticated;

-- 6. Supabase Storage: Create buckets via storage.buckets
-- The 'prescriptions' bucket stores prescription images uploaded by compounders
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'prescriptions',
  'prescriptions',
  false,
  10485760, -- 10 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- The 'lab-reports' bucket stores lab report PDFs/images uploaded by lab technicians
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lab-reports',
  'lab-reports',
  false,
  20971520, -- 20 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 7. Storage RLS policies for 'prescriptions' bucket
-- Authenticated users can upload prescriptions
CREATE POLICY "prescriptions_upload_policy"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'prescriptions');

-- Authenticated users can view/download prescriptions
CREATE POLICY "prescriptions_select_policy"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'prescriptions');

-- Authenticated users can update/replace prescriptions
CREATE POLICY "prescriptions_update_policy"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'prescriptions');

-- 8. Storage RLS policies for 'lab-reports' bucket
CREATE POLICY "lab_reports_upload_policy"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'lab-reports');

CREATE POLICY "lab_reports_select_policy"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'lab-reports');

CREATE POLICY "lab_reports_update_policy"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'lab-reports');
