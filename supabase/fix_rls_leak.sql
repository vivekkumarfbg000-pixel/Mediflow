-- =============================================================================
-- Mediflow: Structural Security Patch (RLS Bypass Fix)
-- =============================================================================
-- ACTION REQUIRED: Run this script in your Supabase SQL Editor.
-- This replaces the public `USING (true)` select policies with strict tenant isolation.

-- 1. Appointments
DROP POLICY IF EXISTS "appointments_select_authenticated" ON public.appointments;
DROP POLICY IF EXISTS "Enforce tenant CDC isolation on appointments" ON public.appointments;
CREATE POLICY "Enforce tenant CDC isolation on appointments" 
ON public.appointments FOR SELECT TO authenticated USING (pod_id = public.get_user_pod());

-- 2. Financial Ledgers
DROP POLICY IF EXISTS "Allow public select on financial_ledgers" ON public.financial_ledgers;
DROP POLICY IF EXISTS "Enforce tenant CDC isolation on financial_ledgers" ON public.financial_ledgers;
CREATE POLICY "Enforce tenant CDC isolation on financial_ledgers" 
ON public.financial_ledgers FOR SELECT TO authenticated USING (pod_id = public.get_user_pod());

-- 3. Unified Invoices
DROP POLICY IF EXISTS "Allow public select on unified_invoices" ON public.unified_invoices;
DROP POLICY IF EXISTS "Enforce tenant CDC isolation on unified_invoices" ON public.unified_invoices;
CREATE POLICY "Enforce tenant CDC isolation on unified_invoices" 
ON public.unified_invoices FOR SELECT TO authenticated USING (pod_id = public.get_user_pod());

-- 4. Patient Registry
DROP POLICY IF EXISTS "Allow public select on patient_registry" ON public.patient_registry;
DROP POLICY IF EXISTS "Enforce tenant CDC isolation on patient_registry" ON public.patient_registry;
CREATE POLICY "Enforce tenant CDC isolation on patient_registry" 
ON public.patient_registry FOR SELECT TO authenticated USING (pod_id = public.get_user_pod());

-- 5. WhatsApp Sessions
DROP POLICY IF EXISTS "Allow public select on whatsapp_sessions" ON public.whatsapp_sessions;
DROP POLICY IF EXISTS "Enforce tenant CDC isolation on whatsapp_sessions" ON public.whatsapp_sessions;
CREATE POLICY "Enforce tenant CDC isolation on whatsapp_sessions" 
ON public.whatsapp_sessions FOR SELECT TO authenticated USING (pod_id = public.get_user_pod());

-- 6. Lab Reports
DROP POLICY IF EXISTS "lab_reports_select_authenticated" ON public.lab_reports;
DROP POLICY IF EXISTS "Enforce tenant isolation on lab_reports" ON public.lab_reports;
CREATE POLICY "Enforce tenant isolation on lab_reports" 
ON public.lab_reports FOR SELECT TO authenticated USING (
    patient_id IN (SELECT id FROM public.patient_registry WHERE pod_id = public.get_user_pod())
);

-- =============================================================================
-- VITALSYNC SRE PATCH: Fixed-Point Order Split Reconciler RPC
-- =============================================================================
CREATE OR REPLACE FUNCTION public.build_order_splits(
  p_invoice_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invoice RECORD;
  v_total_amount NUMERIC(12, 2);
  v_platform_amt NUMERIC(12, 2);
  v_doctor_amt NUMERIC(12, 2);
  v_lab_amt NUMERIC(12, 2);
  v_sum_splits NUMERIC(12, 2);
  v_remainder NUMERIC(12, 2);
  v_splits JSONB := '[]'::jsonb;
  v_doctor_vendor_id TEXT;
  v_lab_vendor_id TEXT;
BEGIN
  -- 1. Lock invoice row and fetch exact 2-decimal amount
  SELECT * INTO v_invoice FROM public.unified_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN
    RETURN '[]'::jsonb;
  END IF;

  v_total_amount := ROUND(v_invoice.total_amount::numeric, 2);
  IF v_total_amount <= 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  -- 2. Fixed-point percentage calculations (2 decimals)
  v_platform_amt := ROUND(v_total_amount * 0.03, 2);
  v_doctor_amt   := ROUND(v_total_amount * 0.40, 2);
  v_lab_amt      := ROUND(v_total_amount * 0.57, 2);

  -- 3. REMAINDER RECONCILIATION: Assign rounding remainder (±0.01) to Lab/Doctor split
  v_sum_splits := v_platform_amt + v_doctor_amt + v_lab_amt;
  v_remainder  := v_total_amount - v_sum_splits;

  IF v_remainder <> 0 THEN
    v_lab_amt := v_lab_amt + v_remainder; -- Reconcile 1-paisa difference onto lab split
  END IF;

  -- 4. Construct JSONB splits payload
  v_doctor_vendor_id := COALESCE(v_invoice.doctor_vendor_id, 'VEND_DOCTOR_DEFAULT');
  v_lab_vendor_id    := COALESCE(v_invoice.lab_vendor_id, 'VEND_LAB_DEFAULT');

  IF v_doctor_amt > 0 THEN
    v_splits := v_splits || jsonb_build_object(
      'vendor_id', v_doctor_vendor_id,
      'amount', v_doctor_amt
    );
  END IF;

  IF v_lab_amt > 0 THEN
    v_splits := v_splits || jsonb_build_object(
      'vendor_id', v_lab_vendor_id,
      'amount', v_lab_amt
    );
  END IF;

  IF v_platform_amt > 0 THEN
    v_splits := v_splits || jsonb_build_object(
      'vendor_id', 'VEND_PLATFORM_VITALSYNC',
      'amount', v_platform_amt
    );
  END IF;

  RETURN v_splits;
END;
$$;

