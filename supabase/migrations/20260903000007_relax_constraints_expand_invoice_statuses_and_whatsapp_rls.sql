-- =============================================================================
-- Migration: Relax Constraints, Expand Invoice Statuses & Unblock WhatsApp RLS
-- Migration ID: 20260903000007_relax_constraints_expand_invoice_statuses_and_whatsapp_rls
-- =============================================================================

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
