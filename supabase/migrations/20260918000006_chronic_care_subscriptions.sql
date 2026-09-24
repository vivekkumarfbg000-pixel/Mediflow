-- ==============================================================================
-- 🏛️ VitalSync Migration: Chronic Care Subscriptions & Care Program Retainers
-- Idempotent schema definition for Doctor-led Chronic Care Subscription Retainers
-- ==============================================================================

-- 1. Create chronic_care_subscriptions table if not exists
CREATE TABLE IF NOT EXISTS public.chronic_care_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patient_registry(id) ON DELETE CASCADE,
    patient_name TEXT,
    patient_phone TEXT,
    doctor_id TEXT,
    pod_id TEXT NOT NULL DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
    program_name TEXT NOT NULL DEFAULT 'DiabeteCare & CardioShield 365',
    duration_months INTEGER NOT NULL DEFAULT 6,
    total_fee NUMERIC(10, 2) NOT NULL DEFAULT 4000.00,
    monthly_virtual_visits INTEGER NOT NULL DEFAULT 1,
    visits_used INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    next_virtual_consult_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create indexes for high-speed lookup
CREATE INDEX IF NOT EXISTS idx_chronic_subs_patient ON public.chronic_care_subscriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_chronic_subs_pod ON public.chronic_care_subscriptions(pod_id);
CREATE INDEX IF NOT EXISTS idx_chronic_subs_status ON public.chronic_care_subscriptions(status);

-- 3. Add Care Program columns to patient_registry and chronic_care_cohorts
ALTER TABLE public.patient_registry ADD COLUMN IF NOT EXISTS is_care_program_enrolled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.patient_registry ADD COLUMN IF NOT EXISTS care_program_id UUID;
ALTER TABLE public.chronic_care_cohorts ADD COLUMN IF NOT EXISTS care_program_status TEXT DEFAULT 'not_enrolled';
ALTER TABLE public.chronic_care_cohorts ADD COLUMN IF NOT EXISTS care_program_fee NUMERIC(10, 2) DEFAULT 4000.00;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.chronic_care_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_chronic_subscriptions" ON public.chronic_care_subscriptions;
CREATE POLICY "allow_all_chronic_subscriptions" 
    ON public.chronic_care_subscriptions 
    FOR ALL 
    TO authenticated, anon 
    USING (true) 
    WITH CHECK (true);

-- 5. Add to supabase_realtime publication for sub-250ms CDC streaming
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'chronic_care_subscriptions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.chronic_care_subscriptions;
    END IF;
END $$;
