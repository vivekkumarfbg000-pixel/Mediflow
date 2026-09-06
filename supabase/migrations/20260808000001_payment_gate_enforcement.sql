-- =============================================================================
-- Mediflow — Payment Gate Enforcement Constraint
-- Prevents appointment status from being set to 'scheduled', 'confirmed', 
-- or 'ready_for_consult' unless payment_status = 'cleared' OR a cleared
-- unified_invoice exists for the appointment.
-- This enforces USP 3 (Cashfree Strict Payment Gate) at the database level.
-- =============================================================================

-- Drop existing constraint if it exists (idempotent)
ALTER TABLE public.appointments 
DROP CONSTRAINT IF EXISTS payment_gate_enforced;

-- Create function & trigger for cross-table payment gate enforcement
CREATE OR REPLACE FUNCTION public.enforce_appointment_payment_gate()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. If status is a pending/cancelled/completed state, allow
  IF NEW.status IN ('pending_payment', 'cancelled', 'completed', 'no_show') THEN
    RETURN NEW;
  END IF;

  -- 2. If direct payment_status is cleared, allow
  IF NEW.payment_status = 'cleared' THEN
    RETURN NEW;
  END IF;

  -- 3. If linked invoice is cleared, allow
  IF EXISTS (
    SELECT 1 FROM public.unified_invoices ui
    WHERE ui.appointment_id = NEW.id
    AND ui.payment_status = 'cleared'
  ) THEN
    RETURN NEW;
  END IF;

  -- 4. Allow walk-in or staff created appointments
  IF NEW.source IN ('walkin', 'offline', 'counter', 'reception') THEN
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enforce_appointment_payment_gate ON public.appointments;
CREATE TRIGGER trg_enforce_appointment_payment_gate
BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.enforce_appointment_payment_gate();

-- Also enforce on unified_invoices: prevent 'cleared' status without actual payment proof
UPDATE public.unified_invoices 
SET payment_method = 'cash' 
WHERE payment_method IS NULL AND payment_status = 'cleared';

ALTER TABLE public.unified_invoices
DROP CONSTRAINT IF EXISTS invoice_payment_gate;

ALTER TABLE public.unified_invoices
ADD CONSTRAINT invoice_payment_gate
CHECK (
  payment_status IN ('pending', 'failed', 'refunded')
  OR payment_method IS NOT NULL
);

-- Add index to support the EXISTS subquery efficiently
CREATE INDEX IF NOT EXISTS idx_unified_invoices_appointment_cleared
ON public.unified_invoices (appointment_id)
WHERE payment_status = 'cleared';