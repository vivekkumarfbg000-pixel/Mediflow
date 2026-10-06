-- ==============================================================================
-- PHASE 26: 100% LEGAL PRACTO-MODEL DIGITAL FINANCIAL LEDGER & ERP ARCHITECTURE
-- NMC Code §6.4 & RBI PSS Act 2007 Compliance
-- ==============================================================================

-- 1. Ensure unified_invoices supports Single-Bucket Hospital Billing & Counter Modes
ALTER TABLE IF EXISTS unified_invoices
  ADD COLUMN IF NOT EXISTS billing_model text DEFAULT 'hospital_single_bucket',
  ADD COLUMN IF NOT EXISTS payment_mode text DEFAULT 'counter_direct',
  ADD COLUMN IF NOT EXISTS clinic_upi_vpa text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS partner_pharmacy_dl text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS partner_lab_nabl text DEFAULT NULL;

-- 2. Ensure financial_ledgers operates purely as a bookkeeping ledger with zero escrow
ALTER TABLE IF EXISTS financial_ledgers
  ADD COLUMN IF NOT EXISTS collection_method text DEFAULT 'direct_counter',
  ADD COLUMN IF NOT EXISTS is_offline_b2b_reconciliation boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reconciliation_partner_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS platform_fee_amount numeric DEFAULT 0;

-- 3. Dedicated Offline B2B Partner Reconciliation Table (Pure Bookkeeping for External Vendors)
CREATE TABLE IF NOT EXISTS offline_vendor_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id uuid NOT NULL,
  partner_entity_id uuid,
  partner_name text NOT NULL,
  partner_type text NOT NULL CHECK (partner_type IN ('pharmacy', 'lab')),
  reconciliation_period text NOT NULL, -- e.g. '2026-10'
  item_count integer DEFAULT 0,
  total_accrued_amount numeric NOT NULL DEFAULT 0,
  settlement_status text DEFAULT 'pending_offline_invoice' CHECK (settlement_status IN ('pending_offline_invoice', 'invoiced', 'settled_offline')),
  b2b_invoice_number text,
  settled_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for instant monthly reconciliation queries
CREATE INDEX IF NOT EXISTS idx_offline_recon_pod_period ON offline_vendor_reconciliations (pod_id, reconciliation_period);

-- 4. Enable RLS and Sovereign Pod Isolation
ALTER TABLE offline_vendor_reconciliations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'offline_vendor_reconciliations' 
    AND policyname = 'pod_isolated_offline_recon'
  ) THEN
    CREATE POLICY pod_isolated_offline_recon ON offline_vendor_reconciliations
      FOR ALL
      USING (
        pod_id = NULLIF(current_setting('request.jwt.claims', true)::json->>'pod_id', '')::uuid
        OR EXISTS (
          SELECT 1 FROM profiles 
          WHERE profiles.id = auth.uid() 
          AND (profiles.role IN ('superadmin', 'doctor', 'compounder', 'lab', 'pharmacy'))
        )
      );
  END IF;
END $$;
