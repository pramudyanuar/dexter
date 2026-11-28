import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

import { getSupabasePublicConfig } from '@/integrations/supabase/config';

export async function proxy(request: NextRequest) {
  const supabaseConfig = getSupabasePublicConfig();
  if (!supabaseConfig) return NextResponse.next();

  const responseHeaders = new Headers();
  const responseCookies: Parameters<SetAllCookies>[0] = [];
  const supabase = createServerClient(supabaseConfig.url, supabaseConfig.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet)
          request.cookies.set(name, value);
        responseCookies.push(...cookiesToSet);
        for (const [name, value] of Object.entries(headers)) {
          responseHeaders.set(name, value);
        }
      },
    },
  });

  await supabase.auth.getClaims();
  if (!responseCookies.length) return NextResponse.next();

  const response = NextResponse.next({ request, headers: responseHeaders });
  for (const { name, value, options } of responseCookies) {
    response.cookies.set(name, value, options);
  }
  return response;
}

export const config = {
  matcher: ['/((?!api/|v1/|_next/|.*\\.[^/]+$).*)'],
};
