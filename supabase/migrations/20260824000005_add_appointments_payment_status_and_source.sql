-- =============================================================================
-- STEP 40: Appointments Schema Resiliency (20260824000005)
-- Adds payment_status and source columns to public.appointments idempotently
-- =============================================================================

ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'whatsapp';
