import { supabase } from '../lib/supabaseClient';
import { resolvePodContext } from './podContext';
import { safeGetStorageJSON, safeSetStorageJSON } from '../utils/storage';

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
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mediflow-state-change'));
  }
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
  try {
    const utf8Safe = encodeURIComponent(text);
    let result = '';
    for (let i = 0; i < utf8Safe.length; i++) {
      result += String.fromCharCode(utf8Safe.charCodeAt(i) ^ STORAGE_KEY_SALT.charCodeAt(i % STORAGE_KEY_SALT.length));
    }
    return btoa(result);
  } catch (_e) {
    return btoa(unescape(encodeURIComponent(text)));
  }
}

function deobfuscate(encoded: string): string {
  try {
    const raw = atob(encoded);
    let result = '';
    for (let i = 0; i < raw.length; i++) {
      result += String.fromCharCode(raw.charCodeAt(i) ^ STORAGE_KEY_SALT.charCodeAt(i % STORAGE_KEY_SALT.length));
    }
    try {
      return decodeURIComponent(result);
    } catch (_uriErr) {
      return decodeURIComponent(escape(result));
    }
  } catch (_atobErr) {
    return encoded;
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
    const tickets = safeGetStorageJSON<any[] | null>('vitalsync_support_tickets', null) ||
                    safeGetStorageJSON<any[] | null>('mediflow_support_tickets', null);
    if (tickets && tickets.length > 0) {
      try {
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const freshTickets = tickets.filter((t: any) => new Date(t.created_at).getTime() > sevenDaysAgo);
        safeSetStorageJSON('vitalsync_support_tickets', freshTickets);
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
    const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
    const ctx = await resolvePodContext();

    let actorId: string | null = null;
    let actorName = 'System Staff';
    if (user?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id)) {
      actorId = user.id;
      actorName = user.email || user.id;
    } else {
      const cached = safeGetStorageJSON<any>('vitalsync_cached_profile', null);
      if (cached?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cached.id)) {
        actorId = cached.id;
      }
      actorName = cached?.name || cached?.display_name || cached?.email || state.simulatedRole || 'staff-terminal';
    }

    const payloadDetails = {
      ...details,
      record_id: entityId,
      actor_name: actorName,
      simulated_role: state.simulatedRole,
      timestamp: new Date().toISOString()
    };

    // 1. Primary path: RPC call (SECURITY DEFINER ensures zero-drop recording across all staff roles)
    const { error: rpcErr } = await supabase.rpc('log_activity_event', {
      p_action_type: actionType,
      p_details: payloadDetails,
      p_entity_id: entityId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entityId) ? entityId : (ctx.entityId || null),
      p_pod_id: ctx.podId || null,
      p_actor_id: actorId
    });

    if (rpcErr) {
      // 2. Direct insert fallback
      const auditId = crypto.randomUUID();
      await supabase.from('activity_logs').insert({
        id: auditId,
        action_type: actionType,
        details: payloadDetails,
        pod_id: ctx.podId || null
      });
    }
  } catch (e) {
    console.warn('[Mediflow Audit] Non-fatal audit log warning:', e);
  }
}
