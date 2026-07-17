-- Mediflow Commission Engine — Pool & Cash Billing Infrastructure
-- Adds commission_pool_balance, cash_billing_sessions, pool_transactions
-- and atomic RPCs for crediting/debiting the per-pod commission pool.
-- Minimum pool threshold before deferral: ₹200.

-- ─── 1. Commission pool balance column on pods ────────────────────────────────
ALTER TABLE public.pods
  ADD COLUMN IF NOT EXISTS commission_pool_balance NUMERIC(12, 2) DEFAULT 0.00;

-- Seed pool from existing pending_cash_balance (safe migration carry-over)
UPDATE public.pods
SET commission_pool_balance = COALESCE(pending_cash_balance, 0.00)
WHERE commission_pool_balance = 0.00 AND COALESCE(pending_cash_balance, 0) > 0;

-- ─── 2. cash_billing_sessions ─────────────────────────────────────────────────
-- Stores every cash sale billed through the Mediflow app by a compounder.
CREATE TABLE IF NOT EXISTS public.cash_billing_sessions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id            UUID        NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE,
  entity_id         UUID        NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  billed_by         UUID        REFERENCES auth.users(id),          -- compounder user
  patient_id        UUID        REFERENCES public.patient_registry(id),
  sale_type         TEXT        NOT NULL CHECK (sale_type IN ('pharmacy', 'lab')),
  gross_amount      NUMERIC(10, 2) NOT NULL,
  commission_rate   NUMERIC(5, 4) NOT NULL DEFAULT 0.0300,          -- 3%
  commission_amount NUMERIC(10, 2) NOT NULL,
  pool_status       TEXT        NOT NULL DEFAULT 'debited'
                    CHECK (pool_status IN ('debited', 'deferred')),
  items             JSONB       NOT NULL DEFAULT '[]'::JSONB,        -- line items snapshot
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- ─── 3. pool_transactions — immutable audit ledger ────────────────────────────
CREATE TABLE IF NOT EXISTS public.pool_transactions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id           UUID        NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE,
  transaction_type TEXT        NOT NULL CHECK (transaction_type IN ('credit', 'debit', 'deferred')),
  amount           NUMERIC(10, 2) NOT NULL,
  reason           TEXT        NOT NULL,
  reference_id     UUID,                   -- invoice_id or cash_billing_session_id
  balance_after    NUMERIC(12, 2) NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ─── 4. RPC: credit_commission_pool ──────────────────────────────────────────
-- Called by the cashfree-webhook after a successful online payment.
-- Credits the pod's pool with the platform fee earned.
CREATE OR REPLACE FUNCTION public.credit_commission_pool(
  p_pod_id       UUID,
  p_amount       NUMERIC,
  p_reason       TEXT,
  p_reference_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance NUMERIC;
BEGIN
  UPDATE public.pods
  SET
    commission_pool_balance   = COALESCE(commission_pool_balance, 0)   + p_amount,
    lifetime_platform_revenue = COALESCE(lifetime_platform_revenue, 0) + p_amount
  WHERE id = p_pod_id
  RETURNING commission_pool_balance INTO v_new_balance;

  INSERT INTO public.pool_transactions
    (pod_id, transaction_type, amount, reason, reference_id, balance_after)
  VALUES
    (p_pod_id, 'credit', p_amount, p_reason, p_reference_id, v_new_balance);

  RETURN jsonb_build_object(
    'status',        'credited',
    'balance_after', v_new_balance,
    'credited',      p_amount
  );
END;
$$;

-- ─── 5. RPC: debit_commission_pool ───────────────────────────────────────────
-- Called for every cash sale billed through the app.
-- Deducts 3% commission from the pool.
-- If pool < ₹200 threshold → defers the commission (non-blocking).
CREATE OR REPLACE FUNCTION public.debit_commission_pool(
  p_pod_id       UUID,
  p_amount       NUMERIC,
  p_reason       TEXT,
  p_reference_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_threshold       NUMERIC := 200.00;
  v_new_balance     NUMERIC;
  v_status          TEXT;
BEGIN
  -- Lock the pod row to prevent race conditions
  SELECT COALESCE(commission_pool_balance, 0)
  INTO   v_current_balance
  FROM   public.pods
  WHERE  id = p_pod_id
  FOR UPDATE;

  IF v_current_balance >= v_threshold AND v_current_balance >= p_amount THEN
    -- Sufficient pool — deduct immediately
    v_new_balance := v_current_balance - p_amount;
    v_status      := 'debited';

    UPDATE public.pods
    SET commission_pool_balance = v_new_balance
    WHERE id = p_pod_id;
  ELSE
    -- Pool too low — defer commission, accumulate in pending_cash_balance
    v_new_balance := v_current_balance;
    v_status      := 'deferred';

    UPDATE public.pods
    SET pending_cash_balance = COALESCE(pending_cash_balance, 0) + p_amount
    WHERE id = p_pod_id;
  END IF;

  INSERT INTO public.pool_transactions
    (pod_id, transaction_type, amount, reason, reference_id, balance_after)
  VALUES
    (p_pod_id, v_status, p_amount, p_reason, p_reference_id, v_new_balance);

  RETURN jsonb_build_object(
    'status',        v_status,
    'balance_after', v_new_balance,
    'deducted',      p_amount,
    'is_low',        v_new_balance < v_threshold
  );
END;
$$;

-- ─── 6. RPC: get_pool_status ──────────────────────────────────────────────────
-- Returns pool balance + low-balance flag for the UI widget.
CREATE OR REPLACE FUNCTION public.get_pool_status(p_pod_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC;
  v_pending NUMERIC;
BEGIN
  SELECT
    COALESCE(commission_pool_balance, 0),
    COALESCE(pending_cash_balance, 0)
  INTO v_balance, v_pending
  FROM public.pods
  WHERE id = p_pod_id;

  RETURN jsonb_build_object(
    'pool_balance',         v_balance,
    'pending_cash_balance', v_pending,
    'is_low',               v_balance < 200,
    'threshold',            200
  );
END;
$$;

-- ─── 7. RLS policies ─────────────────────────────────────────────────────────
ALTER TABLE public.cash_billing_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_transactions      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pod_members_cash_billing"      ON public.cash_billing_sessions;
DROP POLICY IF EXISTS "pod_members_pool_transactions"  ON public.pool_transactions;

CREATE POLICY "pod_members_cash_billing" ON public.cash_billing_sessions
  FOR ALL TO authenticated
  USING (pod_id = public.get_user_pod());

CREATE POLICY "pod_members_pool_transactions" ON public.pool_transactions
  FOR SELECT TO authenticated
  USING (pod_id = public.get_user_pod());

-- ─── 8. Grants ────────────────────────────────────────────────────────────────
GRANT ALL   ON TABLE public.cash_billing_sessions TO authenticated;
GRANT ALL   ON TABLE public.pool_transactions      TO authenticated;

REVOKE EXECUTE ON FUNCTION public.credit_commission_pool(UUID, NUMERIC, TEXT, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.debit_commission_pool(UUID, NUMERIC, TEXT, UUID)  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_pool_status(UUID)                              FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.credit_commission_pool(UUID, NUMERIC, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.debit_commission_pool(UUID, NUMERIC, TEXT, UUID)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pool_status(UUID)                              TO authenticated;
