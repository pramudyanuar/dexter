import {
  CHAT_KEEP,
  ChatMsg,
  Room,
  Signal,
  SIGNAL_KEEP,
} from '@/lib/rooms/types';

const TTL_SECONDS = 2 * 60 * 60;

export interface RoomStore {
  get(code: string): Promise<Room | null>;
  /** Stores a new room. False if the code is already taken. */
  create(room: Room): Promise<boolean>;
  save(room: Room): Promise<void>;
  /**
   * Saves only if the stored room is still at `expectedVersion`, so a change
   * made from a stale copy cannot overwrite a newer one. False if it moved on.
   */
  saveIf(room: Room, expectedVersion: number): Promise<boolean>;
  /** The kept chat lines, oldest first */
  chatList(code: string): Promise<ChatMsg[]>;
  chatAdd(code: string, message: ChatMsg): Promise<void>;
  /** Call set-up messages between seats, oldest first (short-lived) */
  signalList(code: string): Promise<Signal[]>;
  signalAdd(code: string, signal: Signal): Promise<void>;
}

const key = (code: string) => `room:${code}`;
const chatKey = (code: string) => `room:${code}:chat`;
const signalKey = (code: string) => `room:${code}:rtc`;

/** Compare-and-set done atomically in Redis (Lua): only overwrite the version we read. */
const SAVE_IF = `
local cur = redis.call('GET', KEYS[1])
if not cur then return 0 end
if cjson.decode(cur).version ~= tonumber(ARGV[2]) then return 0 end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[3])
return 1`;

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

  async saveIf(room: Room, expectedVersion: number) {
    const result = await this.command([
      'EVAL',
      SAVE_IF,
      1,
      key(room.code),
      JSON.stringify(room),
      expectedVersion,
      TTL_SECONDS,
    ]);
    return result === 1;
  }

  async chatList(code: string) {
    const raw = (await this.command(['LRANGE', chatKey(code), 0, -1])) as
      string[] | null;
    return (raw ?? []).flatMap((line) => {
      try {
        return [JSON.parse(line) as ChatMsg];
      } catch {
        return [];
      }
    });
  }

  async chatAdd(code: string, message: ChatMsg) {
    await this.command(['RPUSH', chatKey(code), JSON.stringify(message)]);
    await this.command(['LTRIM', chatKey(code), -CHAT_KEEP, -1]);
    await this.command(['EXPIRE', chatKey(code), TTL_SECONDS]);
  }

  async signalList(code: string) {
    const raw = (await this.command(['LRANGE', signalKey(code), 0, -1])) as
      string[] | null;
    return (raw ?? []).flatMap((line) => {
      try {
        return [JSON.parse(line) as Signal];
      } catch {
        return [];
      }
    });
  }

  async signalAdd(code: string, signal: Signal) {
    await this.command(['RPUSH', signalKey(code), JSON.stringify(signal)]);
    await this.command(['LTRIM', signalKey(code), -SIGNAL_KEEP, -1]);
    await this.command(['EXPIRE', signalKey(code), TTL_SECONDS]);
  }
}

/** Development only: lives in this process, which is why production needs Redis. */
class MemoryStore implements RoomStore {
  private rooms: Map<string, { room: Room; expires: number }>;
  private chats: Map<string, { lines: ChatMsg[]; expires: number }>;
  private signals: Map<string, { lines: Signal[]; expires: number }>;

  constructor() {
    // survive hot reloads in dev
    const g = globalThis as unknown as {
      __rooms?: MemoryStore['rooms'];
      __chats?: MemoryStore['chats'];
      __signals?: MemoryStore['signals'];
    };
    this.rooms = g.__rooms ??= new Map();
    this.chats = g.__chats ??= new Map();
    this.signals = g.__signals ??= new Map();
  }

  async saveIf(room: Room, expectedVersion: number) {
    const current = await this.get(room.code);
    if (!current || current.version !== expectedVersion) return false;
    await this.save(room);
    return true;
  }

  async chatList(code: string) {
    const entry = this.chats.get(code);
    if (!entry || entry.expires < Date.now()) return [];
    return structuredClone(entry.lines);
  }

  async chatAdd(code: string, message: ChatMsg) {
    const lines = [...(await this.chatList(code)), message].slice(-CHAT_KEEP);
    this.chats.set(code, {
      lines,
      expires: Date.now() + TTL_SECONDS * 1000,
    });
  }

  async signalList(code: string) {
    const entry = this.signals.get(code);
    if (!entry || entry.expires < Date.now()) return [];
    return structuredClone(entry.lines);
  }

  async signalAdd(code: string, signal: Signal) {
    const lines = [...(await this.signalList(code)), signal].slice(
      -SIGNAL_KEEP,
    );
    this.signals.set(code, {
      lines,
      expires: Date.now() + TTL_SECONDS * 1000,
    });
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
