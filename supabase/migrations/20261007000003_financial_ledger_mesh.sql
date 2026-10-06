-- =========================================================================
-- PHASE 23: MILITARY-GRADE FINANCIAL LEDGER MESH & RECONCILIATION INDEXES
-- =========================================================================

-- Composite index for instant sub-300ms invoice split lookups and idempotency checks
CREATE INDEX IF NOT EXISTS idx_financial_ledgers_invoice_type 
  ON public.financial_ledgers (invoice_id, transaction_type);

-- Composite index for high-speed doctor earnings and settlement queries
CREATE INDEX IF NOT EXISTS idx_financial_ledgers_doctor_status 
  ON public.financial_ledgers (doctor_id, payment_status, created_at DESC);

-- Ensure idempotency key column exists
ALTER TABLE IF EXISTS public.financial_ledgers
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100),
  ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ;

-- Unique index on idempotency key to prevent double-spend at database level
CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_ledgers_idempotency_key 
  ON public.financial_ledgers (idempotency_key) 
  WHERE idempotency_key IS NOT NULL;
