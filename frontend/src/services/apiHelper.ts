import { supabase } from '../lib/supabaseClient';
import { resolvePodContext } from './podContext';

if (typeof window !== 'undefined') {
  (window as any).supabase = supabase;
}

export const state = {
  isSyncing: false,
  isVoiceScribing: false,
  isOcrScanning: false,
  isLabTrending: false,
  simulatedRole: 'compounder',
};

export const listeners = new Set<() => void>();

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notify() {
  listeners.forEach(cb => cb());
}

export function getStorageKey(key: string): string {
  return `mediflow_${key}`;
}

const storageCache = new Map<string, any>();

export function clearStorageCache(key?: string) {
  if (key) {
    storageCache.delete(key);
  } else {
    storageCache.clear();
  }
}

export function load<T>(key: string, defaultValue: T): T {
  if (storageCache.has(key)) {
    return storageCache.get(key) as T;
  }
  const data = localStorage.getItem(getStorageKey(key));
  let parsed = defaultValue;
  if (data) {
    try {
      parsed = JSON.parse(data);
    } catch (e) {
      console.warn(`[Mediflow Cache] Failed parsing corrupted key "${key}":`, e);
      // Automatically self-heal by writing defaultValue back to storage
      localStorage.setItem(getStorageKey(key), JSON.stringify(defaultValue));
    }
  }
  storageCache.set(key, parsed);
  return parsed;
}

export function save<T>(key: string, value: T): void {
  localStorage.setItem(getStorageKey(key), JSON.stringify(value));
  storageCache.set(key, value);
}

export async function writeAuditLog(
  actionType: string,
  details: Record<string, any> = {},
  entityId: string | null = null
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    // Skip audit log if no authenticated user — RLS blocks anon inserts
    if (!user?.id) {
      console.debug('[Mediflow Audit] Skipping audit log (no authenticated user):', actionType);
      return;
    }

    // Resolve entity/pod IDs via centralized PodContext (cached after first call,
    // falls back to seeded demo UUIDs only before auth profile loads)
    const ctx = await resolvePodContext();

    const { error } = await supabase.from('activity_logs').insert({
      actor_id:    user.id,
      action_type: actionType,
      entity_id:   ctx.entityId,
      pod_id:      ctx.podId,
      details: {
        ...details,
        record_id:      entityId,
        simulated_role: state.simulatedRole,
        timestamp:      new Date().toISOString()
      }
    });

    if (error) {
      // Log but don't throw — audit failures should not crash clinical workflows
      console.warn('[Mediflow Audit] Non-fatal audit log error:', error.message);
    }
  } catch (e) {
    console.warn('[Mediflow DevSecOps] Failed to write audit log (non-fatal):', e);
  }
}
