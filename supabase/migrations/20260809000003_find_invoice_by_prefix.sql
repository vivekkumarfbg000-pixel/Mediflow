-- =============================================================================
-- Mediflow: Structural Security Patch (Razorpay Webhook UUID Casting Type Crash Fix)
-- =============================================================================
-- ACTION REQUIRED: Run this script in your Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.find_invoice_by_prefix(p_prefix TEXT)
RETURNS SETOF public.unified_invoices
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM public.unified_invoices
  WHERE id::text LIKE p_prefix || '%';
$$;
