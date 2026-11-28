import { createBrowserClient } from '@supabase/ssr';

import { getSupabasePublicConfig } from '@/integrations/supabase/config';

export function createClient() {
  const config = getSupabasePublicConfig();
  if (!config) throw new Error('Supabase public configuration is missing');
  return createBrowserClient(config.url, config.key);
}
