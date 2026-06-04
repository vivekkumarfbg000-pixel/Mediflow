-- Mediflow Connected Care Platform Scaling Safeguards & Operational Integrity
-- Migration ID: 20260604000004_saas_scaling_safeguards
-- Created: 2026-06-04
-- Purpose: Implement Security Sentry, Cost Guard, CFO Financial Reconciler, and Edge IP Firewall console.

-- =============================================================================
-- SECTION 1: COST GUARD - PER-CLINIC SPENDING BUDGETS
-- =============================================================================

-- 1. Add daily_cost_budget column to the pods table
ALTER TABLE public.pods 
  ADD COLUMN IF NOT EXISTS daily_cost_budget NUMERIC(10,2) DEFAULT 500.00;

-- 2. Function to compute a pod's cumulative daily spending (WhatsApp logs + AI Tasks)
CREATE OR REPLACE FUNCTION public.get_pod_daily_spend(p_pod_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_waba_cost NUMERIC(10, 4) := 0.0000;
  v_ai_cost NUMERIC(10, 4) := 0.0000;
BEGIN
  -- Sum WhatsApp billing logs today (join with waba_connections to map to pod_id)
  SELECT COALESCE(SUM(l.cost), 0.0000) INTO v_waba_cost
  FROM public.whatsapp_billing_logs l
  JOIN public.waba_connections c ON l.phone_number_id = c.phone_number_id
  WHERE c.pod_id = p_pod_id
    AND l.processed_at >= CURRENT_DATE;

  -- Sum AI task pipeline runs today (Assume ₹0.50 per completed pipeline action)
  SELECT COALESCE(COUNT(*), 0) * 0.50 INTO v_ai_cost
  FROM public.agent_task_pipelines
  WHERE pod_id = p_pod_id
    AND status = 'completed'
    AND created_at >= CURRENT_DATE;

  RETURN (v_waba_cost + v_ai_cost)::NUMERIC(10,2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.get_pod_daily_spend(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pod_daily_spend(UUID) TO authenticated;

-- 3. Function to check if a pod is under budget
CREATE OR REPLACE FUNCTION public.check_pod_budget(p_pod_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_limit NUMERIC(10, 2);
  v_spend NUMERIC(10, 2);
BEGIN
  SELECT COALESCE(daily_cost_budget, 500.00) INTO v_limit
  FROM public.pods
  WHERE id = p_pod_id;

  v_spend := public.get_pod_daily_spend(p_pod_id);

  IF v_spend >= v_limit THEN
    RETURN FALSE; -- Budget exceeded, block transactions
  ELSE
    RETURN TRUE;  -- Safe
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.check_pod_budget(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_pod_budget(UUID) TO authenticated;


-- =============================================================================
-- SECTION 2: SECURITY SENTRY - RLS COMPLIANCE AUDITOR
-- =============================================================================

CREATE OR REPLACE FUNCTION public.audit_rls_compliance()
RETURNS TABLE (
  table_name TEXT,
  rls_enabled BOOLEAN,
  policy_count INT,
  has_pod_isolation BOOLEAN,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.relname::TEXT as table_name,
    c.relrowsecurity::BOOLEAN as rls_enabled,
    COALESCE((SELECT COUNT(*)::INT FROM pg_policy p WHERE p.polrelid = c.oid), 0)::INT as policy_count,
    EXISTS (
      SELECT 1 FROM pg_policy p
      WHERE p.polrelid = c.oid
        AND (
          p.polqual::text LIKE '%pod_id%'
          OR p.polwithcheck::text LIKE '%pod_id%'
          OR p.polname LIKE '%tenant%'
          OR p.polname LIKE '%pod%'
        )
    )::BOOLEAN as has_pod_isolation,
    CASE
      WHEN c.relrowsecurity = true AND EXISTS (
        SELECT 1 FROM pg_policy p
        WHERE p.polrelid = c.oid
          AND (
            p.polqual::text LIKE '%pod_id%'
            OR p.polwithcheck::text LIKE '%pod_id%'
            OR p.polname LIKE '%tenant%'
            OR p.polname LIKE '%pod%'
          )
      ) THEN 'secure'
      ELSE 'vulnerable'
    END::TEXT as status
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname NOT IN ('schema_migrations', 'supabase_migrations', 'blacklisted_ips')
  ORDER BY c.relname;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.audit_rls_compliance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_rls_compliance() TO authenticated;


-- =============================================================================
-- SECTION 3: CFO FINANCE RECONCILER - SPLIT RETRY UTILITIES
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_failed_settlements()
RETURNS TABLE (
  id UUID,
  invoice_id UUID,
  source_entity_name TEXT,
  destination_entity_name TEXT,
  transaction_type TEXT,
  gross_amount NUMERIC(10, 2),
  commission_rate NUMERIC(10, 2),
  net_payout NUMERIC(10, 2),
  payment_status TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fl.id,
    fl.invoice_id,
    COALESCE(se.name, 'Unknown Clinic')::TEXT as source_entity_name,
    COALESCE(de.name, 'Unknown Partner')::TEXT as destination_entity_name,
    fl.transaction_type::TEXT,
    fl.gross_amount::NUMERIC(10, 2),
    fl.commission_rate::NUMERIC(10, 2),
    fl.net_payout::NUMERIC(10, 2),
    fl.payment_status::TEXT,
    fl.created_at
  FROM public.financial_ledgers fl
  LEFT JOIN public.entities se ON fl.source_entity_id = se.id
  LEFT JOIN public.entities de ON fl.destination_entity_id = de.id
  WHERE fl.payment_status = 'failed'
  ORDER BY fl.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.get_failed_settlements() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_failed_settlements() TO authenticated;

CREATE OR REPLACE FUNCTION public.retry_failed_settlement(ledger_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.financial_ledgers
  SET payment_status = 'pending',
      updated_at = now()
  WHERE id = ledger_id AND payment_status = 'failed';
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.retry_failed_settlement(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.retry_failed_settlement(UUID) TO authenticated;


-- =============================================================================
-- SECTION 4: EDGE SENTRY - IP FIREWALL CONSOLE
-- =============================================================================

-- 1. Create blacklisted_ips table
CREATE TABLE IF NOT EXISTS public.blacklisted_ips (
  ip TEXT PRIMARY KEY,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for Security
ALTER TABLE public.blacklisted_ips ENABLE ROW LEVEL SECURITY;

-- Allow platform administrators full RLS access to add/remove/view blacklisted IPs
DROP POLICY IF EXISTS "Admin read write access" ON public.blacklisted_ips;
CREATE POLICY "Admin read write access" ON public.blacklisted_ips
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.role = 'admin' OR profiles.role = 'platform_admin')
    )
  );

-- 2. Modify check_rate_limit rate limiter to query blacklisted_ips
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_ip TEXT, 
    p_max_requests INTEGER, 
    p_window_seconds INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Query the IP blacklist first
    IF EXISTS (SELECT 1 FROM public.blacklisted_ips WHERE ip = p_ip) THEN
        RETURN FALSE; -- Blocked immediately
    END IF;

    -- Prune expired entries to maintain a small footprint
    DELETE FROM public.rate_limits 
    WHERE window_start < NOW() - (p_window_seconds || ' seconds')::INTERVAL;

    -- Upsert the client IP record
    INSERT INTO public.rate_limits (ip, request_count, window_start)
    VALUES (p_ip, 1, NOW())
    ON CONFLICT (ip) DO UPDATE
    SET request_count = CASE 
        WHEN public.rate_limits.window_start < NOW() - (p_window_seconds || ' seconds')::INTERVAL THEN 1
        ELSE public.rate_limits.request_count + 1
    END,
    window_start = CASE 
        WHEN public.rate_limits.window_start < NOW() - (p_window_seconds || ' seconds')::INTERVAL THEN NOW()
        ELSE public.rate_limits.window_start
    END
    RETURNING request_count INTO v_count;

    RETURN v_count <= p_max_requests;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reapply down-locked execute permissions
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) TO authenticated;
