-- Migration ID: 20260626000005_fix_saas_revenue_stats
-- Purpose: Fix the get_saas_revenue_stats RPC which was crashing due to querying a non-existent 'status' column on unified_invoices instead of 'payment_status'.

CREATE OR REPLACE FUNCTION public.get_saas_revenue_stats()
RETURNS JSONB AS $$
DECLARE
  v_gmv NUMERIC(10,2);
  v_platform_commission NUMERIC(10,2);
  v_paid_invoices INT;
  v_unpaid_invoices INT;
BEGIN
  SELECT COALESCE(SUM(total_amount), 0.00) INTO v_gmv FROM public.unified_invoices;
  
  -- Sum up paid/confirmed invoices commissions
  SELECT COALESCE(SUM(platform_fee), 0.00) INTO v_platform_commission 
  FROM public.unified_invoices 
  WHERE payment_status = 'paid' OR payment_status = 'confirmed';
  
  SELECT COUNT(*) INTO v_paid_invoices 
  FROM public.unified_invoices 
  WHERE payment_status = 'paid' OR payment_status = 'confirmed';
  
  SELECT COUNT(*) INTO v_unpaid_invoices 
  FROM public.unified_invoices 
  WHERE payment_status = 'unpaid' OR payment_status = 'draft';
  
  RETURN jsonb_build_object(
    'total_gmv', v_gmv,
    'platform_commission', v_platform_commission,
    'paid_invoices', v_paid_invoices,
    'unpaid_invoices', v_unpaid_invoices
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.get_saas_revenue_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_saas_revenue_stats() TO authenticated;
