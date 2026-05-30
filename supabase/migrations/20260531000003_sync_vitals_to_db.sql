-- Alter patient_registry to add vitals, token_number, and queue_status columns
ALTER TABLE public.patient_registry ADD COLUMN IF NOT EXISTS vitals JSONB;
ALTER TABLE public.patient_registry ADD COLUMN IF NOT EXISTS token_number TEXT;
ALTER TABLE public.patient_registry ADD COLUMN IF NOT EXISTS queue_status TEXT DEFAULT 'awaiting_vitals';
