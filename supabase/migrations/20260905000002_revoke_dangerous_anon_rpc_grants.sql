-- =============================================================================
-- Migration: 20260905000002_revoke_dangerous_anon_rpc_grants.sql
-- Description: Revokes unauthenticated public/anon execution grants on financial
-- settlements, revenue accumulation, and background queue RPC functions.
-- =============================================================================

-- 1. Lock down Invoice Settlement (Strictly authenticated clinicians & service_role only)
REVOKE EXECUTE ON FUNCTION public.process_invoice_settlement(TEXT, TEXT, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_invoice_settlement(TEXT, TEXT, NUMERIC, TEXT) TO authenticated, service_role;

-- 2. Lock down Platform Revenue Accumulation
REVOKE EXECUTE ON FUNCTION public.accumulate_platform_revenue(UUID, NUMERIC, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accumulate_platform_revenue(UUID, NUMERIC, BOOLEAN) TO authenticated, service_role;

-- 3. Lock down Chronic Refill Assertion
REVOKE EXECUTE ON FUNCTION public.process_chronic_refill_assertion(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_chronic_refill_assertion(UUID, TEXT) TO authenticated, service_role;

-- 4. Lock down Broadcast Queue Batch Retrieval
REVOKE EXECUTE ON FUNCTION public.pop_pending_broadcast_batch(TEXT, UUID, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pop_pending_broadcast_batch(TEXT, UUID, INT) TO authenticated, service_role;

-- 5. Lock down DevSecOps Auto-Heal Trigger
REVOKE EXECUTE ON FUNCTION public.trigger_devsecops_auto_heal() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trigger_devsecops_auto_heal() TO authenticated, service_role;
