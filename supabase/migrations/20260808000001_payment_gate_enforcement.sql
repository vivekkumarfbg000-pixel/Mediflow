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

-- Add the payment gate enforcement check constraint
-- An appointment can only have these statuses if:
-- 1. It's a pending/cancelled state (no payment needed), OR
-- 2. payment_status is explicitly 'cleared', OR  
-- 3. There exists a unified_invoice for this appointment with payment_status = 'cleared'
ALTER TABLE public.appointments
ADD CONSTRAINT payment_gate_enforced
CHECK (
  status IN ('pending_payment', 'cancelled', 'completed', 'no_show')
  OR payment_status = 'cleared'
  OR EXISTS (
    SELECT 1 FROM public.unified_invoices ui
    WHERE ui.appointment_id = appointments.id
    AND ui.payment_status = 'cleared'
  )
);

-- Also enforce on unified_invoices: prevent 'cleared' status without actual payment proof
-- (This is a secondary defense - primary is webhook verification)
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

-- Comment for documentation
COMMENT ON CONSTRAINT payment_gate_enforced ON public.appointments IS
'ENFORCES USP 3: Appointment cannot be scheduled/confirmed/ready_for_consult without cleared payment. Allows pending_payment, cancelled, completed, no_show without payment. Allows any status if payment_status=cleared OR linked invoice is cleared.';

COMMENT ON CONSTRAINT invoice_payment_gate ON public.unified_invoices IS
'Requires payment_method to be set when payment_status=cleared. Prevents manual DB updates from bypassing payment verification.';