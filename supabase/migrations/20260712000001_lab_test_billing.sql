-- Mediflow Connected Care Ecosystem v2.3 - Lab Test Billing
-- Creates tables: lab_test_bills and lab_test_bill_items
-- Enables Pathology Lab to generate, collect, and track itemized test invoices.

-- 1. Create the lab_test_bills table
CREATE TABLE IF NOT EXISTS public.lab_test_bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patient_registry(id) ON DELETE CASCADE,
    encounter_id UUID REFERENCES public.encounters(id) ON DELETE SET NULL,
    lab_entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL,
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(10,2) DEFAULT 0.00,
    gst_amount NUMERIC(10,2) DEFAULT 0.00,
    total_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    payment_mode TEXT CHECK (payment_mode IN ('cash', 'upi', 'card')),
    status TEXT CHECK (status IN ('draft', 'confirmed', 'paid', 'cancelled')) DEFAULT 'draft',
    source TEXT CHECK (source IN ('encounter', 'walkin')) DEFAULT 'encounter',
    pod_id UUID NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create the lab_test_bill_items table
CREATE TABLE IF NOT EXISTS public.lab_test_bill_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES public.lab_test_bills(id) ON DELETE CASCADE,
    requisition_id UUID REFERENCES public.lab_requisitions(id) ON DELETE SET NULL,
    loinc_code TEXT NOT NULL,
    test_name TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    discount_percent NUMERIC(5,2) DEFAULT 0.00,
    gst_percent NUMERIC(5,2) DEFAULT 0.00,
    line_total NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_lab_test_bills_patient_id ON public.lab_test_bills(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_test_bills_pod_id ON public.lab_test_bills(pod_id);
CREATE INDEX IF NOT EXISTS idx_lab_test_bills_status ON public.lab_test_bills(status);
CREATE INDEX IF NOT EXISTS idx_lab_test_bill_items_bill_id ON public.lab_test_bill_items(bill_id);

-- 4. Enable RLS on both tables
ALTER TABLE public.lab_test_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_test_bill_items ENABLE ROW LEVEL SECURITY;

-- 5. Apply pod isolation policies (Direct pod index checks - subquery-free for maximum scaling)
DROP POLICY IF EXISTS "Enforce tenant pod isolation for lab_test_bills" ON public.lab_test_bills;
CREATE POLICY "Enforce tenant pod isolation for lab_test_bills" ON public.lab_test_bills
    FOR ALL TO authenticated
    USING (pod_id = public.get_user_pod());

DROP POLICY IF EXISTS "Enforce tenant pod isolation for lab_test_bill_items" ON public.lab_test_bill_items;
CREATE POLICY "Enforce tenant pod isolation for lab_test_bill_items" ON public.lab_test_bill_items
    FOR ALL TO authenticated
    USING (
        bill_id IN (
            SELECT id FROM public.lab_test_bills WHERE pod_id = public.get_user_pod()
        )
    );

-- 6. Allow anon inserts for offline-first sync patterns (same as medicine_bills)
DROP POLICY IF EXISTS "Allow anon insert lab_test_bills" ON public.lab_test_bills;
CREATE POLICY "Allow anon insert lab_test_bills" ON public.lab_test_bills
    FOR INSERT TO anon
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon insert lab_test_bill_items" ON public.lab_test_bill_items;
CREATE POLICY "Allow anon insert lab_test_bill_items" ON public.lab_test_bill_items
    FOR INSERT TO anon
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon select lab_test_bills" ON public.lab_test_bills;
CREATE POLICY "Allow anon select lab_test_bills" ON public.lab_test_bills
    FOR SELECT TO anon
    USING (true);

DROP POLICY IF EXISTS "Allow anon select lab_test_bill_items" ON public.lab_test_bill_items;
CREATE POLICY "Allow anon select lab_test_bill_items" ON public.lab_test_bill_items
    FOR SELECT TO anon
    USING (true);
