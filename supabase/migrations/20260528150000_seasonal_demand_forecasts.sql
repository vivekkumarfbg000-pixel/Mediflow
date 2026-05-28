-- Mediflow Connected Care Ecosystem Upgrade Migration
-- Creates the public.seasonal_demand_forecasts table to store AI inventory predictions
-- Enforces strict multi-tenant tenant-pod row isolation via public.get_user_pod()

-- 1. Create the table
CREATE TABLE IF NOT EXISTS public.seasonal_demand_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
    medicine_name TEXT NOT NULL,
    suggested_increase_percentage INTEGER NOT NULL,
    reason TEXT NOT NULL,
    forecast_confidence NUMERIC(3,2) DEFAULT 0.85,
    is_acted_upon BOOLEAN DEFAULT FALSE,
    pod_id UUID NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row-Level Security (RLS)
ALTER TABLE public.seasonal_demand_forecasts ENABLE ROW LEVEL SECURITY;

-- 3. Apply high-performance direct RLS policies
DROP POLICY IF EXISTS "Enforce tenant pod isolation for seasonal_demand_forecasts" ON public.seasonal_demand_forecasts;
CREATE POLICY "Enforce tenant pod isolation for seasonal_demand_forecasts" ON public.seasonal_demand_forecasts
    FOR ALL TO authenticated
    USING (pod_id = public.get_user_pod());

-- 4. Grant privileges for API and service connections
GRANT ALL ON public.seasonal_demand_forecasts TO authenticated;
GRANT ALL ON public.seasonal_demand_forecasts TO service_role;

-- 5. Create index optimizations for rapid query performance
CREATE INDEX IF NOT EXISTS idx_seasonal_demand_forecasts_pod_id ON public.seasonal_demand_forecasts(pod_id);
CREATE INDEX IF NOT EXISTS idx_seasonal_demand_forecasts_pharmacy ON public.seasonal_demand_forecasts(pharmacy_entity_id);
