import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // In development: copy frontend/.env.example to frontend/.env.local and fill values.
  // In production:  add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to Vercel env vars.
  throw new Error(
    '[Mediflow] Missing required environment variables: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
    'Copy frontend/.env.example to frontend/.env.local and fill in your Supabase project credentials.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
