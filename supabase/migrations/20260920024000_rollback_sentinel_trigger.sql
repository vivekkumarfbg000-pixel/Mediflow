-- [20260920024000] Rollback Sentinel Trigger
-- Monitors system_logs for fatal anomalies and triggers rollback edge function

-- 1. Create a function to check anomaly threshold
CREATE OR REPLACE FUNCTION public.check_anomaly_threshold()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    fatal_count integer;
    threshold integer := 5;
    window_minutes integer := 3;
    edge_function_url text;
BEGIN
    -- Only evaluate on fatal logs
    IF NEW.level = 'fatal' THEN
        -- Count fatal errors in the last X minutes
        SELECT count(*)
        INTO fatal_count
        FROM public.system_logs
        WHERE level = 'fatal'
        AND created_at >= (now() - (window_minutes || ' minutes')::interval);

        -- If threshold is breached, trigger the rollback edge function
        IF fatal_count = threshold THEN
            -- We hit EXACTLY the threshold (so we don't trigger multiple times for 6, 7, 8...)
            
            -- Call the edge function via Postgres HTTP extension (pg_net)
            -- Note: Requires pg_net extension to be enabled in Supabase
            -- In a real environment, we use net.http_post to fire-and-forget.
            
            -- We extract the Supabase URL from the environment if possible, or use a placeholder.
            -- This relies on the edge function being deployed to /functions/v1/rollback-sentinel
            
            BEGIN
                PERFORM net.http_post(
                    url := coalesce(current_setting('app.settings.supabase_url', true), 'http://kong:8000') || '/functions/v1/rollback-sentinel',
                    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || coalesce(current_setting('app.settings.supabase_anon_key', true), 'anon') || '"}'::jsonb,
                    body := jsonb_build_object(
                        'trigger', 'anomaly_threshold_breached',
                        'fatal_count', fatal_count,
                        'window_minutes', window_minutes,
                        'last_error_message', NEW.message
                    )
                );
            EXCEPTION WHEN OTHERS THEN
                -- Ignore pg_net failures locally if pg_net is not installed
                RAISE WARNING 'Failed to invoke rollback sentinel webhook via pg_net: %', SQLERRM;
            END;
            
            -- Mark the logs as acknowledged (partially resolved) so they don't count towards the next threshold immediately
            UPDATE public.system_logs
            SET is_resolved = true,
                resolved_by = 'rollback_sentinel_trigger',
                resolved_at = now()
            WHERE level = 'fatal'
            AND is_resolved = false
            AND created_at >= (now() - (window_minutes || ' minutes')::interval);
            
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 2. Ensure pg_net extension is enabled (required for outgoing webhooks)
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA extensions;

-- 3. Create the trigger on system_logs
DROP TRIGGER IF EXISTS trigger_check_anomaly_threshold ON public.system_logs;
CREATE TRIGGER trigger_check_anomaly_threshold
    AFTER INSERT ON public.system_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.check_anomaly_threshold();
