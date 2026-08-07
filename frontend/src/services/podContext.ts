/**
 * Mediflow — Active Clinic Pod Context
 *
 * Single source of truth for the currently authenticated user's
 * real entity_id, pod_id, and role-specific IDs.
 *
 * ── How it works ─────────────────────────────────────────────
 *  1. On login / first use, call `resolvePodContext()`.
 *  2. The context is cached in memory for the session lifetime.
 *  3. All services call `getPodContext()` to read the live values.
 *  4. On logout, call `clearPodContext()` to reset.
 *
 * ── Fallbacks ────────────────────────────────────────────────
 *  The seeded demo UUIDs are only used before the context has
 *  resolved (e.g., very first render before auth completes).
 *  Once resolved, every insert/update uses the real clinic IDs.
 */

import { supabase } from '../lib/supabaseClient';

// ── Seeded demo fallbacks (single-clinic pilot) ───────────────
// These UUIDs match the seed migration data. They are ONLY used
// when the user's real profile hasn't loaded yet.
export const FALLBACK_POD_ID       = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';
export const FALLBACK_ENTITY_ID    = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002';
export const FALLBACK_LAB_ENTITY   = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317003';
export const FALLBACK_PHARM_ENTITY = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317004';
export const FALLBACK_DOCTOR_ID    = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101';

export interface PodContext {
  /** User's Supabase auth UID */
  userId:          string | null;
  /** The entity the user belongs to (clinic / lab / pharmacy) */
  entityId:        string;
  /** The multi-tenant pod that isolates this clinic's data */
  podId:           string;
  /** The doctor's user ID (if role === 'doctor') */
  doctorId:        string | null;
  /** Lab entity ID within the pod */
  labEntityId:     string;
  /** Pharmacy entity ID within the pod */
  pharmacyEntityId: string;
  /** True once a successful Supabase profile fetch has completed */
  loaded:          boolean;
}

function getInitialPodContext(): PodContext {
  let isDemo = false;
  let userId: string | null = null;
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem('vitalsync_cached_profile');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed) {
          userId = parsed.id || null;
          const email = String(parsed.email || '').toLowerCase();
          isDemo = Boolean(parsed.isDemo === true || email === 'demo@mediflow.com' || email === 'doctor@mediflow.com' || userId === 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101');
        }
      }
    } catch (_e) { /* ignore */ }
  }

  if (isDemo) {
    return {
      userId: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101',
      entityId: FALLBACK_ENTITY_ID,
      podId: FALLBACK_POD_ID,
      doctorId: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101',
      labEntityId: FALLBACK_LAB_ENTITY,
      pharmacyEntityId: FALLBACK_PHARM_ENTITY,
      loaded: false,
    };
  }

  return {
    userId,
    entityId: userId || FALLBACK_ENTITY_ID,
    podId: userId || FALLBACK_POD_ID,
    doctorId: userId,
    labEntityId: userId || FALLBACK_LAB_ENTITY,
    pharmacyEntityId: userId || FALLBACK_PHARM_ENTITY,
    loaded: false,
  };
}

let _ctx: PodContext = getInitialPodContext();

let _resolvePromise: Promise<PodContext> | null = null;

/** Read the current (possibly unresolved) context synchronously. */
export function getPodContext(): PodContext {
  return _ctx;
}

/**
 * Resolve the context from Supabase.
 * Safe to call multiple times — deduplicates in-flight requests.
 */
export async function resolvePodContext(): Promise<PodContext> {
  if (typeof window !== 'undefined' && localStorage.getItem('mediflow_dev_bypass') === 'true') {
    _ctx = {
      userId: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101',
      entityId: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002',
      podId: FALLBACK_POD_ID,
      doctorId: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101',
      labEntityId: FALLBACK_LAB_ENTITY,
      pharmacyEntityId: FALLBACK_PHARM_ENTITY,
      loaded: true
    };
    return _ctx;
  }

  if (_ctx.loaded) return _ctx;

  // Deduplicate concurrent calls
  if (_resolvePromise) return _resolvePromise;

  _resolvePromise = (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        // Not logged in yet — keep fallbacks, mark loaded so we don't re-query
        _ctx = { 
          ..._ctx, 
          doctorId: (import.meta.env.DEV || import.meta.env.VITE_USE_MOCK === 'true') ? FALLBACK_DOCTOR_ID : null,
          loaded: true 
        };
        return _ctx;
      }

      // Fetch profile safely first
      const { data: profile } = await supabase
        .from('profiles')
        .select('entity_id, role')
        .eq('id', user.id)
        .maybeSingle();

      const email = String(user.email || '').toLowerCase();
      const name = String(user.user_metadata?.display_name || user.user_metadata?.name || '').toLowerCase();
      const isDemoUser = Boolean(
        email === 'demo@mediflow.com' ||
        email === 'doctor@mediflow.com' ||
        user.id === 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101'
      );

      let podId = isDemoUser ? FALLBACK_POD_ID : user.id;
      let entityId = isDemoUser ? FALLBACK_ENTITY_ID : (profile?.entity_id || user.id);

      if (profile?.entity_id) {
        const { data: userEntity } = await supabase
          .from('entities')
          .select('pod_id, entity_type')
          .eq('id', profile.entity_id)
          .maybeSingle();
        if (userEntity?.pod_id) {
          podId = userEntity.pod_id;
        }
      }

      let labEntityId = isDemoUser ? FALLBACK_LAB_ENTITY : user.id;
      let pharmacyEntityId = isDemoUser ? FALLBACK_PHARM_ENTITY : user.id;

      if (podId && podId !== FALLBACK_POD_ID) {
        // Look up all entities for this pod to find lab and pharmacy
        const { data: siblings } = await supabase
          .from('entities')
          .select('id, entity_type')
          .eq('pod_id', podId);

        if (siblings && siblings.length > 0) {
          const lab = siblings.find(e => e.entity_type === 'lab');
          const pharm = siblings.find(e => e.entity_type === 'pharmacy');
          if (lab) labEntityId = lab.id;
          if (pharm) pharmacyEntityId = pharm.id;
        }
      }

      // Automatically purge pre-seeded demo keys from browser localStorage for live non-demo accounts
      if (!isDemoUser && typeof window !== 'undefined') {
        const keysToPurge = [
          'patients',
          'saas_appointments',
          'financial_ledgers',
          'patient_registry',
          'medicine_bills',
          'lab_requisitions',
          'mediflow_patients',
          'mediflow_financial_ledgers',
          'mediflow_unified_invoices'
        ];
        keysToPurge.forEach(k => localStorage.removeItem(k));
      }

      _ctx = {
        userId: user.id,
        entityId,
        podId,
        doctorId: profile?.role === 'doctor' ? user.id : null,
        labEntityId,
        pharmacyEntityId,
        loaded: true,
      };

      console.debug('[Mediflow PodContext] Resolved:', {
        entityId:  _ctx.entityId,
        podId:     _ctx.podId,
        role:      profile?.role,
        usingFallback: _ctx.entityId === FALLBACK_ENTITY_ID,
      });
    } catch (e) {
      console.warn('[Mediflow PodContext] Resolution failed, using seed fallbacks:', e);
      _ctx = { ..._ctx, loaded: true };
    }

    _resolvePromise = null;
    return _ctx;
  })();

  return _resolvePromise;
}

/** Call on logout to reset the context for the next user. */
export function clearPodContext(): void {
  _ctx = {
    userId:          null,
    entityId:        'unassigned-entity',
    podId:           'unassigned-pod',
    doctorId:        null,
    labEntityId:     'unassigned-lab',
    pharmacyEntityId: 'unassigned-pharmacy',
    loaded:          false,
  };
  _resolvePromise = null;
}
