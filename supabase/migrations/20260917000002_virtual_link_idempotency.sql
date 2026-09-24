-- Migration: Add idempotency flag for virtual meeting link dispatches
-- Prevents the evening cron from spamming duplicate WhatsApp messages for the same virtual appointment

ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS virtual_link_dispatched BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_appointments_virtual_link_dispatched 
ON public.appointments(virtual_link_dispatched, appointment_time) 
WHERE virtual_link_dispatched = false;
