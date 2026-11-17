import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { sessionStorage } from './sessionStorage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** False until EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set (see .env.example). */
export const isSupabaseConfigured = /^https?:\/\//.test(url) && anonKey.length > 0 && !url.includes('YOUR-PROJECT');

/**
 * The only Supabase client in the app. It holds the public anon key only: data
 * is protected by row-level security, and no service key or AI key ever ships
 * in the bundle.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        ...(sessionStorage ? { storage: sessionStorage } : {}),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;
