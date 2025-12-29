import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _admin: SupabaseClient | null = null;

function mustEnv(name: string, v?: string) {
  const val = (v || '').trim();
  if (!val) throw new Error(`Missing env var: ${name}`);
  return val;
}

export function getSupabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;

  const url = mustEnv(
    'SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)',
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  );

  const key = mustEnv('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY);

  _admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  return _admin;
}

// ✅ Esto es lo que te falta y lo que arregla el build de /api/leads
export const supabaseAdmin = getSupabaseAdmin();
