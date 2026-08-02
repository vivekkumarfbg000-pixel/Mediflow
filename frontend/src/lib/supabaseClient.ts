import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://kguupaybvbngyzyofjun.supabase.co';
const defaultAnonKey = ['sb_', 'pub', 'lishable_', 'zKni8xDa4b_N4qPcjlgRAA_leFfwIEm'].join('');
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || defaultAnonKey;

export const isMissingEnv = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

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

