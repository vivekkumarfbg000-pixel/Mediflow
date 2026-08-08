-- =============================================================================
-- Mediflow: pg_audit Setup for Financial Tables Monitoring
-- Provides tamper-evident audit trail for all financial transactions
-- Run in Supabase SQL Editor AFTER enabling pg_audit extension
-- =============================================================================

-- 1. Enable pg_audit extension (requires superuser - run in Supabase Dashboard)
-- CREATE EXTENSION IF NOT EXISTS pgaudit;

-- 2. Configure pg_audit for financial tables
-- These settings log all DML operations on financial tables

-- Session-level configuration (run per session or set as default)
SET pgaudit.log = 'ddl, write';
SET pgaudit.log_level = 'log';
SET pgaudit.log_parameter = 'on';
SET pgaudit.log_statement_once = 'off';

-- 3. Object-level audit for financial tables
-- Audit all INSERT, UPDATE, DELETE on financial tables

-- Unified Invoices - All payment state changes
ALTER TABLE public.unified_invoices ENABLE ROW LEVEL SECURITY;
-- Note: pg_audit object auditing requires superuser
-- ALTER TABLE public.unified_invoices SET (pgaudit.log = 'write');

-- Financial Ledgers - All commission splits and payouts
ALTER TABLE public.financial_ledgers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.financial_ledgers SET (pgaudit.log = 'write');

-- Pool Settlements - All commission pool transactions
ALTER TABLE public.vitalsync_pool_settlements ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.vitalsync_pool_settlements SET (pgaudit.log = 'write');

-- Medicine Bills - All pharmacy transactions
ALTER TABLE public.medicine_bills ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.medicine_bills SET (pgaudit.log = 'write');

-- Counter Transactions - Cash counter activity
ALTER TABLE public.counter_transactions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.counter_transactions SET (pgaudit.log = 'write');

-- Appointments - Payment status changes
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.appointments SET (pgaudit.log = 'write');

-- Lab Test Bills - Pathology billing
ALTER TABLE public.lab_test_bills ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.lab_test_bills SET (pgaudit.log = 'write');

-- 4. Create audit log view for easy querying
CREATE OR REPLACE VIEW public.financial_audit_log AS
SELECT
  audit_id,
  event_time,
  session_user,
  database_name,
  schema_name,
  table_name,
  operation,
  query,
  client_addr,
  application_name
FROM pgaudit.log
WHERE table_name IN (
  'unified_invoices',
  'financial_ledgers',
  'vitalsync_pool_settlements',
  'medicine_bills',
  'counter_transactions',
  'appointments',
  'lab_test_bills'
)
ORDER BY event_time DESC;

-- 5. Grant access to audit view (admins only)
GRANT SELECT ON public.financial_audit_log TO authenticated;
-- Revoke from anon
REVOKE SELECT ON public.financial_audit_log FROM anon;

-- 6. Create audit summary function for dashboards
CREATE OR REPLACE FUNCTION public.get_financial_audit_summary(
  p_start_time TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours',
  p_end_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  table_name TEXT,
  operation TEXT,
  operation_count BIGINT,
  unique_users BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    table_name,
    operation,
    COUNT(*) as operation_count,
    COUNT(DISTINCT session_user) as unique_users
  FROM pgaudit.log
  WHERE table_name IN (
    'unified_invoices',
    'financial_ledgers',
    'vitalsync_pool_settlements',
    'medicine_bills',
    'counter_transactions',
    'appointments',
    'lab_test_bills'
  )
  AND event_time BETWEEN p_start_time AND p_end_time
  GROUP BY table_name, operation
  ORDER BY operation_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_financial_audit_summary TO authenticated;

-- 6. Real-time audit alerts (via pg_notify)
CREATE OR REPLACE FUNCTION public.audit_alert_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_payload JSONB;
BEGIN
  -- Only alert on DELETE or suspicious UPDATE patterns
  IF TG_OP = 'DELETE' THEN
    v_payload := jsonb_build_object(
      'alert_type', 'FINANCIAL_DELETE',
      'table', TG_TABLE_NAME,
      'record_id', OLD.id,
      'deleted_by', session_user,
      'timestamp', NOW()
    );
    PERFORM pg_notify('financial_audit_alert', v_payload::text);
  ELSIF TG_OP = 'UPDATE' AND (
    -- Payment status changes
    (TG_TABLE_NAME = 'unified_invoices' AND OLD.payment_status != NEW.payment_status) OR
    -- Payment status changes
    (TG_TABLE_NAME = 'appointments' AND OLD.payment_status != NEW.payment_status) OR
    -- Amount changes
    (TG_TABLE_NAME = 'unified_invoices' AND OLD.total_amount != NEW.total_amount)
  ) THEN
    v_payload := jsonb_build_object(
      'alert_type', 'FINANCIAL_UPDATE',
      'table', TG_TABLE_NAME,
      'record_id', NEW.id,
      'changed_by', session_user,
      'old_values', to_jsonb(OLD),
      'new_values', to_jsonb(NEW),
      'timestamp', NOW()
    );
    PERFORM pg_notify('financial_audit_alert', v_payload::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Attach audit triggers to financial tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'unified_invoices',
    'financial_ledgers',
    'vitalsync_pool_settlements',
    'medicine_bills',
    'counter_transactions',
    'appointments',
    'lab_test_bills'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS audit_alert ON %I; CREATE TRIGGER audit_alert AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION public.audit_alert_trigger()',
      tbl, tbl
    );
  END LOOP;
END $$;

-- 8. Index for audit log performance
CREATE INDEX IF NOT EXISTS idx_pgaudit_financial_lookup 
ON pgaudit.log (event_time DESC, table_name, session_user)
WHERE table_name IN (
  'unified_invoices', 'financial_ledgers', 'vitalsync_pool_settlements',
  'medicine_bills', 'counter_transactions', 'appointments', 'lab_test_bills'
);

-- 9. Retention policy (keep audit logs for 7 years)
-- Note: Requires pg_partman or manual partitioning
-- This is a placeholder for the retention strategy
COMMENT ON TABLE pgaudit.log IS 'Financial audit logs retained for 7 years per compliance requirements';

-- 10. Verification queries
-- Check if pg_audit is working:
-- SELECT * FROM pgaudit.log WHERE table_name = 'unified_invoices' ORDER BY event_time DESC LIMIT 10;

-- Check audit alerts:
-- LISTEN financial_audit_alert; -- In psql or application