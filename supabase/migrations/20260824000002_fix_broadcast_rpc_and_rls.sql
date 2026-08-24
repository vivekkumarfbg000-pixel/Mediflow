-- =============================================================================
-- Migration: Fix Broadcast RPC & RLS Permissive Policies
-- Date: 2026-08-24
-- =============================================================================

-- 1. Ensure columns exist on whatsapp_broadcast_queue & campaigns
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

-- 2. Permissive RLS for whatsapp_broadcast_campaigns & whatsapp_broadcast_queue
ALTER TABLE public.whatsapp_broadcast_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_broadcast_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users on broadcast campaigns" ON public.whatsapp_broadcast_campaigns;
DROP POLICY IF EXISTS "Enable insert access for authenticated users on broadcast campaigns" ON public.whatsapp_broadcast_campaigns;
DROP POLICY IF EXISTS "Enable update access for authenticated users on broadcast campaigns" ON public.whatsapp_broadcast_campaigns;
DROP POLICY IF EXISTS "Enable all access on whatsapp_broadcast_campaigns" ON public.whatsapp_broadcast_campaigns;

CREATE POLICY "Enable all access on whatsapp_broadcast_campaigns"
ON public.whatsapp_broadcast_campaigns FOR ALL
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Enable read access for authenticated users by pod_id" ON public.whatsapp_broadcast_queue;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.whatsapp_broadcast_queue;
DROP POLICY IF EXISTS "Enable all access on whatsapp_broadcast_queue" ON public.whatsapp_broadcast_queue;

CREATE POLICY "Enable all access on whatsapp_broadcast_queue"
ON public.whatsapp_broadcast_queue FOR ALL
USING (true)
WITH CHECK (true);

-- 3. Atomic Enqueue Broadcast Campaign RPC (Security Definer)
CREATE OR REPLACE FUNCTION public.enqueue_broadcast_campaign(
    p_pod_id UUID,
    p_campaign_id TEXT,
    p_target_cohort TEXT, -- 'all', 'diabetes', 'hypertension', 'opd', 'chronic'
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

    -- Upsert persistent campaign history
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
