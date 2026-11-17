import { createHash } from 'node:crypto';

import { MAX_MEMOS, PasteMemo } from '@/lib/paste/types';

export interface PasteStore {
  list(code: string): Promise<PasteMemo[]>;
  save(code: string, memos: PasteMemo[]): Promise<void>;
}

function keyFor(code: string): string {
  const hash = createHash('sha256').update(`paste:${code}`).digest('hex');
  return `paste:${hash}`;
}

function pruneExpired(memos: PasteMemo[], now = Date.now()): PasteMemo[] {
  return memos.filter((m) => m.expiresAt > now).slice(0, MAX_MEMOS);
}

class RedisPasteStore implements PasteStore {
  constructor(
    private url: string,
    private token: string,
  ) {}

  private async command(args: (string | number)[]) {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}` },
      body: JSON.stringify(args),
      cache: 'no-store',
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || json?.error) {
      throw new Error(json?.error ?? `Redis HTTP ${res.status}`);
    }
    return json?.result;
  }

  async list(code: string): Promise<PasteMemo[]> {
    const raw = await this.command(['GET', keyFor(code)]);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as PasteMemo[];
      return pruneExpired(Array.isArray(parsed) ? parsed : []);
    } catch {
      return [];
    }
  }

  async save(code: string, memos: PasteMemo[]): Promise<void> {
    const now = Date.now();
    const active = pruneExpired(memos, now);
    const redisKey = keyFor(code);
    if (active.length === 0) {
      await this.command(['DEL', redisKey]);
      return;
    }
    const maxExpiresAt = Math.max(...active.map((m) => m.expiresAt));
    const ttlSeconds = Math.max(60, Math.ceil((maxExpiresAt - now) / 1000));
    await this.command([
      'SET',
      redisKey,
      JSON.stringify(active),
      'EX',
      ttlSeconds,
    ]);
  }
}

class MemoryPasteStore implements PasteStore {
  private rooms: Map<string, PasteMemo[]>;

  constructor() {
    const g = globalThis as unknown as {
      __pasteRooms?: Map<string, PasteMemo[]>;
    };
    this.rooms = g.__pasteRooms ??= new Map();
  }

  async list(code: string): Promise<PasteMemo[]> {
    const active = pruneExpired(this.rooms.get(keyFor(code)) ?? []);
    if (active.length === 0) {
      this.rooms.delete(keyFor(code));
    } else {
      this.rooms.set(keyFor(code), active);
    }
    return active.map((m) => ({ ...m }));
  }

  async save(code: string, memos: PasteMemo[]): Promise<void> {
    const active = pruneExpired(memos);
    if (active.length === 0) {
      this.rooms.delete(keyFor(code));
      return;
    }
    this.rooms.set(
      keyFor(code),
      active.map((m) => ({ ...m })),
    );
  }
}

export function getPasteStore(): PasteStore | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (url && token) return new RedisPasteStore(url, token);
  return process.env.NODE_ENV === 'production' ? null : new MemoryPasteStore();
}
