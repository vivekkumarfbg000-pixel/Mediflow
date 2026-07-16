-- Add clinic_display_name column to waba_connections table
ALTER TABLE public.waba_connections 
ADD COLUMN IF NOT EXISTS clinic_display_name VARCHAR(255);
