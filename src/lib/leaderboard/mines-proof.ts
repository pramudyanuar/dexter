import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

import { getRedisConfig } from '@/lib/upstash';

const round = z.object({
  id: z.uuid(),
  level: z.enum(['mudah', 'sedang', 'sulit']),
  seed: z.int().min(0).max(0xffffffff),
  startedAt: z.int().nonnegative(),
});
const result = round.extend({ score: z.int().positive() });

function secret() {
  const redis = getRedisConfig();
  if (redis) return redis.token;
  const global = globalThis as typeof globalThis & { minesProofKey?: Buffer };
  return (global.minesProofKey ??= randomBytes(32));
}

function signature(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest();
}

export function signMinesProof(
  value: z.infer<typeof round> | z.infer<typeof result>,
) {
  const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${payload}.${signature(payload).toString('base64url')}`;
}

function read(token: string): unknown {
  const [payload, mac, extra] = token.split('.');
  if (!payload || !mac || extra !== undefined) return null;
  const actual = Buffer.from(mac, 'base64url');
  const expected = signature(payload);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export function readMinesRound(token: unknown) {
  if (typeof token !== 'string' || token.length > 512) return null;
  const value = read(token);
  if (result.safeParse(value).success) return null;
  const parsed = round.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function readMinesResult(token: unknown) {
  if (typeof token !== 'string' || token.length > 512) return null;
  const parsed = result.safeParse(read(token));
  return parsed.success ? parsed.data : null;
}
