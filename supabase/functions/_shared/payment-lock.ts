// =============================================================================
// Mediflow — Payment Advisory Lock Utility (Session-Scoped)
// Provides distributed locking for payment operations to prevent race conditions
// between Meta Webhook, Razorpay Webhook, and manual counter operations.
//
// CRITICAL FIX: Uses SESSION-scoped advisory locks (pg_try_advisory_lock)
// instead of TRANSACTION-scoped (pg_try_advisory_xact_lock).
//
// Transaction-scoped locks auto-release when the RPC call's transaction commits,
// which happens IMMEDIATELY in Supabase Edge Functions because each .from()
// call is its own auto-committed transaction. Session-scoped locks persist
// across multiple queries within the same DB connection (Edge Function invocation)
// and MUST be explicitly released via releasePaymentLock().
// =============================================================================

export interface PaymentLockResult {
  acquired: boolean;
  lockKey: string;
}

/**
 * Generates a deterministic 64-bit lock key from an identifier string.
 * Uses djb2 hash combined with string length to minimize collisions.
 */
function computeLockKey(identifier: string): string {
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = ((hash << 5) - hash) + identifier.charCodeAt(i);
    hash |= 0; // Convert to 32-bit integer
  }
  // Convert to 64-bit by combining hash with length
  const lockKey = BigInt(hash) << 32n | BigInt(identifier.length & 0xffffffff);
  return lockKey.toString();
}

/**
 * Acquires a SESSION-scoped advisory lock for payment operations.
 * Returns true if lock acquired, false if already held by another session.
 *
 * IMPORTANT: This lock persists until explicitly released via releasePaymentLock()
 * or the database connection (Edge Function invocation) terminates.
 * Always call releasePaymentLock() in a finally block.
 */
export async function tryAcquirePaymentLock(
  supabase: any,
  identifier: string
): Promise<PaymentLockResult> {
  const lockKeyStr = computeLockKey(identifier);

  try {
    const { data, error } = await supabase.rpc('try_acquire_session_lock', {
      p_key: lockKeyStr
    });

    if (error) {
      // If the RPC doesn't exist yet, fail-open with a warning
      // This prevents webhooks from silently skipping payment processing
      console.warn(`[PaymentLock] Session lock RPC error for ${identifier}:`, error.message);
      // FAIL-OPEN: Return acquired=true so payment processing continues
      // Better to risk double-processing (which idempotency guards catch)
      // than to silently skip a legitimate payment
      return { acquired: true, lockKey: lockKeyStr };
    }

    return { acquired: data === true, lockKey: lockKeyStr };
  } catch (e) {
    console.error(`[PaymentLock] Exception for ${identifier}:`, e);
    // FAIL-OPEN: Same reasoning as above
    return { acquired: true, lockKey: lockKeyStr };
  }
}

/**
 * Releases a previously acquired session-scoped advisory lock.
 * MUST be called after payment processing completes (in a finally block).
 */
export async function releasePaymentLock(
  supabase: any,
  identifier: string
): Promise<void> {
  const lockKeyStr = computeLockKey(identifier);

  try {
    await supabase.rpc('release_session_lock', { p_key: lockKeyStr });
  } catch (e) {
    // Non-fatal: lock will auto-release when the DB connection closes
    console.warn(`[PaymentLock] Failed to release lock for ${identifier}:`, e);
  }
}

/**
 * Executes a payment-critical function with session-scoped advisory lock protection.
 * Lock is explicitly released after the callback completes (success or failure).
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
    await releasePaymentLock(supabase, identifier);
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
        await releasePaymentLock(supabase, identifier);
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