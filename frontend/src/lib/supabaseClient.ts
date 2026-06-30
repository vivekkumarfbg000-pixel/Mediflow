import { createClient } from '@supabase/supabase-js';

const PILOT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://kguupaybvbngyzyofjun.supabase.co';
let supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';

// Validate if the key is a valid JWT or if it's the wrong Cashfree key that was accidentally pasted
const isValidJwt = supabaseAnonKey && supabaseAnonKey.startsWith('eyJ');
if (!isValidJwt) {
  console.warn('[Supabase Client] Invalid or missing Supabase client key. Falling back to the hardcoded pilot key.');
  supabaseAnonKey = PILOT_ANON_KEY;
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey
);

export const isMissingEnv = !import.meta.env.VITE_SUPABASE_ANON_KEY || !isValidJwt;
