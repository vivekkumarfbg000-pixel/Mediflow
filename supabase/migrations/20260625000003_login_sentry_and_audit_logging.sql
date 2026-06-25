-- Mediflow Login Sentry, Rate Limiter, and Account Lockout Policy
-- Migration ID: 20260625000003_login_sentry_and_audit_logging
-- Created: 2026-06-25
-- Purpose: Implement user login attempt auditing, rate limiting, and account lockouts.

-- 1. Create error code dictionary table
CREATE TABLE IF NOT EXISTS public.error_code_dictionary (
    error_code TEXT PRIMARY KEY,
    error_message TEXT NOT NULL,
    description TEXT,
    diagnostic_information TEXT
);

-- Enable RLS
ALTER TABLE public.error_code_dictionary ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to error dictionary" ON public.error_code_dictionary;
DROP POLICY IF EXISTS "Allow admin write access to error dictionary" ON public.error_code_dictionary;

-- Allow public read access
CREATE POLICY "Allow public read access to error dictionary" ON public.error_code_dictionary
    FOR SELECT TO public USING (true);

-- Allow admins write access
CREATE POLICY "Allow admin write access to error dictionary" ON public.error_code_dictionary
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND (profiles.role = 'admin' OR profiles.role = 'platform_admin')
        )
    );

-- Populate dictionary
INSERT INTO public.error_code_dictionary (error_code, error_message, description, diagnostic_information)
VALUES
('ERR_INVALID_CREDENTIALS', 'Invalid email or password.', 'The credentials provided do not match any registered account.', 'Verify email address spelling and password caps lock status.'),
('ERR_RATE_LIMIT_EXCEEDED', 'Too many login attempts. Please try again in 1 minute.', 'Login rate limit of 5 attempts per minute was exceeded.', 'Please wait at least 60 seconds before retrying.'),
('ERR_ACCOUNT_LOCKED', 'Account locked due to too many failed attempts. Locked for 30 minutes.', 'Account is temporarily locked due to 5 consecutive authentication failures.', 'Account will unlock automatically in 30 minutes, or contact an administrator to manually unlock.'),
('ERR_NETWORK_FAILURE', 'Network connectivity issue. Please check your internet connection.', 'A client-side or transient network connectivity failure was detected.', 'Check local DNS settings, internet connection, and verify remote server status.'),
('ERR_SERVER_ERROR', 'Internal server-side error occurred.', 'An unexpected error or database failure occurred on the server.', 'Contact Mediflow Operations team for system status check.')
ON CONFLICT (error_code) DO UPDATE
SET error_message = EXCLUDED.error_message,
    description = EXCLUDED.description,
    diagnostic_information = EXCLUDED.diagnostic_information;

-- 2. Create login attempts log table
CREATE TABLE IF NOT EXISTS public.login_attempts_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    email TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    login_status TEXT NOT NULL CHECK (login_status IN ('success', 'failure')),
    error_code TEXT REFERENCES public.error_code_dictionary(error_code),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create account lockouts table
CREATE TABLE IF NOT EXISTS public.account_lockouts (
    email TEXT PRIMARY KEY,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.login_attempts_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_lockouts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins full access to login attempts log" ON public.login_attempts_log;
DROP POLICY IF EXISTS "Admins full access to account lockouts" ON public.account_lockouts;

-- Allow only admins to read/write log tables
CREATE POLICY "Admins full access to login attempts log" ON public.login_attempts_log
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND (profiles.role = 'admin' OR profiles.role = 'platform_admin')
        )
    );

CREATE POLICY "Admins full access to account lockouts" ON public.account_lockouts
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND (profiles.role = 'admin' OR profiles.role = 'platform_admin')
        )
    );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_created_at ON public.login_attempts_log(email, created_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_created_at ON public.login_attempts_log(ip_address, created_at);
CREATE INDEX IF NOT EXISTS idx_account_lockouts_locked_until ON public.account_lockouts(locked_until);

-- 4. Function: Check rate limiting and lockout state
CREATE OR REPLACE FUNCTION public.check_login_sentry(
    p_email TEXT,
    p_ip TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_locked_until TIMESTAMPTZ;
    v_rate_limit_count INTEGER;
    v_ip TEXT;
    v_headers JSON;
BEGIN
    -- Safely get request headers JSON from context
    BEGIN
        v_headers := current_setting('request.headers', true)::json;
    EXCEPTION WHEN OTHERS THEN
        v_headers := NULL;
    END;

    -- Resolve IP from params or headers
    v_ip := COALESCE(
        p_ip,
        v_headers->>'x-forwarded-for',
        '127.0.0.1'
    );

    -- 1. Check account lockout first
    SELECT locked_until INTO v_locked_until
    FROM public.account_lockouts
    WHERE email = LOWER(TRIM(p_email));

    IF v_locked_until IS NOT NULL AND v_locked_until > now() THEN
        RETURN json_build_object(
            'allowed', FALSE,
            'error_code', 'ERR_ACCOUNT_LOCKED',
            'locked_until', v_locked_until,
            'message', 'Account is locked. Please try again after ' || to_char(v_locked_until, 'YYYY-MM-DD HH24:MI:SS TZ')
        );
    END IF;

    -- 2. Check rate limit: maximum 5 login attempts within a 1-minute window
    SELECT COUNT(*)::INTEGER INTO v_rate_limit_count
    FROM public.login_attempts_log
    WHERE (email = LOWER(TRIM(p_email)) OR (ip_address = v_ip AND v_ip NOT IN ('127.0.0.1', '::1')))
      AND login_status = 'failure'
      AND created_at >= now() - INTERVAL '1 minute';

    IF v_rate_limit_count >= 5 THEN
        RETURN json_build_object(
            'allowed', FALSE,
            'error_code', 'ERR_RATE_LIMIT_EXCEEDED',
            'locked_until', NULL,
            'message', 'Too many login attempts. Please try again in 1 minute.'
        );
    END IF;

    -- 3. Allowed
    RETURN json_build_object(
        'allowed', TRUE,
        'error_code', NULL,
        'locked_until', NULL,
        'message', 'Proceed'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Function: Log attempts and update lockout state
CREATE OR REPLACE FUNCTION public.log_login_attempt(
    p_email TEXT,
    p_ip TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_status TEXT DEFAULT 'failure',
    p_error_code TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_failed_count INTEGER;
    v_email TEXT := LOWER(TRIM(p_email));
    v_ip TEXT;
    v_ua TEXT;
    v_headers JSON;
BEGIN
    -- Safely get request headers JSON from context
    BEGIN
        v_headers := current_setting('request.headers', true)::json;
    EXCEPTION WHEN OTHERS THEN
        v_headers := NULL;
    END;

    -- Resolve IP and User Agent from params or headers
    v_ip := COALESCE(
        p_ip,
        v_headers->>'x-forwarded-for',
        '127.0.0.1'
    );
    v_ua := COALESCE(
        p_user_agent,
        v_headers->>'user-agent',
        'Unknown Browser'
    );

    -- 1. Log the login attempt
    INSERT INTO public.login_attempts_log (user_id, email, ip_address, user_agent, login_status, error_code)
    VALUES (p_user_id, v_email, v_ip, v_ua, p_status, p_error_code);

    -- 2. Update lockout tracker
    IF p_status = 'success' THEN
        -- Reset failed attempts on success
        INSERT INTO public.account_lockouts (email, failed_attempts, locked_until, last_attempt_at)
        VALUES (v_email, 0, NULL, now())
        ON CONFLICT (email) DO UPDATE
        SET failed_attempts = 0,
            locked_until = NULL,
            last_attempt_at = now();
    ELSE
        -- Only increment lockouts if failure is due to invalid credentials
        IF p_error_code = 'ERR_INVALID_CREDENTIALS' THEN
            INSERT INTO public.account_lockouts (email, failed_attempts, locked_until, last_attempt_at)
            VALUES (v_email, 1, NULL, now())
            ON CONFLICT (email) DO UPDATE
            SET failed_attempts = public.account_lockouts.failed_attempts + 1,
                last_attempt_at = now()
            RETURNING failed_attempts INTO v_failed_count;

            -- Lock out account if 5 consecutive failed attempts
            IF v_failed_count >= 5 THEN
                UPDATE public.account_lockouts
                SET locked_until = now() + INTERVAL '30 minutes'
                WHERE email = v_email;
            END IF;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Function: Admin unlock account
CREATE OR REPLACE FUNCTION public.unlock_account(
    p_email TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_caller_role TEXT;
BEGIN
    -- Security verification: caller must be admin or platform_admin
    SELECT role INTO v_caller_role
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_caller_role IS DISTINCT FROM 'admin' AND v_caller_role IS DISTINCT FROM 'platform_admin' THEN
        RAISE EXCEPTION 'Access Denied: Only administrators can unlock accounts.';
    END IF;

    UPDATE public.account_lockouts
    SET failed_attempts = 0,
        locked_until = NULL,
        last_attempt_at = now()
    WHERE email = LOWER(TRIM(p_email));

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions (explicit security architecture)
REVOKE EXECUTE ON FUNCTION public.check_login_sentry(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_login_sentry(TEXT, TEXT) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.log_login_attempt(TEXT, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_login_attempt(TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.unlock_account(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlock_account(TEXT) TO authenticated;
