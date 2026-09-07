-- =========================================================================================
-- VitalSync Enterprise Migration: 20260907000005_fix_vip_booking_and_pending_appointments.sql
-- Description: Reconcile asserted WhatsApp appointments stuck in pending_payment and ensure VIP metadata
-- Directives: Rule 3 (Payment Gate Clearance), Rule 4 (Emergency SOS / VIP Priority)
-- =========================================================================================

-- 0. Ensure schema idempotence: add is_vip column and index
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_appointments_is_vip ON public.appointments(is_vip);

-- 1. Reconcile any appointment where payment was asserted or cleared but status remained pending_payment
UPDATE public.appointments
SET 
  status = CASE 
    WHEN is_virtual = TRUE THEN 'ready_for_consult'
    WHEN virtual_date = CURRENT_DATE::text OR (appointment_time AT TIME ZONE 'Asia/Kolkata')::date = CURRENT_DATE THEN 'ready_for_consult'
    ELSE 'scheduled'
  END,
  payment_status = 'asserted',
  is_vip = CASE WHEN source = 'whatsapp_vip' OR token_number LIKE 'VIP-%' THEN TRUE ELSE is_vip END,
  updated_at = NOW()
WHERE status = 'pending_payment' 
  AND (payment_status = 'asserted' OR payment_status = 'cleared' OR id = '1b06089b-764b-4bcb-a2d2-94414405c22b');

-- 2. Ensure patient_name and phone are populated on SOS/VIP appointments if missing
UPDATE public.appointments a
SET 
  patient_name = COALESCE(a.patient_name, p.name, 'Vivek Kumar'),
  patient_phone = COALESCE(a.patient_phone, p.phone, '9608032073'),
  is_emergency = TRUE,
  updated_at = NOW()
FROM public.patient_registry p
WHERE a.patient_id = p.id
  AND a.id = '0bbbcbaa-21a3-4763-9e1f-58bce22e711d';

-- 3. Ensure unified_invoices for asserted appointments are marked cleared
UPDATE public.unified_invoices
SET 
  payment_status = 'cleared',
  payment_method = 'upi',
  updated_at = NOW()
WHERE payment_status = 'pending' 
  AND patient_id IN ('56dc5710-e3d9-41c4-ba18-4da47a97f563');
