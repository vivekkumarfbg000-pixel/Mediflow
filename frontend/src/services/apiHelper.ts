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

const STORAGE_KEY_SALT = 'MediflowSecOpsStorageKey2026!';

function obfuscate(text: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ STORAGE_KEY_SALT.charCodeAt(i % STORAGE_KEY_SALT.length));
  }
  return btoa(unescape(encodeURIComponent(result)));
}

function deobfuscate(encoded: string): string {
  const raw = decodeURIComponent(escape(atob(encoded)));
  let result = '';
  for (let i = 0; i < raw.length; i++) {
    result += String.fromCharCode(raw.charCodeAt(i) ^ STORAGE_KEY_SALT.charCodeAt(i % STORAGE_KEY_SALT.length));
  }
  return result;
}

export function load<T>(key: string, defaultValue: T): T {
  if (storageCache.has(key)) {
    return storageCache.get(key) as T;
  }
  const data = localStorage.getItem(getStorageKey(key));
  let parsed = defaultValue;
  if (data) {
    try {
      let decrypted = data;
      try {
        decrypted = deobfuscate(data);
      } catch (deobfErr) {
        // Fallback for legacy plaintext entries (auto-migrated below on save)
        console.info(`[Mediflow SecOps] Migrating legacy plaintext storage for key "${key}"`);
      }
      parsed = JSON.parse(decrypted);
    } catch (e) {
      console.warn(`[Mediflow Cache] Failed parsing corrupted key "${key}":`, e);
      // Automatically self-heal by writing defaultValue back to storage
      save(key, defaultValue);
    }
  }
  storageCache.set(key, parsed);
  return parsed;
}

// ── Phase 2: Storage Quota Janitor & LRU Pruner ────────────────────────────
export function runStorageJanitor(): void {
  try {
    console.warn('[VitalSync SecOps] 🧹 Storage quota limit approaching. Executing Autonomous LRU Pruner...');
    
    // Prune support tickets older than 7 days
    const ticketsRaw = localStorage.getItem('vitalsync_support_tickets') || localStorage.getItem('mediflow_support_tickets');
    if (ticketsRaw) {
      try {
        const tickets = JSON.parse(ticketsRaw);
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const freshTickets = tickets.filter((t: any) => new Date(t.created_at).getTime() > sevenDaysAgo);
        localStorage.setItem('vitalsync_support_tickets', JSON.stringify(freshTickets));
      } catch (_e) {
        /* ignore parse error */
      }
    }

    // Clear temporary non-critical keys
    const keysToEvict = ['mediflow_temp_ocr_buffer', 'vitalsync_draft_rx', 'mediflow_telemetry_cache'];
    keysToEvict.forEach(k => localStorage.removeItem(k));
  } catch (janitorErr) {
    console.error('[VitalSync SecOps] Storage janitor failed:', janitorErr);
  }
}

export function save<T>(key: string, value: T): void {
  try {
    const serialized = JSON.stringify(value);
    const encrypted = obfuscate(serialized);
    localStorage.setItem(getStorageKey(key), encrypted);
  } catch (err: any) {
    if (err?.name === 'QuotaExceededError' || err?.code === 22 || err?.message?.includes('quota')) {
      console.warn(`[VitalSync SecOps] QuotaExceededError writing "${key}". Triggering LRU Storage Janitor...`);
      runStorageJanitor();
      try {
        const serialized = JSON.stringify(value);
        const encrypted = obfuscate(serialized);
        localStorage.setItem(getStorageKey(key), encrypted);
      } catch (retryErr) {
        console.error(`[VitalSync SecOps] Critical storage exhaustion. Key "${key}" saved in-memory only:`, retryErr);
      }
    } else {
      console.error(`[VitalSync SecOps] Local storage save failed for key "${key}":`, err);
    }
  }
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
