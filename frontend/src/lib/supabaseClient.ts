import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // In production, a missing env var is a hard startup failure — not a warning.
  // Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to Vercel Environment Variables.
  throw new Error(
    '[Mediflow] FATAL: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set. ' +
    'Add them to your Vercel project environment variables and trigger a redeploy.'
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      lock: (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => fn()
    }
  }
);

export const isMissingEnv = false; // Guard above ensures we never reach here without valid env vars.
