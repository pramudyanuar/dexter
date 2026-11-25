export interface RedisConfig {
  url: string;
  token: string;
}

export type RedisArg = string | number;

export function getRedisConfig(): RedisConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

export async function redisCommand<T>(
  config: RedisConfig,
  command: RedisArg[],
): Promise<T> {
  const res = await fetch(config.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    cache: 'no-store',
    signal: AbortSignal.timeout(4000),
  });
  const data = (await res.json().catch(() => null)) as {
    result?: T;
    error?: string;
  } | null;
  if (!res.ok || !data || !('result' in data) || data.error) {
    throw new Error(`Redis command failed (HTTP ${res.status})`);
  }
  return data.result as T;
}
