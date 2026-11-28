import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import 'server-only';

import { getSupabasePublicConfig } from '@/integrations/supabase/config';

export async function createClient() {
  const config = getSupabasePublicConfig();
  if (!config) throw new Error('Supabase public configuration is missing');
  const cookieStore = await cookies();

  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. Proxy handles refreshes.
        }
      },
    },
  });
}
