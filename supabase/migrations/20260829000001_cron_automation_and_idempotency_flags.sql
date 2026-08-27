-- =============================================================================
-- Migration: 20260829000001_cron_automation_and_idempotency_flags.sql
-- Description: Military-Grade Automation Hardening
--   1. Adds idempotency flag columns to prevent duplicate WhatsApp sends
--   2. Schedules pg_cron jobs for Day-25 refill, morning greeting, evening lab
-- All statements are IDEMPOTENT (safe to re-run on any environment).
-- =============================================================================

-- 1. Idempotency flag: appointments morning greeting
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS morning_greeting_dispatched BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_appointments_morning_greeting
  ON public.appointments(morning_greeting_dispatched, appointment_time)
  WHERE morning_greeting_dispatched = false;

-- 2. Idempotency flag: lab_reports WhatsApp dispatch
ALTER TABLE public.lab_reports
  ADD COLUMN IF NOT EXISTS whatsapp_dispatched BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.lab_reports
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_lab_reports_whatsapp_dispatch
  ON public.lab_reports(whatsapp_dispatched, approved_at)
  WHERE whatsapp_dispatched = false;

-- 3. Idempotency flag: pathology_reports WhatsApp dispatch
ALTER TABLE public.pathology_reports
  ADD COLUMN IF NOT EXISTS whatsapp_dispatched BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_pathology_reports_whatsapp_dispatch
  ON public.pathology_reports(whatsapp_dispatched)
  WHERE whatsapp_dispatched = false;

-- 4. Add virtual_meeting_url to appointments if not exists
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS virtual_meeting_url TEXT;

-- 5. Add is_emergency flag to appointments
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS is_emergency BOOLEAN NOT NULL DEFAULT false;

-- 6. Schedule pg_cron jobs (only if pg_cron is enabled)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- 6a. Day-25 Chronic Refill: 6:00 AM IST (00:30 UTC)
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'vitalsync-day25-refill-nudge') THEN
      PERFORM cron.unschedule('vitalsync-day25-refill-nudge');
    END IF;
    PERFORM cron.schedule(
      'vitalsync-day25-refill-nudge', '30 0 * * *',
      $q$ SELECT net.http_post(url := current_setting('app.supabase_url', true) || '/functions/v1/whatsapp-refill-cron', headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)), body := '{"internal": true}'::jsonb); $q$
    );

    -- 6b. Morning Greetings & Dosage Reminders: 8:00 AM IST (02:30 UTC)
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'vitalsync-morning-appointment-greeting') THEN
      PERFORM cron.unschedule('vitalsync-morning-appointment-greeting');
    END IF;
    PERFORM cron.schedule(
      'vitalsync-morning-appointment-greeting', '30 2 * * *',
      $q$ SELECT net.http_post(url := current_setting('app.supabase_url', true) || '/functions/v1/appointment-reminder-cron?pass=morning', headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)), body := '{"internal": true}'::jsonb); $q$
    );

    -- 6c. Evening Lab Report 2-Touchpoint Review: 4:00 PM IST (10:30 UTC)
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'vitalsync-evening-lab-report-dispatch') THEN
      PERFORM cron.unschedule('vitalsync-evening-lab-report-dispatch');
    END IF;
    PERFORM cron.schedule(
      'vitalsync-evening-lab-report-dispatch', '30 10 * * *',
      $q$ SELECT net.http_post(url := current_setting('app.supabase_url', true) || '/functions/v1/appointment-reminder-cron?pass=evening', headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)), body := '{"internal": true}'::jsonb); $q$
    );

    RAISE NOTICE '[vitalsync] pg_cron schedules registered OK';
  ELSE
    RAISE NOTICE '[vitalsync] pg_cron not enabled -- enable via Supabase Dashboard > Database > Extensions > pg_cron';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[vitalsync] Note on pg_cron: % (columns and indexes created successfully)', SQLERRM;
END;
$$;

-- 7. Verify columns added
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='morning_greeting_dispatched')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lab_reports' AND column_name='whatsapp_dispatched') THEN
    RAISE NOTICE '[vitalsync] Idempotency columns verified OK';
  ELSE
    RAISE WARNING '[vitalsync] One or more idempotency columns missing after migration!';
  END IF;
END;
$$;
