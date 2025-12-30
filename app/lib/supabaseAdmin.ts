import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _admin: SupabaseClient | null = null;

function pickEnv(...names: string[]) {
  for (const n of names) {
    const v = process.env[n];
    if (v && v.trim()) return v.trim();
  }
  return '';
}

export function getSupabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;

  const url = pickEnv('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
  const key = pickEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!url) throw new Error('Missing env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)');
  if (!key) throw new Error('Missing env: SUPABASE_SERVICE_ROLE_KEY');

  _admin = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return _admin;
}

// Compatibilidad por si algún route aún hace: import { supabaseAdmin } ...
export const supabaseAdmin = getSupabaseAdmin();
