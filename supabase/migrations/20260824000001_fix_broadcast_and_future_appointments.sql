-- =============================================================================
-- Migration: Fix Broadcast Campaigns, Queue Constraints & Idempotent RPCs
-- Date: 2026-08-24
-- Purpose:
--   1. Ensure whatsapp_broadcast_queue and whatsapp_broadcast_campaigns exist and are idempotent.
--   2. Ensure enqueue_broadcast_campaign and pop_pending_broadcast_batch RPCs exist.
-- =============================================================================

DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'whatsapp_broadcast_queue' 
          AND column_name = 'patient_id'
          AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE public.whatsapp_broadcast_queue ALTER COLUMN patient_id DROP NOT NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.whatsapp_broadcast_campaigns (
    id TEXT PRIMARY KEY,
    pod_id UUID NOT NULL,
    target_cohort TEXT NOT NULL DEFAULT 'all',
    message_text TEXT NOT NULL,
    recipient_count INT NOT NULL DEFAULT 0,
    delivered_count INT NOT NULL DEFAULT 0,
    failed_count INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_broadcast_campaigns_pod ON public.whatsapp_broadcast_campaigns(pod_id, created_at DESC);
ALTER TABLE public.whatsapp_broadcast_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users on broadcast campaigns" ON public.whatsapp_broadcast_campaigns;
CREATE POLICY "Enable read access for authenticated users on broadcast campaigns"
ON public.whatsapp_broadcast_campaigns FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Enable insert access for authenticated users on broadcast campaigns" ON public.whatsapp_broadcast_campaigns;
CREATE POLICY "Enable insert access for authenticated users on broadcast campaigns"
ON public.whatsapp_broadcast_campaigns FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update access for authenticated users on broadcast campaigns" ON public.whatsapp_broadcast_campaigns;
CREATE POLICY "Enable update access for authenticated users on broadcast campaigns"
ON public.whatsapp_broadcast_campaigns FOR UPDATE
USING (true);

ALTER TABLE public.waba_connections ADD COLUMN IF NOT EXISTS access_token TEXT;

CREATE OR REPLACE FUNCTION public.enqueue_broadcast_campaign(
    p_pod_id UUID,
    p_campaign_id TEXT,
    p_target_cohort TEXT,
    p_message_text TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pod_id UUID := COALESCE(p_pod_id, 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'::uuid);
    v_inserted_count INT := 0;
BEGIN
    IF p_target_cohort = 'all' THEN
        INSERT INTO whatsapp_broadcast_queue (pod_id, campaign_id, patient_id, patient_phone, message_text)
        SELECT v_pod_id, p_campaign_id, id, phone, p_message_text
        FROM patient_registry
        WHERE (pod_id = v_pod_id OR pod_id IS NULL)
          AND phone IS NOT NULL AND length(phone) >= 10;
          
    ELSIF p_target_cohort = 'diabetes' THEN
        INSERT INTO whatsapp_broadcast_queue (pod_id, campaign_id, patient_id, patient_phone, message_text)
        SELECT v_pod_id, p_campaign_id, id, phone, p_message_text
        FROM patient_registry
        WHERE (pod_id = v_pod_id OR pod_id IS NULL)
          AND phone IS NOT NULL AND length(phone) >= 10
          AND (
            COALESCE(condition, '') ILIKE '%diabet%' 
            OR COALESCE(tags::text, '') ILIKE '%diabet%'
            OR COALESCE(medical_history::text, '') ILIKE '%diabet%'
            OR COALESCE(vitals::text, '') ILIKE '%sugar%'
          );
          
    ELSIF p_target_cohort = 'hypertension' THEN
        INSERT INTO whatsapp_broadcast_queue (pod_id, campaign_id, patient_id, patient_phone, message_text)
        SELECT v_pod_id, p_campaign_id, id, phone, p_message_text
        FROM patient_registry
        WHERE (pod_id = v_pod_id OR pod_id IS NULL)
          AND phone IS NOT NULL AND length(phone) >= 10
          AND (
            COALESCE(condition, '') ILIKE '%hyper%' 
            OR COALESCE(tags::text, '') ILIKE '%bp%' 
            OR COALESCE(tags::text, '') ILIKE '%hyper%'
            OR COALESCE(medical_history::text, '') ILIKE '%bp%'
            OR COALESCE(vitals::text, '') ILIKE '%bp%'
          );
          
    ELSE
        INSERT INTO whatsapp_broadcast_queue (pod_id, campaign_id, patient_id, patient_phone, message_text)
        SELECT v_pod_id, p_campaign_id, id, phone, p_message_text
        FROM patient_registry
        WHERE (pod_id = v_pod_id OR pod_id IS NULL)
          AND phone IS NOT NULL AND length(phone) >= 10;
    END IF;

    GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

    INSERT INTO whatsapp_broadcast_campaigns (id, pod_id, target_cohort, message_text, recipient_count, status)
    VALUES (p_campaign_id, v_pod_id, p_target_cohort, p_message_text, v_inserted_count, 'Delivered & Processing ⚡')
    ON CONFLICT (id) DO UPDATE SET
        recipient_count = EXCLUDED.recipient_count,
        updated_at = NOW();

    RETURN jsonb_build_object(
        'success', true,
        'campaign_id', p_campaign_id,
        'queued_count', v_inserted_count
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;

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
