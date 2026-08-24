-- Migration: Add token_number to appointments table idempotently
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS token_number TEXT;
