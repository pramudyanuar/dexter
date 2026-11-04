import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import zlib from 'node:zlib';

/**
 * Fetches public web pages on behalf of the user. This must never reach the
 * server's own network (localhost, cloud metadata, private ranges), so every
 * address is checked when the connection is made, which also stops DNS
 * rebinding.
 */

export const MAX_BYTES = 4_000_000; // Vercel caps function responses at 4.5 MB
const TIMEOUT_MS = 9_000;
const MAX_REDIRECTS = 5;
const ALLOWED_PORTS = new Set(['', '80', '443', '8080', '8443']);

export class ProxyError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

function isPrivateIPv4(ip: string): boolean {
  const [a, b, c] = ip.split('.').map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // multicast, reserved, broadcast
  );
}

export function isPrivateAddress(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, '').toLowerCase();

  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (!net.isIPv6(ip)) return true; // not an address we understand: refuse

  if (ip === '::' || ip === '::1') return true;

  // IPv4-mapped (::ffff:1.2.3.4 or ::ffff:7f00:1)
  const mapped = ip.match(/^::ffff:(.+)$/);
  if (mapped) {
    if (mapped[1].includes('.')) return isPrivateAddress(mapped[1]);
    const groups = mapped[1].split(':').map((g) => parseInt(g, 16));
    if (groups.length === 2 && groups.every((g) => !Number.isNaN(g))) {
      const [hi, lo] = groups;
      return isPrivateIPv4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    return true;
  }

  return (
    /^f[cd]/.test(ip) || // unique local fc00::/7
    /^fe[89ab]/.test(ip) || // link-local fe80::/10
    ip.startsWith('ff') || // multicast
    ip.startsWith('64:ff9b:') || // NAT64
    ip.startsWith('2001:db8') // documentation
  );
}

/** Throws ProxyError unless `raw` is a plain http(s) URL to a public host. */
export function assertPublicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ProxyError('URL tidak valid');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ProxyError('Hanya http dan https yang didukung');
  }
  if (url.username || url.password) {
    throw new ProxyError('URL dengan user:password tidak didukung');
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    throw new ProxyError(`Port ${url.port} tidak diizinkan`);
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (!host) throw new ProxyError('URL tidak valid');
  // IP literals never go through DNS lookup, so check them here
  if (net.isIP(host) && isPrivateAddress(host)) {
    throw new ProxyError('Alamat itu tidak diizinkan', 403);
  }
  return url;
}

/** DNS lookup that refuses to resolve to a private address. */
const safeLookup = ((
  hostname: string,
  options: dns.LookupOptions,
  callback: (...args: unknown[]) => void,
) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);
    const list = addresses as dns.LookupAddress[];
    if (!list.length || list.some((a) => isPrivateAddress(a.address))) {
      return callback(new ProxyError('Alamat itu tidak diizinkan', 403));
    }
    if (options.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
}) as unknown as net.LookupFunction;

export interface FetchedPage {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
  /** Final URL after redirects, the base for relative links */
  url: URL;
}

function request(url: URL, headers: http.OutgoingHttpHeaders) {
  return new Promise<http.IncomingMessage>((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(
      url,
      { method: 'GET', headers, lookup: safeLookup, timeout: TIMEOUT_MS },
      resolve,
    );
    req.on('timeout', () => req.destroy(new ProxyError('Waktu habis', 504)));
    req.on('error', (err) =>
      reject(
        err instanceof ProxyError
          ? err
          : new ProxyError(`Gagal terhubung: ${err.message}`, 502),
      ),
    );
    req.end();
  });
}

function readBody(res: http.IncomingMessage) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    res.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BYTES) {
        res.destroy();
        reject(new ProxyError('Respons terlalu besar (maks 4 MB)', 413));
      } else chunks.push(chunk);
    });
    res.on('end', () => resolve(Buffer.concat(chunks)));
    res.on('error', (err) => reject(new ProxyError(err.message, 502)));
  });
}

function decompress(body: Buffer, encoding: string | undefined): Buffer {
  const opts = { maxOutputLength: MAX_BYTES };
  try {
    switch (encoding?.trim().toLowerCase()) {
      case 'gzip':
      case 'x-gzip':
        return zlib.gunzipSync(body, opts);
      case 'br':
        return zlib.brotliDecompressSync(body, opts);
      case 'deflate':
        return zlib.inflateSync(body, opts);
      default:
        return body;
    }
  } catch {
    throw new ProxyError('Respons terkompresi tidak bisa dibaca', 502);
  }
}

export async function fetchPublic(
  start: string,
  clientHeaders: { accept?: string; acceptLanguage?: string } = {},
): Promise<FetchedPage> {
  let url = assertPublicUrl(start);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await request(url, {
      'user-agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      accept: clientHeaders.accept ?? 'text/html,*/*;q=0.8',
      'accept-language': clientHeaders.acceptLanguage ?? 'en-US,en;q=0.8',
      'accept-encoding': 'gzip, br, deflate',
    });

    const status = res.statusCode ?? 502;
    const location = res.headers.location;
    if (status >= 300 && status < 400 && location) {
      res.resume();
      url = assertPublicUrl(new URL(location, url).href);
      continue;
    }

    const raw = await readBody(res);
    return {
      status,
      headers: res.headers,
      body: decompress(raw, res.headers['content-encoding']),
      url,
    };
  }
  throw new ProxyError('Terlalu banyak redirect', 508);
}
