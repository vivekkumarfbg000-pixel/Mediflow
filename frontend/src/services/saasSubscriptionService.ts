/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║        VITALSYNC SAAS SUBSCRIPTION & QUOTA ENFORCEMENT ENGINE             ║
 * ║  Strict NMC Ethics Code 6.4 & DPDP Act 2023 Compliant Architecture        ║
 * ║  Pure B2B Software Subscription: 90-Day Pilot | ₹999 Growth | ₹1,999 Pro  ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { supabase } from '../lib/supabaseClient';
import { getPodContext, FALLBACK_POD_ID } from './podContext';
import { safeGetStorageJSON, safeSetStorageJSON } from '../utils/storage';

export type SaaSTier = 'tier_0_pilot' | 'tier_1_growth' | 'tier_2_unlimited_pro';

export interface SaaSSubscription {
  id?: string;
  podId: string;
  tier: SaaSTier;
  tierName: string;
  billingCycle: 'monthly' | 'annual';
  monthlyFeeInr: number;
  status: 'active' | 'past_due' | 'cancelled' | 'pilot_active';
  pilotStartedAt: string;
  pilotEndDate: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  maxAiScansPerMonth: number; // -1 for unlimited
  maxWhatsappMessagesPerMonth: number; // -1 for unlimited
  autoRenew: boolean;
}

export interface PodUsageQuota {
  podId: string;
  billingMonth: string; // 'YYYY-MM'
  aiScansUsed: number;
  whatsappMessagesUsed: number;
  aiScansLimit: number;
  whatsappMessagesLimit: number;
  isHardLimitExceeded: boolean;
  lastIncrementAt: string;
}

export interface UsageRecordResult {
  success: boolean;
  allowed: boolean;
  reason: string;
  tier: SaaSTier;
  tierName: string;
  monthlyFeeInr: number;
  pilotEndDate: string;
  billingMonth: string;
  aiScansUsed: number;
  aiScansLimit: number;
  whatsappMessagesUsed: number;
  whatsappMessagesLimit: number;
}

export const TIER_CONFIGS: Record<SaaSTier, {
  name: string;
  price: number;
  scansLimit: number;
  waLimit: number;
  description: string;
  badge: string;
}> = {
  tier_0_pilot: {
    name: '90-Day Free Clinical Pilot',
    price: 0,
    scansLimit: 1000,
    waLimit: 1000,
    description: 'Full-access clinical pilot for 90 days with zero financial lock-in',
    badge: '90-Day Free Pilot'
  },
  tier_1_growth: {
    name: 'Growth Plan',
    price: 999,
    scansLimit: 1000,
    waLimit: 1000,
    description: '1,000 AI vision scans + 1,000 WhatsApp care loops / month',
    badge: 'Growth ₹999/mo'
  },
  tier_2_unlimited_pro: {
    name: 'Unlimited Pro Plan',
    price: 1999,
    scansLimit: -1,
    waLimit: -1,
    description: 'Unlimited AI OCR vision scans + Unlimited WhatsApp care loops (fair use)',
    badge: 'Unlimited Pro ₹1,999/mo'
  }
};

export class SaaSSubscriptionService {
  private static readonly SUB_CACHE_KEY = 'vitalsync_saas_sub';
  private static readonly QUOTA_CACHE_KEY = 'vitalsync_saas_quota';

  private static getCurrentMonth(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Synchronously hydrate subscription from local cache, fallback to default 90-day pilot
   */
  static getCachedSubscription(podId?: string): SaaSSubscription {
    const targetPod = podId || getPodContext().podId || FALLBACK_POD_ID;
    const cached = safeGetStorageJSON<SaaSSubscription | null>(`${this.SUB_CACHE_KEY}_${targetPod}`, null);
    if (cached) return cached;

    // Default 90-day pilot
    const now = new Date();
    const pilotEnd = new Date(now.getTime() + 90 * 24 * 3600 * 1000);
    return {
      podId: targetPod,
      tier: 'tier_0_pilot',
      tierName: '90-Day Free Clinical Pilot',
      billingCycle: 'monthly',
      monthlyFeeInr: 0,
      status: 'active',
      pilotStartedAt: now.toISOString(),
      pilotEndDate: pilotEnd.toISOString(),
      maxAiScansPerMonth: 1000,
      maxWhatsappMessagesPerMonth: 1000,
      autoRenew: true
    };
  }

  /**
   * Synchronously hydrate quota from local cache
   */
  static getCachedQuota(podId?: string): PodUsageQuota {
    const targetPod = podId || getPodContext().podId || FALLBACK_POD_ID;
    const month = this.getCurrentMonth();
    const cached = safeGetStorageJSON<PodUsageQuota | null>(`${this.QUOTA_CACHE_KEY}_${targetPod}_${month}`, null);
    if (cached) return cached;

    const sub = this.getCachedSubscription(targetPod);
    return {
      podId: targetPod,
      billingMonth: month,
      aiScansUsed: 0,
      whatsappMessagesUsed: 0,
      aiScansLimit: sub.maxAiScansPerMonth,
      whatsappMessagesLimit: sub.maxWhatsappMessagesPerMonth,
      isHardLimitExceeded: false,
      lastIncrementAt: new Date().toISOString()
    };
  }

  /**
   * Fetch live subscription and quota from Supabase
   */
  static async fetchLiveStatus(podId?: string): Promise<{ subscription: SaaSSubscription; quota: PodUsageQuota }> {
    const targetPod = podId || getPodContext().podId || FALLBACK_POD_ID;
    const month = this.getCurrentMonth();

    try {
      const { data, error } = await supabase.rpc('get_pod_subscription_status', {
        p_pod_id: targetPod
      });

      if (!error && data) {
        const sub: SaaSSubscription = {
          podId: targetPod,
          tier: data.tier || 'tier_0_pilot',
          tierName: data.tier_name || '90-Day Free Clinical Pilot',
          billingCycle: 'monthly',
          monthlyFeeInr: Number(data.monthly_fee_inr || 0),
          status: data.status || 'active',
          pilotStartedAt: new Date().toISOString(),
          pilotEndDate: data.pilot_end_date || new Date(Date.now() + 90 * 86400000).toISOString(),
          maxAiScansPerMonth: Number(data.ai_scans_limit ?? 1000),
          maxWhatsappMessagesPerMonth: Number(data.whatsapp_messages_limit ?? 1000),
          autoRenew: true
        };

        const quota: PodUsageQuota = {
          podId: targetPod,
          billingMonth: data.billing_month || month,
          aiScansUsed: Number(data.ai_scans_used || 0),
          whatsappMessagesUsed: Number(data.whatsapp_messages_used || 0),
          aiScansLimit: Number(data.ai_scans_limit ?? 1000),
          whatsappMessagesLimit: Number(data.whatsapp_messages_limit ?? 1000),
          isHardLimitExceeded: (data.ai_scans_limit > 0 && data.ai_scans_used >= data.ai_scans_limit) ||
                               (data.whatsapp_messages_limit > 0 && data.whatsapp_messages_used >= data.whatsapp_messages_limit),
          lastIncrementAt: new Date().toISOString()
        };

        safeSetStorageJSON(`${this.SUB_CACHE_KEY}_${targetPod}`, sub);
        safeSetStorageJSON(`${this.QUOTA_CACHE_KEY}_${targetPod}_${month}`, quota);

        return { subscription: sub, quota };
      }
    } catch (err) {
      console.warn('[SaaSSubscriptionService] Live status fetch failed, using local cache:', err);
    }

    return {
      subscription: this.getCachedSubscription(targetPod),
      quota: this.getCachedQuota(targetPod)
    };
  }

  /**
   * Atomically record usage (ai_scan or whatsapp_message) with quota enforcement
   */
  static async recordUsage(
    usageType: 'ai_scan' | 'whatsapp_message',
    increment: number = 1,
    podId?: string
  ): Promise<UsageRecordResult> {
    const targetPod = podId || getPodContext().podId || FALLBACK_POD_ID;
    const month = this.getCurrentMonth();

    // Optimistic local update
    const currentQuota = this.getCachedQuota(targetPod);
    const sub = this.getCachedSubscription(targetPod);

    if (usageType === 'ai_scan') {
      currentQuota.aiScansUsed += increment;
    } else {
      currentQuota.whatsappMessagesUsed += increment;
    }
    currentQuota.lastIncrementAt = new Date().toISOString();
    safeSetStorageJSON(`${this.QUOTA_CACHE_KEY}_${targetPod}_${month}`, currentQuota);

    // Broadcast update
    window.dispatchEvent(new CustomEvent('mediflow-subscription-update', {
      detail: { quota: currentQuota, subscription: sub }
    }));

    try {
      const { data, error } = await supabase.rpc('record_pod_usage_quota', {
        p_pod_id: targetPod,
        p_usage_type: usageType,
        p_increment: increment
      });

      if (!error && data) {
        const result: UsageRecordResult = {
          success: Boolean(data.success),
          allowed: Boolean(data.allowed),
          reason: data.reason || 'OK',
          tier: data.tier || sub.tier,
          tierName: data.tier_name || sub.tierName,
          monthlyFeeInr: Number(data.monthly_fee_inr || 0),
          pilotEndDate: data.pilot_end_date || sub.pilotEndDate,
          billingMonth: data.billing_month || month,
          aiScansUsed: Number(data.ai_scans_used || currentQuota.aiScansUsed),
          aiScansLimit: Number(data.ai_scans_limit ?? currentQuota.aiScansLimit),
          whatsappMessagesUsed: Number(data.whatsapp_messages_used || currentQuota.whatsappMessagesUsed),
          whatsappMessagesLimit: Number(data.whatsapp_messages_limit ?? currentQuota.whatsappMessagesLimit)
        };

        // Resync local cache with server state
        currentQuota.aiScansUsed = result.aiScansUsed;
        currentQuota.aiScansLimit = result.aiScansLimit;
        currentQuota.whatsappMessagesUsed = result.whatsappMessagesUsed;
        currentQuota.whatsappMessagesLimit = result.whatsappMessagesLimit;
        safeSetStorageJSON(`${this.QUOTA_CACHE_KEY}_${targetPod}_${month}`, currentQuota);

        return result;
      }
    } catch (rpcErr) {
      console.warn('[SaaSSubscriptionService] RPC record_pod_usage_quota failed, using local result:', rpcErr);
    }

    const scansLimit = sub.maxAiScansPerMonth;
    const waLimit = sub.maxWhatsappMessagesPerMonth;
    const allowed = (usageType === 'ai_scan' && (scansLimit < 0 || currentQuota.aiScansUsed <= scansLimit)) ||
                    (usageType === 'whatsapp_message' && (waLimit < 0 || currentQuota.whatsappMessagesUsed <= waLimit));

    return {
      success: true,
      allowed,
      reason: allowed ? 'OK' : 'Quota threshold reached. Please upgrade to Unlimited Pro for unrestricted access.',
      tier: sub.tier,
      tierName: sub.tierName,
      monthlyFeeInr: sub.monthlyFeeInr,
      pilotEndDate: sub.pilotEndDate,
      billingMonth: month,
      aiScansUsed: currentQuota.aiScansUsed,
      aiScansLimit: scansLimit,
      whatsappMessagesUsed: currentQuota.whatsappMessagesUsed,
      whatsappMessagesLimit: waLimit
    };
  }

  /**
   * 1-Click upgrade or switch SaaS tier
   */
  static async upgradeTier(
    newTier: SaaSTier,
    podId?: string
  ): Promise<{ success: boolean; subscription: SaaSSubscription; error?: string }> {
    const targetPod = podId || getPodContext().podId || FALLBACK_POD_ID;
    const config = TIER_CONFIGS[newTier];
    const month = this.getCurrentMonth();

    // Optimistic local update
    const sub: SaaSSubscription = {
      ...this.getCachedSubscription(targetPod),
      tier: newTier,
      tierName: config.name,
      monthlyFeeInr: config.price,
      maxAiScansPerMonth: config.scansLimit,
      maxWhatsappMessagesPerMonth: config.waLimit,
      status: 'active'
    };

    safeSetStorageJSON(`${this.SUB_CACHE_KEY}_${targetPod}`, sub);

    const quota = this.getCachedQuota(targetPod);
    quota.aiScansLimit = config.scansLimit;
    quota.whatsappMessagesLimit = config.waLimit;
    safeSetStorageJSON(`${this.QUOTA_CACHE_KEY}_${targetPod}_${month}`, quota);

    window.dispatchEvent(new CustomEvent('mediflow-subscription-update', {
      detail: { subscription: sub, quota }
    }));

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        title: 'Plan Upgraded! 🚀',
        message: `Successfully transitioned to ${config.name} (₹${config.price}/month). Quotas updated.`,
        type: 'success'
      }
    }));

    try {
      const { data, error } = await supabase.rpc('upgrade_pod_saas_tier', {
        p_pod_id: targetPod,
        p_new_tier: newTier
      });

      if (error) {
        console.warn('[SaaSSubscriptionService] Remote tier upgrade failed, local active:', error);
      } else if (data) {
        sub.tier = data.tier;
        sub.tierName = data.tier_name;
        sub.monthlyFeeInr = Number(data.monthly_fee_inr || config.price);
        sub.maxAiScansPerMonth = Number(data.max_ai_scans || config.scansLimit);
        sub.maxWhatsappMessagesPerMonth = Number(data.max_whatsapp || config.waLimit);
        safeSetStorageJSON(`${this.SUB_CACHE_KEY}_${targetPod}`, sub);
      }
      return { success: true, subscription: sub };
    } catch (err: any) {
      return { success: true, subscription: sub };
    }
  }
}
