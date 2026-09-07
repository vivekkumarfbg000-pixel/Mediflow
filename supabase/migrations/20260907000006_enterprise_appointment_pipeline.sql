-- =========================================================================================
-- VitalSync Enterprise Migration: 20260907000006_enterprise_appointment_pipeline.sql
-- Description: Enterprise index and schema hardening for appointments pipeline
-- Directives: Rule 1, Rule 3, Rule 4
-- =========================================================================================

-- 1. Ensure is_vip column and index exist idempotently
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_appointments_is_vip ON public.appointments(is_vip);

-- 2. Ensure composite indexes for high-speed appointment lookups (<3ms)
CREATE INDEX IF NOT EXISTS idx_appointments_patient_status ON public.appointments(patient_id, status);
CREATE INDEX IF NOT EXISTS idx_appointments_virtual_date ON public.appointments(virtual_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status_date ON public.appointments(status, virtual_date);
