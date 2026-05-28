-- Migration: add_patient_past_reports
-- Adds past_reports_summary column to patient_registry table

ALTER TABLE public.patient_registry
  ADD COLUMN IF NOT EXISTS past_reports_summary TEXT;
