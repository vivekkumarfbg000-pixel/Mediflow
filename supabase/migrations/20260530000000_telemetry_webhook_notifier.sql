
-- Mediflow Connected Care Ecosystem — Telemetry Webhook Notifier
-- Migration: 20260530000000_telemetry_webhook_notifier.sql
--
-- Creates a Postgres trigger that fires a Supabase Edge Function whenever a
-- CRITICAL severity row is inserted into system_health_telemetry, enabling
-- real-time push notifications to the developer Discord / Slack / Telegram
-- channel without polling.

-- Enable the pg_net extension (required for HTTP calls from Postgres triggers)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- Helper function: dispatch_critical_telemetry_webhook
-- Called by the trigger below. Reads the new row, serialises it to JSON,
-- and POSTs it to the Supabase Edge Function via pg_net so that the call is
-- non-blocking and does not block the INSERT transaction.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dispatch_critical_telemetry_webhook()
RETURNS TRIGGER AS $$
DECLARE
    v_payload   JSONB;
    v_edge_url  TEXT;
BEGIN
    -- Only fire for critical severity events
    IF NEW.severity <> 'critical' THEN
        RETURN NEW;
    END IF;

    -- Build the JSON payload for the Edge Function
    v_payload := jsonb_build_object(
        'event',            'critical_telemetry',
        'id',               NEW.id,
        'pod_id',           NEW.pod_id,
        'subsystem',        NEW.subsystem,
        'severity',         NEW.severity,
        'error_code',       NEW.error_code,
        'error_stack',      NEW.error_stack,
        'healing_attempts', NEW.healing_attempts,
        'status',           NEW.status,
        'created_at',       NEW.created_at
    );

    -- Resolve the Supabase project URL from the app_settings table (if present)
    -- Falls back to the current_setting injected at deploy time.
    BEGIN
        v_edge_url := current_setting('app.supabase_project_url', true)
            || '/functions/v1/notify-developer-webhook';
    EXCEPTION WHEN OTHERS THEN
        -- If the setting is not configured, exit silently (non-breaking)
        RETURN NEW;
    END;

    -- Non-blocking async HTTP POST via pg_net
    PERFORM extensions.http_post(
        url     := v_edge_url,
        body    := v_payload::TEXT,
        headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key', true)
        )
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revoke public access — only the trigger mechanism invokes this function
REVOKE EXECUTE ON FUNCTION public.dispatch_critical_telemetry_webhook() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Trigger: on every INSERT of a critical row into system_health_telemetry
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_critical_telemetry_webhook ON public.system_health_telemetry;
CREATE TRIGGER trg_critical_telemetry_webhook
    AFTER INSERT ON public.system_health_telemetry
    FOR EACH ROW
    EXECUTE FUNCTION public.dispatch_critical_telemetry_webhook();

-- Informational comment
COMMENT ON TRIGGER trg_critical_telemetry_webhook ON public.system_health_telemetry IS
    'Fires the notify-developer-webhook Edge Function asynchronously for every critical severity insert.';
