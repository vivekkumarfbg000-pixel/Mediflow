-- Mediflow Connected Care Ecosystem v2.2 - Medicine Billing & Counter Transactions
-- Creates tables: counter_transactions, medicine_bills, and medicine_bill_items
-- Hardened with direct pod_id multi-tenant index columns for subquery-free RLS performance.

-- 1. Create the counter_transactions table
CREATE TABLE IF NOT EXISTS public.counter_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patient_registry(id) ON DELETE CASCADE,
    appointment_booked_at_counter BOOLEAN DEFAULT FALSE,
    lab_booked_at_counter BOOLEAN DEFAULT FALSE,
    discount_eligible BOOLEAN DEFAULT FALSE,
    discount_percent NUMERIC(5,2) DEFAULT 0.00,
    pod_id UUID NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create the medicine_bills table
CREATE TABLE IF NOT EXISTS public.medicine_bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patient_registry(id) ON DELETE CASCADE,
    encounter_id UUID REFERENCES public.encounters(id) ON DELETE SET NULL,
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    loyalty_discount_percent NUMERIC(5,2) DEFAULT 0.00,
    loyalty_discount_amount NUMERIC(10,2) DEFAULT 0.00,
    item_discount_amount NUMERIC(10,2) DEFAULT 0.00,
    gst_amount NUMERIC(10,2) DEFAULT 0.00,
    total_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    payment_mode TEXT CHECK (payment_mode IN ('cash', 'upi', 'card', 'whatsapp_pay')),
    upi_qr_payload TEXT,
    status TEXT CHECK (status IN ('draft', 'confirmed', 'paid', 'cancelled')) DEFAULT 'draft',
    source TEXT CHECK (source IN ('counter', 'whatsapp')) DEFAULT 'counter',
    delivery_type TEXT CHECK (delivery_type IN ('pickup', 'shiprocket')) DEFAULT 'pickup',
    delivery_address TEXT,
    delivery_charge NUMERIC(10,2) DEFAULT 0.00,
    shiprocket_order_id TEXT,
    pod_id UUID NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create the medicine_bill_items table
CREATE TABLE IF NOT EXISTS public.medicine_bill_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES public.medicine_bills(id) ON DELETE CASCADE,
    inventory_item_id TEXT NOT NULL,
    name TEXT NOT NULL,
    batch_number TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    mrp NUMERIC(10,2) NOT NULL,
    selling_price NUMERIC(10,2) NOT NULL,
    discount_percent NUMERIC(5,2) DEFAULT 0.00,
    gst_percent NUMERIC(5,2) DEFAULT 0.00,
    line_total NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS on all three tables
ALTER TABLE public.counter_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicine_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicine_bill_items ENABLE ROW LEVEL SECURITY;

-- 5. Apply pod isolation policies (Direct pod index checks - subquery-free for maximum scaling)
DROP POLICY IF EXISTS "Enforce tenant pod isolation for counter_transactions" ON public.counter_transactions;
CREATE POLICY "Enforce tenant pod isolation for counter_transactions" ON public.counter_transactions
    FOR ALL TO authenticated
    USING (pod_id = public.get_user_pod());

DROP POLICY IF EXISTS "Enforce tenant pod isolation for medicine_bills" ON public.medicine_bills;
CREATE POLICY "Enforce tenant pod isolation for medicine_bills" ON public.medicine_bills
    FOR ALL TO authenticated
    USING (pod_id = public.get_user_pod());

DROP POLICY IF EXISTS "Enforce tenant pod isolation for medicine_bill_items" ON public.medicine_bill_items;
CREATE POLICY "Enforce tenant pod isolation for medicine_bill_items" ON public.medicine_bill_items
    FOR ALL TO authenticated
    USING (
        bill_id IN (
            SELECT id FROM public.medicine_bills WHERE pod_id = public.get_user_pod()
        )
    );
