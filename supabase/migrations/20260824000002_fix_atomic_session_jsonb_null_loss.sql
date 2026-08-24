-- =============================================================================
-- Migration: Fix WhatsApp Session Data JSONB Loss in atomic_update_whatsapp_session
-- Prevents jsonb_set() NULL return when p_waba_error is NULL, ensuring selectedDate
-- and future appointment session attributes are permanently preserved across messages.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.atomic_update_whatsapp_session(
    p_patient_phone TEXT,
    p_patient_id UUID DEFAULT NULL,
    p_pod_id UUID DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'::uuid,
    p_entity_id UUID DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'::uuid,
    p_current_state TEXT DEFAULT NULL,
    p_message JSONB DEFAULT NULL,
    p_session_data_updates JSONB DEFAULT NULL,
    p_waba_error TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated RECORD;
    v_default_session_data JSONB;
    v_chat_history JSONB;
    v_effective_pod_id UUID;
    v_effective_entity_id UUID;
BEGIN
    v_effective_pod_id := COALESCE(p_pod_id, 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'::uuid);
    v_effective_entity_id := COALESCE(p_entity_id, v_effective_pod_id);

    -- Determine default chat history array (handle array vs single object)
    IF p_message IS NOT NULL THEN
      IF jsonb_typeof(p_message) = 'array' THEN
        v_chat_history := p_message;
      ELSE
        v_chat_history := jsonb_build_array(p_message);
      END IF;
    ELSE
      v_chat_history := '[]'::jsonb;
    END IF;

    -- Build default session data JSONB
    v_default_session_data := jsonb_build_object(
      'chatHistory', v_chat_history,
      'podId', v_effective_pod_id,
      'entityId', v_effective_entity_id,
      'wabaErrorMessage', p_waba_error
    );

    -- Apply initial overrides if provided
    IF p_session_data_updates IS NOT NULL THEN
      v_default_session_data := v_default_session_data || p_session_data_updates;
    END IF;

    -- Insert or update atomically under unique constraint on patient_phone
    INSERT INTO public.whatsapp_sessions (
        patient_phone, 
        patient_id, 
        current_state, 
        last_interaction, 
        session_data,
        pod_id
    )
    VALUES (
        p_patient_phone, 
        p_patient_id, 
        COALESCE(p_current_state, 'IDLE'), 
        NOW(), 
        v_default_session_data,
        v_effective_pod_id
    )
    ON CONFLICT (patient_phone) DO UPDATE 
    SET 
        patient_id = COALESCE(p_patient_id, whatsapp_sessions.patient_id),
        current_state = COALESCE(p_current_state, whatsapp_sessions.current_state),
        last_interaction = NOW(),
        session_data = (
            CASE 
              WHEN p_message IS NOT NULL THEN
                jsonb_set(
                    COALESCE(whatsapp_sessions.session_data, '{}'::jsonb),
                    '{chatHistory}',
                    (COALESCE(whatsapp_sessions.session_data->'chatHistory', '[]'::jsonb) || p_message)
                )
              ELSE
                COALESCE(whatsapp_sessions.session_data, '{}'::jsonb)
            END
        ) || (
            CASE
              WHEN p_waba_error IS NOT NULL THEN jsonb_build_object('wabaErrorMessage', p_waba_error)
              ELSE '{}'::jsonb
            END
        ) || (
            CASE
              WHEN p_session_data_updates IS NOT NULL THEN p_session_data_updates
              ELSE '{}'::jsonb
            END
        )
    RETURNING * INTO v_updated;

    RETURN to_jsonb(v_updated);
END;
$$;

GRANT EXECUTE ON FUNCTION public.atomic_update_whatsapp_session(TEXT, UUID, UUID, UUID, TEXT, JSONB, JSONB, TEXT) TO authenticated, service_role, anon;
