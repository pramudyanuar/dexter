import type {
  BugReportAction,
  BugReportTarget,
} from '@/features/game-bugs/types';
import {
  BUG_DRAFT_TTL,
  BUG_REPORT_KEEP,
  type BugReport,
  type BugSnapshot,
} from '@/features/rooms/bug-reports';
import {
  CHAT_KEEP,
  ChatMsg,
  Room,
  Signal,
  SIGNAL_KEEP,
} from '@/features/rooms/types';
import {
  getSupabaseState,
  type SupabaseState,
} from '@/integrations/supabase/state';

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

const roomKey = (code: string) => `room:${code}`;
const chatKey = (code: string) => `chat:${code}`;
const signalKey = (code: string) => `signal:${code}`;
const draftKey = (key: string) => `draft:${key}`;
const inbox = 'reports';
const roomExpiry = () => Date.now() + TTL_SECONDS * 1000;

class SupabaseRoomStore implements RoomStore {
  constructor(private readonly state: SupabaseState) {}

  get(code: string) {
    return this.state.get<Room>(roomKey(code));
  }

  create(room: Room) {
    const key = roomKey(room.code);
    return this.state.transact([key], async (tx) => {
      if (await tx.read<Room>(key)) return false;
      tx.set(key, room, roomExpiry());
      return true;
    });
  }

  save(room: Room) {
    return this.state.set(roomKey(room.code), room, roomExpiry());
  }

  saveIf(room: Room, expectedVersion: number) {
    const key = roomKey(room.code);
    return this.state.transact([key], async (tx) => {
      const current = await tx.read<Room>(key);
      if (current?.value.version !== expectedVersion) return false;
      tx.set(key, room, roomExpiry());
      return true;
    });
  }

  private async append<T>(key: string, value: T, keep: number) {
    await this.state.transact([key], async (tx) => {
      const previous = (await tx.read<T[]>(key))?.value ?? [];
      tx.set(key, [...previous, value].slice(-keep), roomExpiry());
    });
  }

  async chatList(code: string) {
    return (await this.state.get<ChatMsg[]>(chatKey(code))) ?? [];
  }

  chatAdd(code: string, message: ChatMsg) {
    return this.append(chatKey(code), message, CHAT_KEEP);
  }

  async signalList(code: string) {
    return (await this.state.get<Signal[]>(signalKey(code))) ?? [];
  }

  signalAdd(code: string, signal: Signal) {
    return this.append(signalKey(code), signal, SIGNAL_KEEP);
  }

  saveBugDraft(key: string, snapshot: BugSnapshot) {
    return this.state.set(
      draftKey(key),
      snapshot,
      Date.now() + BUG_DRAFT_TTL * 1000,
    );
  }

  getBugDraft(key: string) {
    return this.state.get<BugSnapshot | 'submitted'>(draftKey(key));
  }

  submitBugReport(id: string, report: BugReport) {
    const key = draftKey(id);
    return this.state.transact([key, inbox], async (tx) => {
      const draft = await tx.read<BugSnapshot | 'submitted'>(key);
      if (!draft) return false;
      if (draft.value === 'submitted') return true;
      const reports = (await tx.read<BugReport[]>(inbox))?.value ?? [];
      tx.set(inbox, [report, ...reports].slice(0, BUG_REPORT_KEEP));
      tx.set(key, 'submitted', draft.expiresAt);
      return true;
    });
  }

  async listBugReports() {
    return (await this.state.get<BugReport[]>(inbox)) ?? [];
  }

  changeBugReport({ id, at }: BugReportTarget, action: BugReportAction) {
    return this.state.transact([inbox], async (tx) => {
      const reports = (await tx.read<BugReport[]>(inbox))?.value ?? [];
      const index = reports.findIndex(
        (report) => report.id === id && report.submittedAt === at,
      );
      if (index < 0) return false;
      if (action === 'delete') reports.splice(index, 1);
      else if (action === 'done') reports[index].done = true;
      else delete reports[index].done;
      tx.set(inbox, reports);
      return true;
    });
  }

  async listCodes() {
    return (await this.state.keys('room:')).map((key) => key.slice(5));
  }

  delete(code: string) {
    const keys = [roomKey(code), chatKey(code), signalKey(code)];
    return this.state.transact(keys, (tx) => {
      for (const key of keys) tx.delete(key);
    });
  }
}

/** In-process storage for local development. */
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

export function getRoomStore(): RoomStore | null {
  const state = getSupabaseState('rooms');
  if (state) return new SupabaseRoomStore(state);
  return process.env.NODE_ENV === 'production' ? null : new MemoryStore();
}
