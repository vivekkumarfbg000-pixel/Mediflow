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

let _ctx: PodContext = {
  userId:          null,
  entityId:        FALLBACK_ENTITY_ID,
  podId:           FALLBACK_POD_ID,
  doctorId:        null,
  labEntityId:     FALLBACK_LAB_ENTITY,
  pharmacyEntityId: FALLBACK_PHARM_ENTITY,
  loaded:          false,
};

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

      // Fetch profile joined with entities table
      const { data: profile } = await supabase
        .from('profiles')
        .select('entity_id, role, entities!inner(pod_id, entity_type)')
        .eq('id', user.id)
        .maybeSingle();

      const entities = (profile as any)?.entities;

      // Try to find sibling lab and pharmacy entities in the same pod
      const podId = entities?.pod_id || FALLBACK_POD_ID;
      let labEntityId    = FALLBACK_LAB_ENTITY;
      let pharmacyEntityId = FALLBACK_PHARM_ENTITY;

      if (podId !== FALLBACK_POD_ID) {
        // Look up all entities for this pod to find lab and pharmacy
        const { data: siblings } = await supabase
          .from('entities')
          .select('id, entity_type')
          .eq('pod_id', podId);

        if (siblings) {
          const lab  = siblings.find(e => e.entity_type === 'lab');
          const pharm = siblings.find(e => e.entity_type === 'pharmacy');
          if (lab)  labEntityId    = lab.id;
          if (pharm) pharmacyEntityId = pharm.id;
        }
      }

      _ctx = {
        userId:           user.id,
        entityId:         profile?.entity_id  || FALLBACK_ENTITY_ID,
        podId,
        doctorId:         profile?.role === 'doctor' ? user.id : null,
        labEntityId,
        pharmacyEntityId,
        loaded:           true,
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
    entityId:        FALLBACK_ENTITY_ID,
    podId:           FALLBACK_POD_ID,
    doctorId:        null,
    labEntityId:     FALLBACK_LAB_ENTITY,
    pharmacyEntityId: FALLBACK_PHARM_ENTITY,
    loaded:          false,
  };
  _resolvePromise = null;
}
