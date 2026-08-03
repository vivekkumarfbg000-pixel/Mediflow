import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://kguupaybvbngyzyofjun.supabase.co';
const defaultAnonKey = 'sb_publishable_zKni8xDa4b_N4qPcjlgRAA_leFfwIEm';
const rawEnvKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';
// Automatically sanitize legacy JWT keys (starting with eyJ) which Supabase disabled on 2026-06-11
const supabaseAnonKey = (rawEnvKey && !rawEnvKey.startsWith('eyJ')) ? rawEnvKey : defaultAnonKey;

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

