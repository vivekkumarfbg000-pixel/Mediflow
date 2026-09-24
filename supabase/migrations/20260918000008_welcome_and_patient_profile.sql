-- ═══════════════════════════════════════════════════════════════════════════════
-- VITALSYNC WELCOME AUTOMATION & PATIENT PROFILE — DATABASE MIGRATION
-- File: 20260918_welcome_and_patient_profile.sql
-- Run in Supabase SQL Editor BEFORE deploying code changes.
-- All statements are idempotent (safe to re-run).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. patient_registry: add welcome_sent_at timestamp ────────────────────────
ALTER TABLE public.patient_registry
  ADD COLUMN IF NOT EXISTS welcome_sent_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.patient_registry.welcome_sent_at IS 'Timestamp when the onboarding welcome WhatsApp template was dispatched (prevents duplicate sends to returning customers)';

-- ── 2. Index for welcome message query optimization ───────────────────────────
CREATE INDEX IF NOT EXISTS idx_patient_registry_welcome_sent_at
  ON public.patient_registry (welcome_sent_at);
