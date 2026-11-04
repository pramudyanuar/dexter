import { randomBytes } from 'node:crypto';

import { rewriteCss, rewriteHtml } from '@/lib/proxy/rewrite';
import { fetchPublic, ProxyError } from '@/lib/proxy/safe-fetch';
import { createProxyToken, isProxyToken } from '@/lib/session';

const RESERVED_PARAMS = new Set(['url', 't', '__form', '__unsupported']);

/** Everything we serve is locked down, whatever the remote page contains. */
function securityHeaders(
  contentSecurityPolicy: string,
): Record<string, string> {
  return {
    'Content-Security-Policy': contentSecurityPolicy,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'private, max-age=300',
  };
}

const LOCKED_DOWN = "default-src 'none'; sandbox";

function errorPage(message: string, status: number) {
  const safe = message.replace(/[<>&"]/g, (c) => `&#${c.charCodeAt(0)};`);
  return new Response(
    `<!doctype html><meta charset="utf-8"><body style="font:14px ui-monospace,monospace;padding:1.5rem;color:#b00"><p>${safe}</p>`,
    {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        ...securityHeaders(`${LOCKED_DOWN}; style-src 'unsafe-inline'`),
        'Cache-Control': 'no-store',
      },
    },
  );
}

function decode(body: Buffer, contentType: string): string {
  const label =
    /charset=["']?([\w-]+)/i.exec(contentType)?.[1] ??
    /<meta[^>]+charset=["']?([\w-]+)/i.exec(
      body.subarray(0, 2048).toString('latin1'),
    )?.[1] ??
    'utf-8';
  try {
    return new TextDecoder(label).decode(body);
  } catch {
    return new TextDecoder('utf-8').decode(body);
  }
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  // POST forms are refused up front: they carry no token, and the real
  // reason is more useful than "session expired"
  if (params.has('__unsupported')) {
    return errorPage('Form dengan metode POST tidak didukung di proxy.', 400);
  }

  const token = params.get('t') ?? '';
  if (!isProxyToken(token)) {
    return errorPage('Sesi proxy habis. Buka lagi dari halaman /browse.', 401);
  }

  try {
    let target = params.get('url');
    if (!target) throw new ProxyError('Parameter url kosong');

    // a GET form submits its fields here, so put them back on the real URL
    if (params.has('__form')) {
      const url = new URL(target);
      for (const key of new Set(params.keys())) {
        if (RESERVED_PARAMS.has(key)) continue;
        url.searchParams.delete(key);
        for (const value of params.getAll(key)) {
          url.searchParams.append(key, value);
        }
      }
      target = url.href;
    }

    const page = await fetchPublic(target, {
      accept: req.headers.get('accept') ?? undefined,
      acceptLanguage: req.headers.get('accept-language') ?? undefined,
    });

    const contentType = String(page.headers['content-type'] ?? '');
    const mime = contentType.split(';')[0].trim().toLowerCase();
    // each page gets a fresh token, so browsing keeps working past one hour
    const nextToken = createProxyToken() ?? token;
    const ctx = { base: page.url.href, token: nextToken };

    if (mime === 'text/html' || mime === 'application/xhtml+xml') {
      const nonce = randomBytes(16).toString('base64');
      const html = rewriteHtml(decode(page.body, contentType), {
        ...ctx,
        nonce,
      });
      return new Response(html, {
        status: page.status,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          ...securityHeaders(
            [
              "default-src 'none'",
              `script-src 'nonce-${nonce}'`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data:",
              "font-src 'self' data:",
              "media-src 'self'",
              "form-action 'self'",
              "frame-ancestors 'self'",
              "base-uri 'none'",
              'sandbox allow-scripts allow-forms',
            ].join('; '),
          ),
          'Cache-Control': 'no-store',
        },
      });
    }

    if (mime === 'text/css') {
      return new Response(rewriteCss(decode(page.body, contentType), ctx), {
        status: page.status,
        headers: {
          'Content-Type': 'text/css; charset=utf-8',
          ...securityHeaders(LOCKED_DOWN),
        },
      });
    }

    // scripts never run in the proxy, so do not spend bandwidth on them
    if (/javascript|ecmascript|json-p/.test(mime)) {
      return new Response(null, { status: 204 });
    }

    return new Response(new Uint8Array(page.body), {
      status: page.status,
      headers: {
        'Content-Type': mime || 'application/octet-stream',
        ...securityHeaders(LOCKED_DOWN),
      },
    });
  } catch (err) {
    if (err instanceof ProxyError) return errorPage(err.message, err.status);
    return errorPage('Terjadi kesalahan di proxy', 500);
  }
}
