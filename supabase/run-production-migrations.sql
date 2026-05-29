-- =============================================================================
-- Mediflow — PRODUCTION DEPLOYMENT SQL
-- Run this SINGLE script in Supabase SQL Editor to apply all migrations.
-- This combines combined_upgrade.sql + pod_interconnect_views.sql
-- 
-- HOW TO RUN:
--   1. Go to: https://supabase.com/dashboard/project/kguupaybvbngyzyofjun/sql/new
--   2. Paste the ENTIRE contents of this file
--   3. Click "Run"
--   4. Verify: SELECT * FROM rate_limits LIMIT 1;  → no error
--              SELECT * FROM pod_daily_stats;       → empty or data rows
-- =============================================================================

-- Include combined_upgrade.sql contents first (all tables, RLS, triggers, rate_limits)
\ir combined_upgrade.sql

-- =============================================================================
-- Pod Interconnect Views (migration 20260531000001)
-- =============================================================================

-- Materialized view for cross-pod operational stats
CREATE OR REPLACE VIEW public.pod_daily_stats AS
SELECT 
  pod_id,
  COUNT(DISTINCT CASE WHEN entity_type = 'clinic' THEN id END) as clinic_count,
  COUNT(DISTINCT CASE WHEN entity_type = 'pharmacy' THEN id END) as pharmacy_count,  
  COUNT(DISTINCT CASE WHEN entity_type = 'lab' THEN id END) as lab_count
FROM public.entities 
WHERE status = 'approved'
GROUP BY pod_id;

-- Function to get pod entities for cross-visibility
CREATE OR REPLACE FUNCTION public.get_pod_entities(p_pod_id UUID)
RETURNS SETOF public.entities AS $$
  SELECT * FROM public.entities WHERE pod_id = p_pod_id AND status = 'approved';
$$ LANGUAGE sql SECURITY DEFINER;

-- Grant permissions to authenticated users
GRANT SELECT ON public.pod_daily_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pod_entities(UUID) TO authenticated;

-- =============================================================================
-- Verification Queries (run after script to confirm success)
-- =============================================================================
-- SELECT count(*) FROM public.rate_limits;           -- Should work (0 rows)
-- SELECT * FROM public.pod_daily_stats;              -- Should work (0 or more rows)
-- SELECT public.get_pod_entities(gen_random_uuid()); -- Should return 0 rows (no error)
-- SELECT public.check_rate_limit('127.0.0.1', 15, 60); -- Should return TRUE
-- =============================================================================
