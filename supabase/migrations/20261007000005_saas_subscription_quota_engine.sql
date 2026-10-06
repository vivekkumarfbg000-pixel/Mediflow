-- ============================================================================
-- VITALSYNC MASTER UPGRADE MIGRATION: Phase 25 SaaS Subscription & Quota Engine
-- Strict NMC Ethics Code 6.4 & DPDP Act 2023 Compliance
-- Flat SaaS Subscriptions: 90-Day Free Pilot, ₹999/mo Growth, ₹1,999/mo Pro
-- 100% Direct Clinic Settlement (0% Platform Fee Deductions)
-- ============================================================================

-- 1. Ensure public.saas_subscriptions table exists
CREATE TABLE IF NOT EXISTS public.saas_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pod_id UUID NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE,
    tier VARCHAR(50) NOT NULL DEFAULT 'tier_0_pilot', -- 'tier_0_pilot', 'tier_1_growth', 'tier_2_unlimited_pro'
    tier_name VARCHAR(100) NOT NULL DEFAULT '90-Day Free Clinical Pilot',
    billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
    monthly_fee_inr NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'past_due', 'cancelled'
    pilot_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    pilot_end_date TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    max_ai_scans_per_month INTEGER NOT NULL DEFAULT 1000, -- -1 for unlimited
    max_whatsapp_messages_per_month INTEGER NOT NULL DEFAULT 1000, -- -1 for unlimited
    auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT saas_subscriptions_pod_id_key UNIQUE (pod_id)
);

-- 2. Ensure public.pod_usage_quotas table exists
CREATE TABLE IF NOT EXISTS public.pod_usage_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pod_id UUID NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE,
    billing_month VARCHAR(7) NOT NULL, -- 'YYYY-MM'
    ai_scans_used INTEGER NOT NULL DEFAULT 0,
    whatsapp_messages_used INTEGER NOT NULL DEFAULT 0,
    ai_scans_limit INTEGER NOT NULL DEFAULT 1000,
    whatsapp_messages_limit INTEGER NOT NULL DEFAULT 1000,
    is_hard_limit_exceeded BOOLEAN NOT NULL DEFAULT FALSE,
    last_increment_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pod_usage_quotas_pod_month_key UNIQUE (pod_id, billing_month)
);

-- 3. Reset all pod platform fee percentages to 0.00 (Zero Platform Deductions)
ALTER TABLE public.pods ADD COLUMN IF NOT EXISTS platform_fee_percent NUMERIC(5,2) DEFAULT 0.00;
UPDATE public.pods SET platform_fee_percent = 0.00 WHERE platform_fee_percent != 0.00 OR platform_fee_percent IS NULL;

-- 4. Deprecate accumulate_platform_revenue as safe no-op
CREATE OR REPLACE FUNCTION public.accumulate_platform_revenue(
    p_pod_id UUID,
    p_amount NUMERIC,
    p_is_cash BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- PHASE 25 DEPRECATION: Commission/platform transaction cuts are legally eliminated.
    -- Retained strictly as a safe no-op to preserve backwards compatibility with offline WAL replay.
    RETURN;
END;
$$;
GRANT EXECUTE ON FUNCTION public.accumulate_platform_revenue(UUID, NUMERIC, BOOLEAN) TO authenticated, anon, service_role;

-- 5. Atomic Usage Quota Tracking RPC
CREATE OR REPLACE FUNCTION public.record_pod_usage_quota(
    p_pod_id UUID,
    p_usage_type VARCHAR, -- 'ai_scan' or 'whatsapp_message'
    p_increment INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_month VARCHAR(7);
    v_sub RECORD;
    v_quota RECORD;
    v_scans_used INT;
    v_wa_used INT;
    v_scans_limit INT;
    v_wa_limit INT;
    v_allowed BOOLEAN := TRUE;
    v_reason TEXT := 'OK';
BEGIN
    v_month := to_char(NOW(), 'YYYY-MM');

    -- Auto-provision 90-day pilot if missing
    SELECT * INTO v_sub FROM public.saas_subscriptions WHERE pod_id = p_pod_id LIMIT 1;
    IF NOT FOUND THEN
        INSERT INTO public.saas_subscriptions (
            pod_id, tier, tier_name, monthly_fee_inr, status,
            pilot_started_at, pilot_end_date,
            max_ai_scans_per_month, max_whatsapp_messages_per_month
        ) VALUES (
            p_pod_id, 'tier_0_pilot', '90-Day Free Clinical Pilot', 0.00, 'active',
            NOW(), NOW() + INTERVAL '90 days',
            1000, 1000
        )
        ON CONFLICT (pod_id) DO UPDATE SET updated_at = NOW()
        RETURNING * INTO v_sub;
    END IF;

    v_scans_limit := COALESCE(v_sub.max_ai_scans_per_month, 1000);
    v_wa_limit := COALESCE(v_sub.max_whatsapp_messages_per_month, 1000);

    -- Ensure monthly quota row
    INSERT INTO public.pod_usage_quotas (
        pod_id, billing_month, ai_scans_used, whatsapp_messages_used,
        ai_scans_limit, whatsapp_messages_limit
    ) VALUES (
        p_pod_id, v_month, 0, 0,
        v_scans_limit, v_wa_limit
    )
    ON CONFLICT (pod_id, billing_month) DO NOTHING;

    -- Update usage with atomicity
    IF p_usage_type = 'ai_scan' THEN
        IF v_scans_limit > 0 THEN
            SELECT ai_scans_used INTO v_scans_used FROM public.pod_usage_quotas WHERE pod_id = p_pod_id AND billing_month = v_month;
            IF (v_scans_used + p_increment) > v_scans_limit THEN
                v_allowed := FALSE;
                v_reason := 'AI vision scan quota exceeded for current billing month. Upgrade to Unlimited Pro (₹1,999/mo) to unlock unlimited scans.';
            END IF;
        END IF;

        UPDATE public.pod_usage_quotas
        SET ai_scans_used = ai_scans_used + p_increment,
            last_increment_at = NOW(),
            updated_at = NOW()
        WHERE pod_id = p_pod_id AND billing_month = v_month
        RETURNING * INTO v_quota;

    ELSIF p_usage_type = 'whatsapp_message' THEN
        IF v_wa_limit > 0 THEN
            SELECT whatsapp_messages_used INTO v_wa_used FROM public.pod_usage_quotas WHERE pod_id = p_pod_id AND billing_month = v_month;
            IF (v_wa_used + p_increment) > v_wa_limit THEN
                v_allowed := FALSE;
                v_reason := 'WhatsApp message quota exceeded for current billing month. Upgrade to Unlimited Pro (₹1,999/mo) to unlock unlimited care loops.';
            END IF;
        END IF;

        UPDATE public.pod_usage_quotas
        SET whatsapp_messages_used = whatsapp_messages_used + p_increment,
            last_increment_at = NOW(),
            updated_at = NOW()
        WHERE pod_id = p_pod_id AND billing_month = v_month
        RETURNING * INTO v_quota;
    ELSE
        SELECT * INTO v_quota FROM public.pod_usage_quotas WHERE pod_id = p_pod_id AND billing_month = v_month;
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'allowed', v_allowed,
        'reason', v_reason,
        'tier', v_sub.tier,
        'tier_name', v_sub.tier_name,
        'monthly_fee_inr', v_sub.monthly_fee_inr,
        'pilot_end_date', v_sub.pilot_end_date,
        'billing_month', v_month,
        'ai_scans_used', COALESCE(v_quota.ai_scans_used, 0),
        'ai_scans_limit', v_scans_limit,
        'whatsapp_messages_used', COALESCE(v_quota.whatsapp_messages_used, 0),
        'whatsapp_messages_limit', v_wa_limit
    );
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_pod_usage_quota(UUID, VARCHAR, INTEGER) TO authenticated, anon, service_role;

-- 6. RPC to get subscription & quota status
CREATE OR REPLACE FUNCTION public.get_pod_subscription_status(p_pod_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sub RECORD;
    v_quota RECORD;
    v_month VARCHAR(7);
BEGIN
    v_month := to_char(NOW(), 'YYYY-MM');
    SELECT * INTO v_sub FROM public.saas_subscriptions WHERE pod_id = p_pod_id LIMIT 1;
    IF NOT FOUND THEN
        INSERT INTO public.saas_subscriptions (
            pod_id, tier, tier_name, monthly_fee_inr, status,
            pilot_started_at, pilot_end_date,
            max_ai_scans_per_month, max_whatsapp_messages_per_month
        ) VALUES (
            p_pod_id, 'tier_0_pilot', '90-Day Free Clinical Pilot', 0.00, 'active',
            NOW(), NOW() + INTERVAL '90 days',
            1000, 1000
        )
        ON CONFLICT (pod_id) DO UPDATE SET updated_at = NOW()
        RETURNING * INTO v_sub;
    END IF;

    SELECT * INTO v_quota FROM public.pod_usage_quotas WHERE pod_id = p_pod_id AND billing_month = v_month LIMIT 1;

    RETURN jsonb_build_object(
        'pod_id', p_pod_id,
        'tier', v_sub.tier,
        'tier_name', v_sub.tier_name,
        'monthly_fee_inr', v_sub.monthly_fee_inr,
        'status', v_sub.status,
        'pilot_end_date', v_sub.pilot_end_date,
        'billing_month', v_month,
        'ai_scans_used', COALESCE(v_quota.ai_scans_used, 0),
        'ai_scans_limit', COALESCE(v_sub.max_ai_scans_per_month, 1000),
        'whatsapp_messages_used', COALESCE(v_quota.whatsapp_messages_used, 0),
        'whatsapp_messages_limit', COALESCE(v_sub.max_whatsapp_messages_per_month, 1000)
    );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_pod_subscription_status(UUID) TO authenticated, anon, service_role;

-- 7. RPC to upgrade SaaS tier
CREATE OR REPLACE FUNCTION public.upgrade_pod_saas_tier(
    p_pod_id UUID,
    p_new_tier VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tier_name VARCHAR(100);
    v_monthly_fee NUMERIC(10,2);
    v_scans_limit INT;
    v_wa_limit INT;
    v_res RECORD;
BEGIN
    IF p_new_tier = 'tier_2_unlimited_pro' THEN
        v_tier_name := 'Unlimited Pro Plan';
        v_monthly_fee := 1999.00;
        v_scans_limit := -1; -- unlimited
        v_wa_limit := -1;    -- unlimited
    ELSIF p_new_tier = 'tier_1_growth' THEN
        v_tier_name := 'Growth Plan';
        v_monthly_fee := 999.00;
        v_scans_limit := 1000;
        v_wa_limit := 1000;
    ELSE
        v_tier_name := '90-Day Free Clinical Pilot';
        v_monthly_fee := 0.00;
        v_scans_limit := 1000;
        v_wa_limit := 1000;
    END IF;

    INSERT INTO public.saas_subscriptions (
        pod_id, tier, tier_name, monthly_fee_inr, status,
        max_ai_scans_per_month, max_whatsapp_messages_per_month, updated_at
    ) VALUES (
        p_pod_id, p_new_tier, v_tier_name, v_monthly_fee, 'active',
        v_scans_limit, v_wa_limit, NOW()
    )
    ON CONFLICT (pod_id) DO UPDATE SET
        tier = p_new_tier,
        tier_name = v_tier_name,
        monthly_fee_inr = v_monthly_fee,
        max_ai_scans_per_month = v_scans_limit,
        max_whatsapp_messages_per_month = v_wa_limit,
        updated_at = NOW()
    RETURNING * INTO v_res;

    -- Update current month limit
    UPDATE public.pod_usage_quotas
    SET ai_scans_limit = v_scans_limit,
        whatsapp_messages_limit = v_wa_limit,
        updated_at = NOW()
    WHERE pod_id = p_pod_id AND billing_month = to_char(NOW(), 'YYYY-MM');

    RETURN jsonb_build_object(
        'success', TRUE,
        'tier', v_res.tier,
        'tier_name', v_res.tier_name,
        'monthly_fee_inr', v_res.monthly_fee_inr,
        'max_ai_scans', v_scans_limit,
        'max_whatsapp', v_wa_limit
    );
END;
$$;
GRANT EXECUTE ON FUNCTION public.upgrade_pod_saas_tier(UUID, VARCHAR) TO authenticated, anon, service_role;

-- 8. Add Realtime publication
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.saas_subscriptions;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pod_usage_quotas;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
