// =============================================================================
// VitalSync — Enterprise Sliding-Window Rate Limiter & Lockout Engine
// Defends against brute-force attacks, credential stuffing, and flood attacks.
// =============================================================================

import { safeGetStorageJSON, safeSetStorageJSON } from './storage';
import { supabase } from '../lib/supabaseClient';

export type AuthAction = 
  | 'login' 
  | 'forgot_password' 
  | 'signup' 
  | 'resend_verification' 
  | 'password_change';

export interface RateLimitConfig {
  maxAttempts: number;      // Maximum allowed attempts in window
  windowSeconds: number;    // Sliding window size in seconds
  lockoutSeconds: number;   // Base lockout duration if exceeded
  exponentialMultiplier: number; // Lockout multiplier on repeat violations
}

export interface RateLimitStatus {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds: number;
  lockoutActive: boolean;
  message?: string;
}

interface AttemptRecord {
  timestamp: number;
  success: boolean;
}

interface IdentifierBucket {
  attempts: AttemptRecord[];
  lockoutUntil: number;
  violationCount: number;
}

const DEFAULT_CONFIGS: Record<AuthAction, RateLimitConfig> = {
  login: {
    maxAttempts: 5,
    windowSeconds: 60,         // 5 attempts per 1 minute
    lockoutSeconds: 15 * 60,   // 15-minute initial lockout
    exponentialMultiplier: 2   // 15m -> 30m -> 60m
  },
  forgot_password: {
    maxAttempts: 3,
    windowSeconds: 15 * 60,    // 3 attempts per 15 minutes
    lockoutSeconds: 30 * 60,   // 30-minute lockout
    exponentialMultiplier: 2
  },
  signup: {
    maxAttempts: 3,
    windowSeconds: 10 * 60,    // 3 registrations per 10 minutes
    lockoutSeconds: 20 * 60,   // 20-minute lockout
    exponentialMultiplier: 1.5
  },
  resend_verification: {
    maxAttempts: 3,
    windowSeconds: 15 * 60,    // 3 resends per 15 minutes
    lockoutSeconds: 15 * 60,   // 15-minute lockout
    exponentialMultiplier: 2
  },
  password_change: {
    maxAttempts: 5,
    windowSeconds: 5 * 60,     // 5 attempts per 5 minutes
    lockoutSeconds: 15 * 60,
    exponentialMultiplier: 2
  }
};

const STORAGE_KEY_PREFIX = 'vitalsync_rate_limit_';

/**
 * Normalizes identifier (email / IP / action).
 */
function getStorageKey(action: AuthAction, identifier: string): string {
  const cleanId = (identifier || 'anonymous').trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
  return `${STORAGE_KEY_PREFIX}${action}_${cleanId}`;
}

/**
 * Retrieves the bucket for a given action + identifier.
 */
function getBucket(action: AuthAction, identifier: string): IdentifierBucket {
  const key = getStorageKey(action, identifier);
  return safeGetStorageJSON<IdentifierBucket>(key, {
    attempts: [],
    lockoutUntil: 0,
    violationCount: 0
  });
}

/**
 * Saves the bucket for a given action + identifier.
 */
function saveBucket(action: AuthAction, identifier: string, bucket: IdentifierBucket): void {
  const key = getStorageKey(action, identifier);
  safeSetStorageJSON(key, bucket);
}

/**
 * Performs a client-side sliding-window rate limit and lockout check.
 */
export function checkRateLimit(action: AuthAction, identifier: string): RateLimitStatus {
  const config = DEFAULT_CONFIGS[action] || DEFAULT_CONFIGS.login;
  const bucket = getBucket(action, identifier);
  const now = Date.now();

  // 1. Check if currently in an active lockout
  if (bucket.lockoutUntil > now) {
    const retryAfter = Math.ceil((bucket.lockoutUntil - now) / 1000);
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds: retryAfter,
      lockoutActive: true,
      message: `Too many attempts. Security cooldown active. Please try again in ${Math.ceil(retryAfter / 60)} minute(s).`
    };
  }

  // 2. Clean up attempts outside the sliding window
  const windowStart = now - (config.windowSeconds * 1000);
  const activeAttempts = bucket.attempts.filter(a => a.timestamp >= windowStart && !a.success);

  // 3. Evaluate failure threshold
  if (activeAttempts.length >= config.maxAttempts) {
    // Escalate violation count & compute exponential lockout
    const newViolationCount = (bucket.violationCount || 0) + 1;
    const multiplier = Math.pow(config.exponentialMultiplier, Math.min(newViolationCount - 1, 4));
    const lockoutDuration = Math.round(config.lockoutSeconds * multiplier * 1000);
    const lockoutUntil = now + lockoutDuration;

    bucket.attempts = activeAttempts;
    bucket.lockoutUntil = lockoutUntil;
    bucket.violationCount = newViolationCount;
    saveBucket(action, identifier, bucket);

    const retryAfter = Math.ceil(lockoutDuration / 1000);
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds: retryAfter,
      lockoutActive: true,
      message: `Rate limit exceeded. Temporary security lockout active for ${Math.ceil(retryAfter / 60)} minute(s).`
    };
  }

  const remaining = Math.max(0, config.maxAttempts - activeAttempts.length);
  return {
    allowed: true,
    remainingAttempts: remaining,
    retryAfterSeconds: 0,
    lockoutActive: false
  };
}

/**
 * Records an attempt outcome (success or failure).
 */
export function recordRateLimitAttempt(action: AuthAction, identifier: string, success: boolean): void {
  const config = DEFAULT_CONFIGS[action] || DEFAULT_CONFIGS.login;
  const bucket = getBucket(action, identifier);
  const now = Date.now();

  if (success) {
    // Clear failure attempts upon valid authentication
    bucket.attempts = [];
    bucket.lockoutUntil = 0;
    bucket.violationCount = 0;
    saveBucket(action, identifier, bucket);
    return;
  }

  // Append failure
  const windowStart = now - (config.windowSeconds * 1000);
  bucket.attempts = [
    ...bucket.attempts.filter(a => a.timestamp >= windowStart),
    { timestamp: now, success: false }
  ];

  // Auto-check if this failure crossed the threshold into lockout
  if (bucket.attempts.length >= config.maxAttempts) {
    const newViolationCount = (bucket.violationCount || 0) + 1;
    const multiplier = Math.pow(config.exponentialMultiplier, Math.min(newViolationCount - 1, 4));
    const lockoutDuration = Math.round(config.lockoutSeconds * multiplier * 1000);
    bucket.lockoutUntil = now + lockoutDuration;
    bucket.violationCount = newViolationCount;
  }

  saveBucket(action, identifier, bucket);
}

/**
 * Pre-flight rate limit validator that checks both Local Storage sentry
 * and Supabase DB RPC with timeout fallback.
 */
export async function verifyAuthActionAllowed(
  action: AuthAction, 
  identifier: string
): Promise<RateLimitStatus> {
  // 1. Client-side local check first (sub-millisecond instant protection)
  const localStatus = checkRateLimit(action, identifier);
  if (!localStatus.allowed) {
    return localStatus;
  }

  // 2. Server-side Supabase RPC check (defense-in-depth across devices/IPs)
  try {
    const rpcPromise = supabase.rpc('check_login_sentry', {
      p_email: identifier.trim().toLowerCase(),
      p_ip: null
    });

    const timeoutPromise = new Promise<{ data: any; error: any }>((resolve) =>
      setTimeout(() => resolve({ data: { allowed: true }, error: null }), 3000)
    );

    const { data, error } = await Promise.race([rpcPromise, timeoutPromise]) as any;

    if (!error && data && data.allowed === false) {
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfterSeconds: (data.retry_after_minutes || 15) * 60,
        lockoutActive: true,
        message: data.message || 'Rate limit exceeded on this account. Please try again later.'
      };
    }
  } catch (_e) {
    // Fail-open to local status on network issues
  }

  return localStatus;
}
