export async function callRoom(
  path: string,
  options: {
    body?: unknown;
    token?: string;
    signal?: AbortSignal;
    method?: 'GET' | 'POST' | 'DELETE';
    headers?: Record<string, string>;
  } = {},
) {
  const hasBody = options.body !== undefined;
  const res = await fetch(path, {
    method: options.method ?? (hasBody ? 'POST' : 'GET'),
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      // The token stays out of URLs and logs.
      ...(options.token ? { 'x-player-token': options.token } : {}),
      ...options.headers,
    },
    body: hasBody ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
    ...(options.signal ? { signal: options.signal } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(data.error ?? `HTTP ${res.status}`), {
      status: res.status,
    });
  }
  return data;
}
