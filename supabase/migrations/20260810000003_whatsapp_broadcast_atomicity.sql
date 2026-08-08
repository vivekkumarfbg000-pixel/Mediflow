-- Migration: whatsapp_broadcast_queue Concurrency and Double-Dispatch Fix
-- Atomically fetches and transitions pending broadcast messages to 'processing'
-- using FOR UPDATE SKIP LOCKED to prevent multiple workers from processing the same messages.

CREATE OR REPLACE FUNCTION public.pop_pending_broadcast_batch(
    p_campaign_id TEXT,
    p_pod_id UUID,
    p_limit INTEGER
)
RETURNS SETOF public.whatsapp_broadcast_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH locked_rows AS (
        SELECT id
        FROM public.whatsapp_broadcast_queue
        WHERE campaign_id = p_campaign_id
          AND pod_id = p_pod_id
          AND status = 'pending'
        ORDER BY created_at ASC
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.whatsapp_broadcast_queue q
    SET status = 'processing',
        updated_at = NOW()
    FROM locked_rows
    WHERE q.id = locked_rows.id
    RETURNING q.*;
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.pop_pending_broadcast_batch(TEXT, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pop_pending_broadcast_batch(TEXT, UUID, INTEGER) TO service_role;
