import { Room } from '@/lib/rooms/types';

const TTL_SECONDS = 2 * 60 * 60;

export interface RoomStore {
  get(code: string): Promise<Room | null>;
  /** Stores a new room. False if the code is already taken. */
  create(room: Room): Promise<boolean>;
  save(room: Room): Promise<void>;
}

const key = (code: string) => `room:${code}`;

/** Upstash Redis over plain HTTPS, so it works anywhere the site does. */
class RedisStore implements RoomStore {
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

  async get(code: string) {
    const raw = await this.command(['GET', key(code)]);
    return raw ? (JSON.parse(raw) as Room) : null;
  }

  async create(room: Room) {
    const result = await this.command([
      'SET',
      key(room.code),
      JSON.stringify(room),
      'NX',
      'EX',
      TTL_SECONDS,
    ]);
    return result === 'OK';
  }

  async save(room: Room) {
    await this.command([
      'SET',
      key(room.code),
      JSON.stringify(room),
      'EX',
      TTL_SECONDS,
    ]);
  }
}

/** Development only: lives in this process, which is why production needs Redis. */
class MemoryStore implements RoomStore {
  private rooms: Map<string, { room: Room; expires: number }>;

  constructor() {
    // survive hot reloads in dev
    const g = globalThis as unknown as { __rooms?: MemoryStore['rooms'] };
    this.rooms = g.__rooms ??= new Map();
  }

  async get(code: string) {
    const entry = this.rooms.get(code);
    if (!entry) return null;
    if (entry.expires < Date.now()) {
      this.rooms.delete(code);
      return null;
    }
    return structuredClone(entry.room);
  }

  async create(room: Room) {
    if (await this.get(room.code)) return false;
    await this.save(room);
    return true;
  }

  async save(room: Room) {
    this.rooms.set(room.code, {
      room: structuredClone(room),
      expires: Date.now() + TTL_SECONDS * 1000,
    });
  }
}

/**
 * Upstash Redis when configured (env names from the Vercel integration or from
 * Upstash itself), an in-process map in development, otherwise nothing.
 */
export function getRoomStore(): RoomStore | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (url && token) return new RedisStore(url, token);
  return process.env.NODE_ENV === 'production' ? null : new MemoryStore();
}
