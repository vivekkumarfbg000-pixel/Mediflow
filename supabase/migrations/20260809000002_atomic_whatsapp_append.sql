-- =============================================================================
-- Mediflow: Structural Security Patch (WhatsApp Dispatch Lost Update Anomaly Fix)
-- =============================================================================
-- ACTION REQUIRED: Run this script in your Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.atomic_append_whatsapp_chat(
  p_patient_phone TEXT,
  p_patient_id UUID,
  p_pod_id UUID,
  p_message JSONB,
  p_waba_error TEXT DEFAULT NULL,
  p_current_time TIMESTAMPTZ DEFAULT NOW()
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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
    'COMPLETED', 
    p_current_time, 
    jsonb_build_object(
      'chatHistory', jsonb_build_array(p_message),
      'podId', p_pod_id,
      'wabaErrorMessage', p_waba_error
    ),
    p_pod_id
  )
  ON CONFLICT (patient_phone) DO UPDATE 
  SET 
    last_interaction = EXCLUDED.last_interaction,
    current_state = 'COMPLETED',
    session_data = jsonb_set(
      jsonb_set(
        COALESCE(public.whatsapp_sessions.session_data, '{}'::jsonb),
        '{chatHistory}',
        (COALESCE(public.whatsapp_sessions.session_data->'chatHistory', '[]'::jsonb) || p_message)
      ),
      '{wabaErrorMessage}',
      to_jsonb(p_waba_error)
    );
END;
$$;
