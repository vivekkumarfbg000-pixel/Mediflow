-- =============================================================================
-- Migration: Relax Constraints, Expand Invoice Statuses & Unblock WhatsApp RLS
-- Migration ID: 20260903000007_relax_constraints_expand_invoice_statuses_and_whatsapp_rls
-- =============================================================================

-- 0. Update audit_alert_trigger to use JSONB to safely inspect fields across all table schemas
CREATE OR REPLACE FUNCTION public.audit_alert_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_payload JSONB;
  v_old_json JSONB := to_jsonb(OLD);
  v_new_json JSONB := to_jsonb(NEW);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_payload := jsonb_build_object(
      'alert_type', 'FINANCIAL_DELETE',
      'table', TG_TABLE_NAME,
      'record_id', v_old_json->>'id',
      'deleted_by', session_user,
      'timestamp', NOW()
    );
    PERFORM pg_notify('financial_audit_alert', v_payload::text);
  ELSIF TG_OP = 'UPDATE' AND (
    (TG_TABLE_NAME = 'unified_invoices' AND (v_old_json->>'payment_status' IS DISTINCT FROM v_new_json->>'payment_status')) OR
    (TG_TABLE_NAME = 'appointments' AND (v_old_json->>'payment_status' IS DISTINCT FROM v_new_json->>'payment_status')) OR
    (TG_TABLE_NAME = 'unified_invoices' AND (v_old_json->>'total_amount' IS DISTINCT FROM v_new_json->>'total_amount'))
  ) THEN
    v_payload := jsonb_build_object(
      'alert_type', 'FINANCIAL_UPDATE',
      'table', TG_TABLE_NAME,
      'record_id', v_new_json->>'id',
      'changed_by', session_user,
      'old_values', v_old_json,
      'new_values', v_new_json,
      'timestamp', NOW()
    );
    PERFORM pg_notify('financial_audit_alert', v_payload::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Expand unified_invoices payment_status check constraint to support all care-loop statuses
ALTER TABLE public.unified_invoices 
  DROP CONSTRAINT IF EXISTS unified_invoices_payment_status_check;

ALTER TABLE public.unified_invoices 
  ADD CONSTRAINT unified_invoices_payment_status_check 
  CHECK (payment_status IN ('pending', 'paid', 'confirmed', 'cleared', 'unpaid', 'draft', 'pending_payment', 'cancelled', 'refunded'));

-- 2. Add amount alias to financial_ledgers to eliminate missing column errors
ALTER TABLE public.financial_ledgers 
  ADD COLUMN IF NOT EXISTS amount NUMERIC(10,2) DEFAULT 0.00;

UPDATE public.financial_ledgers 
SET amount = gross_amount 
WHERE (amount = 0.00 OR amount IS NULL) AND gross_amount IS NOT NULL;

-- 3. Relax strict NOT-NULL on encounters.doctor_id (enables Compounder intake before Doctor assignment)
ALTER TABLE public.encounters 
  ALTER COLUMN doctor_id DROP NOT NULL;

-- 4. Relax strict NOT-NULL on lab_requisitions.encounter_id (enables walk-in direct lab orders)
ALTER TABLE public.lab_requisitions 
  ALTER COLUMN encounter_id DROP NOT NULL;

-- 5. Open RLS policy on whatsapp_sessions for inbound webhooks and patient chat automation
DROP POLICY IF EXISTS "Allow public upsert to whatsapp_sessions" ON public.whatsapp_sessions;
DROP POLICY IF EXISTS "Enforce tenant pod isolation for whatsapp_sessions" ON public.whatsapp_sessions;

CREATE POLICY "Allow public upsert to whatsapp_sessions" ON public.whatsapp_sessions 
  FOR ALL TO authenticated, anon, service_role 
  USING (true) WITH CHECK (true);

-- 6. Activity logs action_type default to prevent NOT NULL crashes
ALTER TABLE public.activity_logs 
  ALTER COLUMN action_type DROP NOT NULL;

ALTER TABLE public.activity_logs 
  ALTER COLUMN action_type SET DEFAULT 'system_event';
