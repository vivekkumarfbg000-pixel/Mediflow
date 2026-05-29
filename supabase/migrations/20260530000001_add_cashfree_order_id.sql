-- Mediflow SaaS — Add Cashfree Order ID column to unified_invoices migration
-- This supports mapping asynchronous payment gateway webhooks back to the original invoice.

ALTER TABLE public.unified_invoices 
ADD COLUMN IF NOT EXISTS cashfree_order_id VARCHAR(100) UNIQUE;

-- Create an index to optimize webhook lookups by Cashfree Order ID
CREATE INDEX IF NOT EXISTS idx_unified_invoices_cashfree_order_id 
ON public.unified_invoices(cashfree_order_id);
