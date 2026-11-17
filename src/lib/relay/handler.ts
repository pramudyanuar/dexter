import { createHash, timingSafeEqual } from 'node:crypto';

const ROUTES = new Map<string, readonly string[]>([
  ['/v1/models', ['GET', 'HEAD']],
  ['/v1/chat/completions', ['POST']],
  ['/v1/completions', ['POST']],
  ['/v1/responses', ['POST']],
  ['/v1/messages', ['POST']],
  ['/v1/messages/count_tokens', ['POST']],
  ['/v1/embeddings', ['POST']],
]);

const HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-length',
]);

function jsonError(
  message: string,
  status: number,
  extraHeaders: Record<string, string> = {},
): Response {
  return Response.json(
    { error: { message, type: 'relay_error' } },
    {
      status,
      headers: {
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        ...extraHeaders,
      },
    },
  );
}

function validSecret(
  actual: string | null | undefined,
  expected: string,
): boolean {
  if (!actual || !expected) return false;
  const hash = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(actual), hash(expected));
}

function readConfiguration(env: Record<string, string | undefined>) {
  if (
    !env.RELAY_API_KEY ||
    env.RELAY_API_KEY.length < 32 ||
    !env.UPSTREAM_API_KEY
  ) {
    throw new Error('Relay credentials are not configured.');
  }
  if (!env.UPSTREAM_ORIGIN) {
    throw new Error('UPSTREAM_ORIGIN is not configured.');
  }
  const origin = new URL(env.UPSTREAM_ORIGIN);
  if (
    origin.protocol !== 'https:' ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash
  ) {
    throw new Error('UPSTREAM_ORIGIN must be an HTTPS origin without a path.');
  }
  return {
    origin: origin.origin,
    key: env.UPSTREAM_API_KEY,
    secret: env.RELAY_API_KEY,
  };
}

function routeMethods(pathname: string): readonly string[] | null {
  const direct = ROUTES.get(pathname);
  if (direct) return direct;
  if (/^\/v1\/responses\/[A-Za-z0-9_-]+$/.test(pathname))
    return ['GET', 'DELETE'];
  if (/^\/v1\/responses\/[A-Za-z0-9_-]+\/cancel$/.test(pathname))
    return ['POST'];
  return null;
}

function connectionHeaders(headers: Headers): Set<string> {
  return new Set(
    (headers.get('connection') || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

function upstreamHeaders(incoming: Headers, key: string): Headers {
  const headers = new Headers();
  const connection = connectionHeaders(incoming);
  incoming.forEach((value, rawName) => {
    const name = rawName.toLowerCase();
    if (
      HOP_HEADERS.has(name) ||
      connection.has(name) ||
      /^(x-forwarded-|x-vercel-|x-relay-|cf-|proxy-)/.test(name) ||
      [
        'authorization',
        'x-api-key',
        'cookie',
        'host',
        'origin',
        'referer',
        'accept-encoding',
        'forwarded',
        'x-real-ip',
        'x-9r-real-ip',
      ].includes(name)
    ) {
      return;
    }
    headers.set(name, value);
  });
  headers.set('authorization', `Bearer ${key}`);
  return headers;
}

function downstreamHeaders(upstream: Headers): Headers {
  const headers = new Headers();
  const connection = connectionHeaders(upstream);
  upstream.forEach((value, rawName) => {
    const name = rawName.toLowerCase();
    if (
      HOP_HEADERS.has(name) ||
      connection.has(name) ||
      ['set-cookie', 'content-encoding', 'location'].includes(name)
    ) {
      return;
    }
    headers.set(name, value);
  });
  headers.set('cache-control', 'no-store, no-transform');
  headers.set('x-accel-buffering', 'no');
  headers.set('x-content-type-options', 'nosniff');
  return headers;
}

export interface RelayOptions {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Fixed-origin, authenticated HTTP relay for OpenAI / Anthropic / 9Router
 * compatible `/v1/...` endpoints. Request and response bodies stay opaque.
 */
export function createRelay({
  env = process.env,
  fetchImpl = fetch,
  timeoutMs = 285_000,
}: RelayOptions = {}) {
  return async function relay(request: Request): Promise<Response> {
    const url = new URL(request.url);
    let config: { origin: string; key: string; secret: string };
    try {
      config = readConfiguration(env);
    } catch {
      return jsonError('Relay is not configured.', 503);
    }

    const bearer = request.headers
      .get('authorization')
      ?.match(/^Bearer\s+(\S+)$/i)?.[1];
    const apiKey = request.headers.get('x-api-key');
    if (!validSecret(bearer || apiKey, config.secret)) {
      return jsonError('Invalid or missing relay API key.', 401, {
        'www-authenticate': 'Bearer realm="dexter-relay"',
      });
    }

    const methods = routeMethods(url.pathname);
    if (!methods) {
      return jsonError('Endpoint not available through this relay.', 404);
    }
    if (!methods.includes(request.method)) {
      return jsonError('Method not allowed.', 405, {
        allow: methods.join(', '),
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    request.signal?.addEventListener('abort', onAbort, { once: true });

    try {
      const target = new URL(url.pathname + url.search, config.origin);
      const init: RequestInit & { duplex?: 'half' } = {
        method: request.method,
        headers: upstreamHeaders(request.headers, config.key),
        redirect: 'manual',
        signal: controller.signal,
      };
      if (
        request.method !== 'GET' &&
        request.method !== 'HEAD' &&
        request.body
      ) {
        init.body = request.body;
        init.duplex = 'half';
      }

      const upstream = await fetchImpl(target, init);
      return new Response(request.method === 'HEAD' ? null : upstream.body, {
        status: upstream.status,
        headers: downstreamHeaders(upstream.headers),
      });
    } catch (err) {
      const aborted =
        err instanceof Error &&
        (err.name === 'AbortError' || err.name === 'TimeoutError');
      return jsonError(
        aborted ? 'Upstream request timed out.' : 'Upstream relay error.',
        aborted ? 504 : 502,
      );
    } finally {
      clearTimeout(timeout);
      request.signal?.removeEventListener('abort', onAbort);
    }
  };
}
