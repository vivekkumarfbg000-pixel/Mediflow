-- =====================================================================================
-- Migration: 20260917000001_free_virtual_consult_partner_loyalty_gate.sql
-- Description: Enforces that 1 Free Virtual Consult is unlocked ONLY when a patient
--              buys medicine from partner pharmacy AND lab test from partner pathology,
--              with billing for both completed on the VitalSync platform.
-- =====================================================================================

-- 1. Ensure columns on public.patient_registry
ALTER TABLE IF EXISTS public.patient_registry
  ADD COLUMN IF NOT EXISTS is_premium_member BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS free_virtual_consults_available INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_virtual_unlocked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS free_virtual_expires_at TIMESTAMPTZ;

-- 2. Idempotent RPC: check_patient_free_virtual_eligibility
CREATE OR REPLACE FUNCTION public.check_patient_free_virtual_eligibility(p_patient_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_pharmacy BOOLEAN := false;
  v_has_lab BOOLEAN := false;
  v_is_eligible BOOLEAN := false;
  v_cutoff_time TIMESTAMPTZ := now() - INTERVAL '30 days';
  v_result JSONB;
BEGIN
  -- Check 1: Paid medicine bill from partner pharmacy in last 30 days
  SELECT EXISTS (
    SELECT 1 FROM public.medicine_bills
    WHERE patient_id = p_patient_id
      AND lower(status) = 'paid'
      AND created_at >= v_cutoff_time
  ) INTO v_has_pharmacy;

  -- Fallback / alternative: Check unified_invoices with pharmacy_fee > 0 cleared
  IF NOT v_has_pharmacy THEN
    SELECT EXISTS (
      SELECT 1 FROM public.unified_invoices
      WHERE patient_id = p_patient_id
        AND lower(payment_status) = 'cleared'
        AND pharmacy_fee > 0
        AND created_at >= v_cutoff_time
    ) INTO v_has_pharmacy;
  END IF;

  -- Check 2: Paid/completed lab test from partner pathology in last 30 days
  SELECT EXISTS (
    SELECT 1 FROM public.lab_requisitions
    WHERE patient_id = p_patient_id
      AND lower(status) IN ('completed', 'sample_collected', 'approved', 'verified', 'paid')
      AND created_at >= v_cutoff_time
  ) INTO v_has_lab;

  -- Fallback / alternative: Check unified_invoices with lab_fee > 0 cleared
  IF NOT v_has_lab THEN
    SELECT EXISTS (
      SELECT 1 FROM public.unified_invoices
      WHERE patient_id = p_patient_id
        AND lower(payment_status) = 'cleared'
        AND lab_fee > 0
        AND created_at >= v_cutoff_time
    ) INTO v_has_lab;
  END IF;

  -- Patient is eligible ONLY if BOTH partner pharmacy AND partner pathology are billed on platform
  v_is_eligible := (v_has_pharmacy AND v_has_lab);

  -- If eligible, ensure patient_registry is updated
  IF v_is_eligible THEN
    UPDATE public.patient_registry
    SET is_premium_member = true,
        free_virtual_consults_available = GREATEST(COALESCE(free_virtual_consults_available, 0), 1),
        free_virtual_unlocked_at = COALESCE(free_virtual_unlocked_at, now()),
        free_virtual_expires_at = COALESCE(free_virtual_expires_at, now() + INTERVAL '30 days')
    WHERE id = p_patient_id;
  END IF;

  v_result := jsonb_build_object(
    'patient_id', p_patient_id,
    'has_pharmacy_billed', v_has_pharmacy,
    'has_lab_billed', v_has_lab,
    'is_eligible', v_is_eligible,
    'cutoff_time', v_cutoff_time
  );

  RETURN v_result;
END;
$$;

-- 3. Trigger function to automatically evaluate loyalty on bill clearance
CREATE OR REPLACE FUNCTION public.trg_fn_sync_free_virtual_loyalty()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_patient_id UUID;
BEGIN
  v_patient_id := NEW.patient_id;

  IF v_patient_id IS NOT NULL THEN
    PERFORM public.check_patient_free_virtual_eligibility(v_patient_id);
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Idempotent Triggers on medicine_bills, lab_requisitions, and unified_invoices
DROP TRIGGER IF EXISTS trg_medicine_bills_loyalty ON public.medicine_bills;
CREATE TRIGGER trg_medicine_bills_loyalty
  AFTER INSERT OR UPDATE OF status ON public.medicine_bills
  FOR EACH ROW
  WHEN (lower(NEW.status) = 'paid')
  EXECUTE FUNCTION public.trg_fn_sync_free_virtual_loyalty();

DROP TRIGGER IF EXISTS trg_lab_requisitions_loyalty ON public.lab_requisitions;
CREATE TRIGGER trg_lab_requisitions_loyalty
  AFTER INSERT OR UPDATE OF status ON public.lab_requisitions
  FOR EACH ROW
  WHEN (lower(NEW.status) IN ('completed', 'sample_collected', 'approved', 'verified', 'paid'))
  EXECUTE FUNCTION public.trg_fn_sync_free_virtual_loyalty();

DROP TRIGGER IF EXISTS trg_unified_invoices_loyalty ON public.unified_invoices;
CREATE TRIGGER trg_unified_invoices_loyalty
  AFTER INSERT OR UPDATE OF payment_status ON public.unified_invoices
  FOR EACH ROW
  WHEN (lower(NEW.payment_status) = 'cleared')
  EXECUTE FUNCTION public.trg_fn_sync_free_virtual_loyalty();

-- 5. RPC to consume / redeem the Free Virtual Consult voucher
CREATE OR REPLACE FUNCTION public.redeem_patient_free_virtual_consult(p_patient_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.patient_registry
  SET free_virtual_consults_available = GREATEST(0, COALESCE(free_virtual_consults_available, 1) - 1),
      is_premium_member = false
  WHERE id = p_patient_id;

  RETURN true;
END;
$$;
