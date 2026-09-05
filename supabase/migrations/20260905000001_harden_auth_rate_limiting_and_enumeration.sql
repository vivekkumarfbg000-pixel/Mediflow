-- =============================================================================
-- Migration: 20260905000001_harden_auth_rate_limiting_and_enumeration.sql
-- Description: Hardens server-side login sentry with sliding-window action rate
-- limiting (login, forgot_password, signup) and anti-enumeration protections.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    ip_address TEXT,
    action_type TEXT DEFAULT 'login',
    success BOOLEAN NOT NULL DEFAULT FALSE,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotently add action_type column if table existed from prior migration
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'login_attempts' 
          AND column_name = 'action_type'
    ) THEN
        ALTER TABLE public.login_attempts ADD COLUMN action_type TEXT DEFAULT 'login';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_action_time 
ON public.login_attempts(lower(email), action_type, attempted_at);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time 
ON public.login_attempts(ip_address, attempted_at);

-- Drop prior signatures
DROP FUNCTION IF EXISTS public.check_login_sentry(TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.check_login_sentry(TEXT, TEXT) CASCADE;

-- Enhanced 3-parameter rate limiting sentry function
CREATE OR REPLACE FUNCTION public.check_login_sentry(
    p_email TEXT,
    p_ip TEXT DEFAULT NULL,
    p_action TEXT DEFAULT 'login'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_recent_fails INT;
    v_window_minutes INT := 15;
    v_lockout_minutes INT := 15;
    v_max_attempts INT := 5;
    v_clean_email TEXT := lower(trim(COALESCE(p_email, '')));
    v_clean_action TEXT := lower(trim(COALESCE(p_action, 'login')));
BEGIN
    -- Configure thresholds based on action type
    IF v_clean_action = 'forgot_password' THEN
        v_window_minutes := 15;
        v_lockout_minutes := 30;
        v_max_attempts := 3;
    ELSIF v_clean_action = 'signup' THEN
        v_window_minutes := 10;
        v_lockout_minutes := 20;
        v_max_attempts := 3;
    ELSE
        v_window_minutes := 15;
        v_lockout_minutes := 15;
        v_max_attempts := 5;
    END IF;

    -- Count failed attempts within sliding window
    SELECT COUNT(*)
    INTO v_recent_fails
    FROM public.login_attempts
    WHERE (
        (v_clean_email <> '' AND lower(trim(email)) = v_clean_email)
        OR (p_ip IS NOT NULL AND ip_address = p_ip)
    )
      AND action_type = v_clean_action
      AND success = FALSE
      AND attempted_at > (NOW() - (v_window_minutes || ' minutes')::INTERVAL);

    IF v_recent_fails >= v_max_attempts THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'locked', true,
            'action', v_clean_action,
            'retry_after_minutes', v_lockout_minutes,
            'message', 'Too many failed ' || v_clean_action || ' attempts. Temporary security lockout active for ' || v_lockout_minutes || ' minutes.'
        );
    END IF;

    RETURN jsonb_build_object(
        'allowed', true,
        'locked', false,
        'action', v_clean_action,
        'remaining_attempts', (v_max_attempts - v_recent_fails)
    );
EXCEPTION WHEN OTHERS THEN
    -- Fail-open gracefully to prevent blocking legitimate clinicians on transient DB errors
    RETURN jsonb_build_object(
        'allowed', true,
        'locked', false,
        'error', SQLERRM
    );
END;
$$;

-- Backward-compatible 2-parameter overload
CREATE OR REPLACE FUNCTION public.check_login_sentry(
    p_email TEXT,
    p_ip TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.check_login_sentry(p_email, p_ip, 'login');
END;
$$;

-- Enhanced attempt logging
DROP FUNCTION IF EXISTS public.log_login_attempt(TEXT, BOOLEAN, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.log_login_attempt(TEXT, BOOLEAN, TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.log_login_attempt(
    p_email TEXT,
    p_success BOOLEAN,
    p_ip TEXT DEFAULT NULL,
    p_action TEXT DEFAULT 'login'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.login_attempts (email, ip_address, action_type, success, attempted_at)
    VALUES (
        lower(trim(COALESCE(p_email, 'anonymous'))), 
        p_ip, 
        lower(trim(COALESCE(p_action, 'login'))), 
        p_success, 
        NOW()
    );

    RETURN jsonb_build_object('logged', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('logged', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.log_login_attempt(
    p_email TEXT,
    p_success BOOLEAN,
    p_ip TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.log_login_attempt(p_email, p_success, p_ip, 'login');
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.check_login_sentry(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_login_sentry(TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_login_attempt(TEXT, BOOLEAN, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_login_attempt(TEXT, BOOLEAN, TEXT) TO anon, authenticated, service_role;
