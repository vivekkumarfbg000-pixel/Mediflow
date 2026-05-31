-- =============================================================================
-- Mediflow Connected Care Ecosystem
-- Migration: 20260531000030_fix_security_invoker_views.sql
--
-- Purpose: Fix the security_invoker property for public.pod_daily_stats view.
--          By default, views run under security definer privilege (bypass RLS of
--          querying user). Setting security_invoker = true forces the view to
--          respect the querying user's RLS policies, satisfying Supabase Security
--          Advisor rules and protecting patient/tenant boundaries.
-- =============================================================================

-- Drop the old view that lacks security_invoker
DROP VIEW IF EXISTS public.pod_daily_stats;

-- Create the view with security_invoker set to true
CREATE VIEW public.pod_daily_stats
WITH (security_invoker = true) AS
SELECT
  pod_id,
  COUNT(DISTINCT CASE WHEN entity_type = 'clinic'   THEN id END) AS clinic_count,
  COUNT(DISTINCT CASE WHEN entity_type = 'pharmacy' THEN id END) AS pharmacy_count,
  COUNT(DISTINCT CASE WHEN entity_type = 'lab'      THEN id END) AS lab_count
FROM public.entities
WHERE status = 'approved'
GROUP BY pod_id;

-- Add comments for documentation
COMMENT ON VIEW public.pod_daily_stats IS
  'Aggregated count of approved pod entity members by type. Enforces Row-Level Security (RLS) under the querying user.';

-- Re-grant read access to authenticated users
GRANT SELECT ON public.pod_daily_stats TO authenticated;
