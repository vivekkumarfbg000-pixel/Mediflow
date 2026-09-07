-- =============================================================================
-- Migration: 20260907000002_direct_upi_and_split_settlements.sql
-- Description: Ensures pods.upi_vpa, clinic_sops, appointments payment_status,
--              and settlement ledger integrity for Direct Doctor UPI and Dynamic
--              Platform Fee Ledger (5% Lab, 2% Pharmacy, 0% Doctor Fee).
-- =============================================================================

-- 1. Ensure pods table has upi_vpa column for Doctor Direct UPI VPA
ALTER TABLE IF EXISTS public.pods
ADD COLUMN IF NOT EXISTS upi_vpa TEXT DEFAULT 'vitalsync@axl';

-- 2. Ensure clinic_sops table exists and has extracted_config jsonb
CREATE TABLE IF NOT EXISTS public.clinic_sops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pod_id TEXT,
    entity_id TEXT,
    sop_file_name TEXT,
    sop_text TEXT,
    extracted_config JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Ensure appointments table has payment_status, source, and platform_fee_deducted columns
ALTER TABLE IF EXISTS public.appointments
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'walk_in',
ADD COLUMN IF NOT EXISTS platform_fee_deducted NUMERIC DEFAULT 0;

-- 4. Enable Realtime Publications for clinic_sops and pods if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'clinic_sops'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.clinic_sops;
  END IF;
END $$;
