-- =============================================================================
-- Migration: Fix Broadcast Enqueue RPC & Patient Registry Schema Alignment
-- Date: 2026-08-21
-- Purpose:
--   1. Add condition, tags, medical_history columns to patient_registry
--   2. Update enqueue_broadcast_campaign RPC with safe COALESCE & exception blocks
-- =============================================================================

ALTER TABLE public.patient_registry ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE;
ALTER TABLE public.patient_registry ADD COLUMN IF NOT EXISTS condition TEXT;
ALTER TABLE public.patient_registry ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.patient_registry ADD COLUMN IF NOT EXISTS medical_history JSONB DEFAULT '[]'::jsonb;

-- Create or update enqueue_broadcast_campaign RPC
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
    v_inserted_count INT := 0;
BEGIN
    IF p_target_cohort = 'all' THEN
        INSERT INTO whatsapp_broadcast_queue (pod_id, campaign_id, patient_id, patient_phone, message_text)
        SELECT COALESCE(p_pod_id, 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'::uuid), p_campaign_id, id, phone, p_message_text
        FROM patient_registry
        WHERE (pod_id = p_pod_id OR p_pod_id IS NULL OR pod_id IS NULL)
          AND phone IS NOT NULL AND length(phone) >= 10;
          
    ELSIF p_target_cohort = 'diabetes' THEN
        INSERT INTO whatsapp_broadcast_queue (pod_id, campaign_id, patient_id, patient_phone, message_text)
        SELECT COALESCE(p_pod_id, 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'::uuid), p_campaign_id, id, phone, p_message_text
        FROM patient_registry
        WHERE (pod_id = p_pod_id OR p_pod_id IS NULL OR pod_id IS NULL)
          AND phone IS NOT NULL AND length(phone) >= 10
          AND (
            COALESCE(condition, '') ILIKE '%diabet%' 
            OR COALESCE(tags::text, '') ILIKE '%diabet%'
            OR COALESCE(medical_history::text, '') ILIKE '%diabet%'
            OR COALESCE(vitals::text, '') ILIKE '%sugar%'
          );
          
    ELSIF p_target_cohort = 'hypertension' THEN
        INSERT INTO whatsapp_broadcast_queue (pod_id, campaign_id, patient_id, patient_phone, message_text)
        SELECT COALESCE(p_pod_id, 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'::uuid), p_campaign_id, id, phone, p_message_text
        FROM patient_registry
        WHERE (pod_id = p_pod_id OR p_pod_id IS NULL OR pod_id IS NULL)
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
        SELECT COALESCE(p_pod_id, 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'::uuid), p_campaign_id, id, phone, p_message_text
        FROM patient_registry
        WHERE (pod_id = p_pod_id OR p_pod_id IS NULL OR pod_id IS NULL)
          AND phone IS NOT NULL AND length(phone) >= 10;
    END IF;

    GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

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
