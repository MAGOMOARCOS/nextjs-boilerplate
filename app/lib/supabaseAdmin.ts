import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _admin: SupabaseClient | null = null;

function mustEnv(name: string, value: string | undefined): string {
  if (!value || !value.trim()) throw new Error(`Missing env ${name}`);
  return value.trim();
}

export function getSupabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;

  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  const supabaseUrl = mustEnv('SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)', url);
  const supabaseServiceKey = mustEnv('SUPABASE_SERVICE_ROLE_KEY', serviceKey);

  _admin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return _admin;
}
