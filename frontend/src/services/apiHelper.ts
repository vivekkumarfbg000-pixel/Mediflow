import { supabase } from '../lib/supabaseClient';

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

export function load<T>(key: string, defaultValue: T): T {
  const data = localStorage.getItem(getStorageKey(key));
  return data ? JSON.parse(data) : defaultValue;
}

export function save<T>(key: string, value: T): void {
  localStorage.setItem(getStorageKey(key), JSON.stringify(value));
}

export async function writeAuditLog(actionType: string, details: Record<string, any> = {}, entityId: string | null = null): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('activity_logs').insert({
      actor_id: user?.id || null,
      action_type: actionType,
      entity_id: entityId || 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002', // Seeded clinic
      details: {
        ...details,
        simulated_role: state.simulatedRole,
        timestamp: new Date().toISOString()
      }
    });
  } catch (e) {
    console.error('[Mediflow DevSecOps] Failed to write audit log:', e);
  }
}
