-- VitalSync SaaS Upgrade Migration: Transaction-Based Revenue Share Model
-- Adds platform fee configuration, commission tracking, and verification status fields

-- 1. Add platform fee percent, lifetime revenue tracking, pending cash balance, and billing verification status to public.pods
ALTER TABLE public.pods 
ADD COLUMN IF NOT EXISTS platform_fee_percent NUMERIC(4, 2) DEFAULT 2.50,
ADD COLUMN IF NOT EXISTS lifetime_platform_revenue NUMERIC(12, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS pending_cash_balance NUMERIC(12, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS is_verified_for_billing BOOLEAN DEFAULT FALSE;

-- 2. Add platform fee deducted, net gateway disbursement, and payment method columns to public.financial_ledgers
ALTER TABLE public.financial_ledgers
ADD COLUMN IF NOT EXISTS platform_fee_deducted NUMERIC(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS gateway_disbursed_net NUMERIC(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'upi';

-- 3. Add payment method column to public.unified_invoices
ALTER TABLE public.unified_invoices
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'upi';

-- 4. Update existing pods to mark them verified so existing demo/seed pods are active
UPDATE public.pods SET is_verified_for_billing = TRUE;

-- 5. Create RPC to safely increment platform revenue and pending cash balance on pod
CREATE OR REPLACE FUNCTION public.accumulate_platform_revenue(p_pod_id UUID, p_amount NUMERIC, p_is_cash BOOLEAN DEFAULT FALSE)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.pods 
    SET 
        lifetime_platform_revenue = COALESCE(lifetime_platform_revenue, 0) + p_amount,
        pending_cash_balance = CASE WHEN p_is_cash THEN COALESCE(pending_cash_balance, 0) + p_amount ELSE pending_cash_balance END
    WHERE id = p_pod_id;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.accumulate_platform_revenue(UUID, NUMERIC, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accumulate_platform_revenue(UUID, NUMERIC, BOOLEAN) TO authenticated;
