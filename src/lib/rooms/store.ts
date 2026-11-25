import type { BugReportAction, BugReportTarget } from '@/lib/game-bugs/types';
import {
  BUG_DRAFT_TTL,
  BUG_REPORT_KEEP,
  type BugReport,
  type BugSnapshot,
} from '@/lib/rooms/bug-reports';
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
  saveBugDraft(key: string, snapshot: BugSnapshot): Promise<void>;
  getBugDraft(key: string): Promise<BugSnapshot | 'submitted' | null>;
  submitBugReport(key: string, report: BugReport): Promise<boolean>;
  listBugReports(): Promise<BugReport[]>;
  changeBugReport(
    target: BugReportTarget,
    action: BugReportAction,
  ): Promise<boolean>;
  /** Lists all active room codes. */
  listCodes(): Promise<string[]>;
  /** Permanently deletes a room and its associated chat/signal keys. */
  delete(code: string): Promise<void>;
}

const key = (code: string) => `room:${code}`;
const chatKey = (code: string) => `room:${code}:chat`;
const signalKey = (code: string) => `room:${code}:rtc`;
const bugDraftKey = (key: string) => `bug-reports:draft:${key}`;
const bugInboxKey = 'bug-reports:inbox';
const bugDoneKey = 'bug-reports:inbox:done';

const SUBMIT_BUG_REPORT = `
local draft = redis.call('GET', KEYS[1])
if not draft then return 0 end
if draft == 'submitted' then return 1 end
redis.call('LPUSH', KEYS[2], ARGV[1])
local evicted = redis.call('LINDEX', KEYS[2], tonumber(ARGV[2]) + 1)
if evicted then redis.call('HDEL', KEYS[3], cjson.decode(evicted).id) end
redis.call('LTRIM', KEYS[2], 0, ARGV[2])
redis.call('SET', KEYS[1], 'submitted', 'KEEPTTL')
return 1`;

const CHANGE_BUG_REPORT = `
for _, member in ipairs(redis.call('LRANGE', KEYS[1], 0, -1)) do
  local report = cjson.decode(member)
  if report.id == ARGV[1] and report.submittedAt == tonumber(ARGV[2]) then
    if ARGV[3] == 'delete' then redis.call('LREM', KEYS[1], 1, member) end
    if ARGV[3] == 'done' then
      redis.call('HSET', KEYS[2], report.id, '1')
    else
      redis.call('HDEL', KEYS[2], report.id)
    end
    return 1
  end
end
return 0`;

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

  async saveBugDraft(key: string, snapshot: BugSnapshot) {
    await this.command([
      'SET',
      bugDraftKey(key),
      JSON.stringify(snapshot),
      'EX',
      BUG_DRAFT_TTL,
    ]);
  }

  async getBugDraft(key: string) {
    const raw = await this.command(['GET', bugDraftKey(key)]);
    if (raw === 'submitted') return 'submitted' as const;
    return raw ? (JSON.parse(raw) as BugSnapshot) : null;
  }

  async submitBugReport(key: string, report: BugReport) {
    const result = await this.command([
      'EVAL',
      SUBMIT_BUG_REPORT,
      3,
      bugDraftKey(key),
      bugInboxKey,
      bugDoneKey,
      JSON.stringify(report),
      BUG_REPORT_KEEP - 1,
    ]);
    return result === 1;
  }

  async listBugReports() {
    const lines = (await this.command([
      'LRANGE',
      bugInboxKey,
      0,
      BUG_REPORT_KEEP - 1,
    ])) as string[] | null;
    const reports = (lines ?? []).map((line) => JSON.parse(line) as BugReport);
    if (!reports.length) return reports;
    const done = (await this.command([
      'HMGET',
      bugDoneKey,
      ...reports.map(({ id }) => id),
    ])) as (string | null)[];
    return reports.map((report, index) =>
      done[index] === '1' ? { ...report, done: true } : report,
    );
  }

  async changeBugReport({ id, at }: BugReportTarget, action: BugReportAction) {
    const result = await this.command([
      'EVAL',
      CHANGE_BUG_REPORT,
      2,
      bugInboxKey,
      bugDoneKey,
      id,
      at,
      action,
    ]);
    return result === 1;
  }

  async listCodes(): Promise<string[]> {
    const codes = new Set<string>();
    let cursor = '0';
    for (let i = 0; i < 50; i++) {
      const res = (await this.command([
        'SCAN',
        cursor,
        'MATCH',
        'room:*',
        'COUNT',
        100,
      ])) as [string, string[]] | null;
      if (!res) break;
      const [nextCursor, keys] = res;
      for (const k of keys ?? []) {
        if (k.startsWith('room:') && !k.includes(':', 5)) {
          codes.add(k.slice(5));
        }
      }
      cursor = nextCursor;
      if (cursor === '0') break;
    }
    return Array.from(codes);
  }

  async delete(code: string): Promise<void> {
    await this.command(['DEL', key(code), chatKey(code), signalKey(code)]);
  }
}

/** Development only: lives in this process, which is why production needs Redis. */
class MemoryStore implements RoomStore {
  private rooms: Map<string, { room: Room; expires: number }>;
  private chats: Map<string, { lines: ChatMsg[]; expires: number }>;
  private signals: Map<string, { lines: Signal[]; expires: number }>;
  private bugDrafts: Map<
    string,
    { snapshot: BugSnapshot | 'submitted'; expires: number }
  >;
  private bugReports: BugReport[];

  constructor() {
    // survive hot reloads in dev
    const g = globalThis as unknown as {
      __rooms?: MemoryStore['rooms'];
      __chats?: MemoryStore['chats'];
      __signals?: MemoryStore['signals'];
      __bugDrafts?: MemoryStore['bugDrafts'];
      __bugReports?: MemoryStore['bugReports'];
    };
    this.rooms = g.__rooms ??= new Map();
    this.chats = g.__chats ??= new Map();
    this.signals = g.__signals ??= new Map();
    this.bugDrafts = g.__bugDrafts ??= new Map();
    this.bugReports = g.__bugReports ??= [];
  }

  async saveIf(room: Room, expectedVersion: number) {
    const current = this.read(room.code);
    if (!current || current.version !== expectedVersion) return false;
    this.write(room);
    return true;
  }

  async chatList(code: string) {
    const entry = this.chats.get(code);
    if (!entry || entry.expires < Date.now()) return [];
    return structuredClone(entry.lines);
  }

  async chatAdd(code: string, message: ChatMsg) {
    const current = this.chats.get(code);
    const previous =
      current && current.expires >= Date.now() ? current.lines : [];
    const lines = [...previous, message].slice(-CHAT_KEEP);
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
    const current = this.signals.get(code);
    const previous =
      current && current.expires >= Date.now() ? current.lines : [];
    const lines = [...previous, signal].slice(-SIGNAL_KEEP);
    this.signals.set(code, {
      lines,
      expires: Date.now() + TTL_SECONDS * 1000,
    });
  }

  async saveBugDraft(key: string, snapshot: BugSnapshot) {
    const now = Date.now();
    for (const [id, draft] of this.bugDrafts) {
      if (draft.expires <= now) this.bugDrafts.delete(id);
    }
    this.bugDrafts.set(key, {
      snapshot: structuredClone(snapshot),
      expires: now + BUG_DRAFT_TTL * 1000,
    });
  }

  async getBugDraft(key: string) {
    const draft = this.bugDrafts.get(key);
    return draft && draft.expires > Date.now()
      ? structuredClone(draft.snapshot)
      : null;
  }

  async submitBugReport(key: string, report: BugReport) {
    const draft = this.bugDrafts.get(key);
    if (!draft || draft.expires <= Date.now()) return false;
    if (draft.snapshot === 'submitted') return true;
    this.bugReports.unshift(structuredClone(report));
    this.bugReports.length = Math.min(this.bugReports.length, BUG_REPORT_KEEP);
    draft.snapshot = 'submitted';
    return true;
  }

  async listBugReports() {
    return structuredClone(this.bugReports);
  }

  async changeBugReport({ id, at }: BugReportTarget, action: BugReportAction) {
    const index = this.bugReports.findIndex(
      (report) => report.id === id && report.submittedAt === at,
    );
    if (index < 0) return false;
    if (action === 'delete') this.bugReports.splice(index, 1);
    else if (action === 'done') this.bugReports[index].done = true;
    else delete this.bugReports[index].done;
    return true;
  }

  private read(code: string) {
    const entry = this.rooms.get(code);
    if (!entry) return null;
    if (entry.expires < Date.now()) {
      this.rooms.delete(code);
      return null;
    }
    return entry.room;
  }

  async get(code: string) {
    const room = this.read(code);
    return room ? structuredClone(room) : null;
  }

  async create(room: Room) {
    if (this.read(room.code)) return false;
    this.write(room);
    return true;
  }

  async save(room: Room) {
    this.write(room);
  }

  private write(room: Room) {
    this.rooms.set(room.code, {
      room: structuredClone(room),
      expires: Date.now() + TTL_SECONDS * 1000,
    });
  }

  async listCodes(): Promise<string[]> {
    const now = Date.now();
    const codes: string[] = [];
    for (const [code, entry] of this.rooms.entries()) {
      if (entry.expires < now) {
        this.rooms.delete(code);
      } else {
        codes.push(code);
      }
    }
    return codes;
  }

  async delete(code: string): Promise<void> {
    this.rooms.delete(code);
    this.chats.delete(code);
    this.signals.delete(code);
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
