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
