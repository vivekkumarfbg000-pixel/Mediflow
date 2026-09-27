-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  VITALSYNC — PERMANENT RLS FIX: patient_registry & saas_prescriptions  ║
-- ║  Root Cause: Silent write-block (upsertData=null, upsertErr=null)       ║
-- ║  when RLS allows INSERT but blocks the RETURNING SELECT clause          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Run this migration in Supabase SQL Editor (Dashboard → SQL → New Query)
-- All statements are IDEMPOTENT — safe to run multiple times.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. patient_registry — Authenticated users can INSERT/UPDATE/SELECT
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE patient_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vitalsync_patient_registry_select" ON patient_registry;
DROP POLICY IF EXISTS "vitalsync_patient_registry_insert" ON patient_registry;
DROP POLICY IF EXISTS "vitalsync_patient_registry_update" ON patient_registry;
DROP POLICY IF EXISTS "vitalsync_patient_registry_upsert" ON patient_registry;

CREATE POLICY "vitalsync_patient_registry_select"
  ON patient_registry FOR SELECT TO authenticated USING (true);

CREATE POLICY "vitalsync_patient_registry_insert"
  ON patient_registry FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "vitalsync_patient_registry_update"
  ON patient_registry FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. saas_prescriptions
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE saas_prescriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vitalsync_saas_prescriptions_select" ON saas_prescriptions;
DROP POLICY IF EXISTS "vitalsync_saas_prescriptions_insert" ON saas_prescriptions;
DROP POLICY IF EXISTS "vitalsync_saas_prescriptions_update" ON saas_prescriptions;

CREATE POLICY "vitalsync_saas_prescriptions_select"
  ON saas_prescriptions FOR SELECT TO authenticated USING (true);

CREATE POLICY "vitalsync_saas_prescriptions_insert"
  ON saas_prescriptions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "vitalsync_saas_prescriptions_update"
  ON saas_prescriptions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. appointments
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vitalsync_appointments_select" ON appointments;
DROP POLICY IF EXISTS "vitalsync_appointments_insert" ON appointments;
DROP POLICY IF EXISTS "vitalsync_appointments_update" ON appointments;

CREATE POLICY "vitalsync_appointments_select"
  ON appointments FOR SELECT TO authenticated USING (true);

CREATE POLICY "vitalsync_appointments_insert"
  ON appointments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "vitalsync_appointments_update"
  ON appointments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. chronic_care_cohorts
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE chronic_care_cohorts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vitalsync_chronic_care_cohorts_select" ON chronic_care_cohorts;
DROP POLICY IF EXISTS "vitalsync_chronic_care_cohorts_insert" ON chronic_care_cohorts;
DROP POLICY IF EXISTS "vitalsync_chronic_care_cohorts_update" ON chronic_care_cohorts;

CREATE POLICY "vitalsync_chronic_care_cohorts_select"
  ON chronic_care_cohorts FOR SELECT TO authenticated USING (true);

CREATE POLICY "vitalsync_chronic_care_cohorts_insert"
  ON chronic_care_cohorts FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "vitalsync_chronic_care_cohorts_update"
  ON chronic_care_cohorts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Verify: run this to confirm all policies are installed
-- ─────────────────────────────────────────────────────────────────────────────
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies
WHERE tablename IN (
  'patient_registry',
  'saas_prescriptions',
  'appointments',
  'chronic_care_cohorts'
)
ORDER BY tablename, policyname;
