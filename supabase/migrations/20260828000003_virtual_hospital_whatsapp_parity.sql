-- =====================================================================================
-- Migration: 20260828000003_virtual_hospital_whatsapp_parity.sql
-- Description: Idempotent tables, columns, and indexes for VitalSync Virtual Hospital WhatsApp Parity
--              Covers B2B referral rewards, free loyalty follow-ups, and queue tracking.
-- =====================================================================================

-- 1. Ensure columns on patient_registry
ALTER TABLE IF EXISTS patient_registry
  ADD COLUMN IF NOT EXISTS referral_code TEXT,
  ADD COLUMN IF NOT EXISTS referred_by_code TEXT,
  ADD COLUMN IF NOT EXISTS is_premium_member BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS queue_status TEXT DEFAULT 'awaiting_vitals';

-- 2. Ensure columns on appointments
ALTER TABLE IF EXISTS appointments
  ADD COLUMN IF NOT EXISTS virtual_meeting_url TEXT,
  ADD COLUMN IF NOT EXISTS fee_status TEXT DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS token_number TEXT;

-- 3. Create or update patient_referral_rewards table
CREATE TABLE IF NOT EXISTS patient_referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patient_registry(id) ON DELETE CASCADE,
  referred_patient_id UUID REFERENCES patient_registry(id) ON DELETE SET NULL,
  referral_code TEXT,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'redeemed', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  redeemed_at TIMESTAMPTZ,
  pod_id UUID
);

-- Ensure columns exist if table was already created in an earlier schema
ALTER TABLE IF EXISTS patient_referral_rewards
  ADD COLUMN IF NOT EXISTS referral_code TEXT,
  ADD COLUMN IF NOT EXISTS pod_id UUID;

-- 4. Enable RLS and create idempotent policies
ALTER TABLE patient_referral_rewards ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'patient_referral_rewards' AND policyname = 'Allow authenticated and anon access to patient_referral_rewards'
  ) THEN
    CREATE POLICY "Allow authenticated and anon access to patient_referral_rewards"
      ON patient_referral_rewards
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 5. Performance Indexes (Idempotent)
CREATE INDEX IF NOT EXISTS idx_patient_referral_rewards_patient_id ON patient_referral_rewards (patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_referral_rewards_code ON patient_referral_rewards (referral_code);
CREATE INDEX IF NOT EXISTS idx_patient_referral_rewards_status ON patient_referral_rewards (status);
CREATE INDEX IF NOT EXISTS idx_patient_registry_referral_code ON patient_registry (referral_code);
CREATE INDEX IF NOT EXISTS idx_appointments_virtual_meeting ON appointments (virtual_meeting_url) WHERE virtual_meeting_url IS NOT NULL;
