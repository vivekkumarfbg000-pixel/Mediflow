// =============================================================================
// Mediflow — Payment Advisory Lock Utility
// Provides distributed locking for payment operations to prevent race conditions
// between Meta Webhook, Razorpay Webhook, and manual counter operations.
// Uses PostgreSQL advisory locks (pg_advisory_xact_lock / pg_try_advisory_xact_lock)
// =============================================================================

export interface PaymentLockResult {
  acquired: boolean;
  lockKey: string;
}

/**
 * Acquires a transaction-level advisory lock for payment operations.
 * Returns true if lock acquired, false if already held by another transaction.
 * Lock is automatically released at end of transaction (commit or rollback).
 */
export async function tryAcquirePaymentLock(
  supabase: any,
  identifier: string
): Promise<PaymentLockResult> {
  // Generate deterministic 64-bit key from identifier string
  // Using hash combination to minimize collisions
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = ((hash << 5) - hash) + identifier.charCodeAt(i);
    hash |= 0; // Convert to 32-bit integer
  }
  // Convert to 64-bit by combining with length
  const lockKey = BigInt(hash) << 32n | BigInt(identifier.length & 0xffffffff);
  const lockKeyStr = lockKey.toString();

  try {
    const { data, error } = await supabase.rpc('pg_try_advisory_xact_lock', {
      key: lockKeyStr
    });

    if (error) {
      console.warn(`[PaymentLock] RPC error for ${identifier}:`, error);
      return { acquired: false, lockKey: lockKeyStr };
    }

    return { acquired: data === true, lockKey: lockKeyStr };
  } catch (e) {
    console.error(`[PaymentLock] Exception for ${identifier}:`, e);
    return { acquired: false, lockKey: lockKeyStr };
  }
}

/**
 * Executes a payment-critical function with advisory lock protection.
 * Throws if lock cannot be acquired (another operation in progress).
 * Lock is held for the duration of the callback and released on completion.
 */
export async function withPaymentLock<T>(
  supabase: any,
  identifier: string,
  fn: () => Promise<T>
): Promise<T> {
  const result = await tryAcquirePaymentLock(supabase, identifier);
  
  if (!result.acquired) {
    throw new Error(`Payment operation already in progress for ${identifier}. Lock key: ${result.lockKey}`);
  }

  try {
    return await fn();
  } finally {
    // Lock is automatically released at transaction end (commit/rollback)
    // No explicit unlock needed for xact locks
  }
}

/**
 * Stronger lock that blocks until acquired (with timeout).
 * Use for critical sections that must not fail due to contention.
 */
export async function withBlockingPaymentLock<T>(
  supabase: any,
  identifier: string,
  fn: () => Promise<T>,
  timeoutMs: number = 10000
): Promise<T> {
  const startTime = Date.now();
  const pollInterval = 100; // ms
  
  while (true) {
    const result = await tryAcquirePaymentLock(supabase, identifier);
    
    if (result.acquired) {
      try {
        return await fn();
      } finally {
        // Auto-released on transaction end
      }
    }
    
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Payment lock timeout for ${identifier} after ${timeoutMs}ms`);
    }
    
    // Wait before retry
    await new Promise(r => setTimeout(r, pollInterval));
  }
}

/**
 * Generates a consistent lock identifier for common payment entities.
 */
export function getPaymentLockKey(type: 'invoice' | 'appointment' | 'patient', id: string): string {
  return `payment_${type}_${id}`;
}

export function getInvoiceLockKey(invoiceId: string): string {
  return getPaymentLockKey('invoice', invoiceId);
}

export function getAppointmentLockKey(appointmentId: string): string {
  return getPaymentLockKey('appointment', appointmentId);
}

export function getPatientLockKey(patientId: string): string {
  return getPaymentLockKey('patient', patientId);
}