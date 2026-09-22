import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://kguupaybvbngyzyofjun.supabase.co';
const defaultAnonKey = 'sb_publishable_zKni8xDa4b_N4qPcjlgRAA_leFfwIEm';
const rawEnvKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';
// Use the provided environment key, falling back to the default anon key if missing.
const supabaseAnonKey = rawEnvKey || defaultAnonKey;

export const isMissingEnv = false;

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

export function clearSupabaseTokens() {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && /^sb-.*-auth-token$/.test(key)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
}
