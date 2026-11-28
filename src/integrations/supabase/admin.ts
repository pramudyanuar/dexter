import { createClient } from '@supabase/supabase-js';
import 'server-only';

export function getSupabaseAdmin() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('Supabase URL is missing');

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  });
}
