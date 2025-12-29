import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) {
  throw new Error('Missing SUPABASE_URL environment variable.');
}
if (!key) {
  throw new Error(
    'Missing SUPABASE_SERVICE_ROLE_KEY environment variable. Ensure this is the service role (sb_secret_*) key and NOT the publishable (sb_publishable_*) key.'
  );
}

export const supabaseServer = createClient(url, key, {
  auth: { persistSession: false },
});
