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
    // Skip audit log if no authenticated user — RLS blocks anon inserts
    if (!user?.id) {
      console.debug('[Mediflow Audit] Skipping audit log (no authenticated user):', actionType);
      return;
    }

    // Resolve user's actual entity_id and pod_id dynamically to satisfy FK constraints and RLS pod isolation
    let activeEntityId = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002'; // Seeded clinic entity fallback
    let activePodId = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'; // Seeded pod fallback

    const { data: profile } = await supabase
      .from('profiles')
      .select('entity_id, entities(pod_id)')
      .eq('id', user.id)
      .maybeSingle();

    if (profile) {
      if (profile.entity_id) activeEntityId = profile.entity_id;
      const joinedEntities = (profile as any).entities;
      if (joinedEntities && joinedEntities.pod_id) activePodId = joinedEntities.pod_id;
    }

    const { error } = await supabase.from('activity_logs').insert({
      actor_id: user.id,
      action_type: actionType,
      entity_id: activeEntityId, // Insert activeEntityId which is a valid reference to public.entities
      pod_id: activePodId, // Insert activePodId satisfying RLS and NOT NULL constraint
      details: {
        ...details,
        record_id: entityId, // Store the call-specific custom record ID in JSONB details to prevent constraint violation
        simulated_role: state.simulatedRole,
        timestamp: new Date().toISOString()
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
