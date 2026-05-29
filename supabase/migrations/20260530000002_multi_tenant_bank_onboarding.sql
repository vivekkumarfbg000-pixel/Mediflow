-- Mediflow SaaS — Multi-Tenant Clinic Bank Onboarding & Cashfree Easy-Splits
-- This migration sets up sub-account vendor mapping and split billing tracking.

CREATE TABLE IF NOT EXISTS public.cashfree_vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pod_id UUID NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
    vendor_id VARCHAR(100) UNIQUE NOT NULL, -- Registered Cashfree Vendor sub-account ID
    holder_name VARCHAR(255) NOT NULL,
    bank_account_last4 VARCHAR(4) NOT NULL,
    verification_status VARCHAR(50) DEFAULT 'pending', -- pending, verified, failed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (pod_id, entity_id)
);

-- Enable Row-Level Security to isolate clinical bank records by pod
ALTER TABLE public.cashfree_vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enforce tenant pod isolation on cashfree_vendors" ON public.cashfree_vendors;
CREATE POLICY "Enforce tenant pod isolation on cashfree_vendors" 
ON public.cashfree_vendors 
FOR ALL TO authenticated 
USING (pod_id = public.get_user_pod());

-- Add columns to unified_invoices to track split payments status
ALTER TABLE public.unified_invoices 
ADD COLUMN IF NOT EXISTS split_settlement_status VARCHAR(50) DEFAULT 'unprocessed';

ALTER TABLE public.unified_invoices 
ADD COLUMN IF NOT EXISTS split_payload JSONB;

-- Grant execution/select permissions to authenticated roles
GRANT ALL ON TABLE public.cashfree_vendors TO authenticated;
