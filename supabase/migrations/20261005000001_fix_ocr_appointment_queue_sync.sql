-- ============================================================================
-- VITALSYNC CLINIC OS: OCR APPOINTMENT QUEUE SYNC & STATUS CONSTRAINT EXPANSION
-- Migration: 20261005000001_fix_ocr_appointment_queue_sync.sql
-- Date: 2026-10-05
-- Description: Ensures appointments_status_check includes 'ready_for_consult',
-- guarantees payment_status allows 'cleared', and adds indexes for fast pod OPD queue hydration.
-- ============================================================================

-- 1. Expand appointments_status_check constraint to include ready_for_consult
DO $$
BEGIN
  ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
  ALTER TABLE public.appointments ADD CONSTRAINT appointments_status_check 
    CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'pending_payment', 'awaiting_vitals', 'arrived', 'ready_for_consult'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Notice: appointments_status_check update handled: %', SQLERRM;
END $$;

-- 2. Expand appointments payment_status check constraint to ensure 'cleared' and 'unverified' are valid
DO $$
BEGIN
  ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_payment_status_check;
  ALTER TABLE public.appointments ADD CONSTRAINT appointments_payment_status_check 
    CHECK (payment_status IN ('pending', 'cleared', 'paid', 'unverified', 'failed', 'refunded'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Notice: appointments_payment_status_check update handled: %', SQLERRM;
END $$;

-- 3. Ensure required columns exist on public.appointments
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'walkin';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'cleared';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS token_number TEXT;

-- 4. High-performance index for live OPD queue queries
CREATE INDEX IF NOT EXISTS idx_appointments_pod_date_status ON public.appointments(pod_id, appointment_date, status);
CREATE INDEX IF NOT EXISTS idx_appointments_payment_status ON public.appointments(payment_status);

-- 5. Realtime CDC Publication verification for appointments
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;
