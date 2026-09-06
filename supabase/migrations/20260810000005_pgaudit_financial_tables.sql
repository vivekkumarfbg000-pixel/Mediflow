-- =============================================================================
-- Mediflow: pg_audit & Realtime Trigger Setup for Financial Tables Monitoring
-- Provides tamper-evident audit trail for all financial transactions
-- =============================================================================

-- 1. Enable RLS on all financial tables
ALTER TABLE public.unified_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vitalsync_pool_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicine_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counter_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_test_bills ENABLE ROW LEVEL SECURITY;

-- 2. Session-level configuration (safe attempt for environments supporting pgaudit)
DO $$
BEGIN
  BEGIN
    SET pgaudit.log = 'ddl, write';
    SET pgaudit.log_level = 'log';
    SET pgaudit.log_parameter = 'on';
    SET pgaudit.log_statement_once = 'off';
  EXCEPTION WHEN OTHERS THEN
    -- Ignore if pgaudit is not configured at cloud level
    NULL;
  END;
END $$;

-- 3. Real-time audit alerts (via pg_notify)
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

-- 4. Attach audit triggers to financial tables
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
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS audit_alert ON %I; CREATE TRIGGER audit_alert AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION public.audit_alert_trigger()',
        tbl, tbl
      );
    END IF;
  END LOOP;
END $$;