-- =============================================================================
-- Mediflow — Atomic LLM Usage Counter RPC
-- Provides atomic increment for sessionData.llmUsage.count to prevent
-- lost update race conditions when multiple concurrent webhook invocations
-- process AI queries for the same session.
-- =============================================================================

CREATE OR REPLACE FUNCTION increment_llm_usage(p_session_id UUID)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE whatsapp_sessions
  SET session_data = jsonb_set(
    COALESCE(session_data, '{}'::jsonb),
    '{llmUsage,count}',
    to_jsonb(COALESCE((session_data->'llmUsage'->>'count')::int, 0) + 1)
  ),
  last_interaction = NOW()
  WHERE id = p_session_id
  RETURNING (session_data->'llmUsage'->>'count')::int
  INTO new_count;
  
  RETURN new_count;
END;
$$;

-- Grant execute permission to service role and authenticated users
GRANT EXECUTE ON FUNCTION increment_llm_usage(UUID) TO service_role, authenticated;

-- Comment for documentation
COMMENT ON FUNCTION increment_llm_usage(UUID) IS
'Atomically increments sessionData.llmUsage.count in whatsapp_sessions. Returns new count. Prevents lost update race conditions when multiple concurrent webhook invocations process AI queries for the same session.';