import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  '';

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  '';

if (!url) {
  throw new Error(
    'Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL). Set it in Vercel Environment Variables.'
  );
}

if (!serviceRoleKey) {
  throw new Error(
    'Missing SUPABASE_SERVICE_ROLE_KEY. Set the Supabase Service Role key (sb_secret_*) in Vercel.'
  );
}

/**
 * Admin (service-role) client.
 * - Server-only to avoid accidental client bundling.
 * - persistSession disabled (server context).
 */
export const supabaseAdmin: SupabaseClient = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
});

/**
 * Backwards-compatible helper for routes importing { getSupabaseAdmin }.
 */
export function getSupabaseAdmin(): SupabaseClient {
  return supabaseAdmin;
}
