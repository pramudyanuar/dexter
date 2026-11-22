import { createHash, randomBytes } from 'node:crypto';

import { Pair, pairOf, Seat, SEATS } from '@/lib/games/snake-duel';
import { newCode, newToken } from '@/lib/rooms/codes';
import { createLimiter } from '@/lib/rooms/rate-limit';
import { RoomError } from '@/lib/rooms/types';
import {
  DuelLobbyEntry,
  DuelMove,
  DuelPoll,
  DuelSession,
  DuelTicket,
  MATCHMAKING_MS,
  RECONNECT_MS,
} from '@/lib/snake-duel/protocol';
import {
  absentSince,
  advanceRound,
  beginRound,
  DuelInput,
  DuelPlayer,
  DuelRoom,
  endRound,
  Presence,
  PRESENCE_TIMEOUT_MS,
  roomView,
} from '@/lib/snake-duel/room';
import {
  ADMISSION_TTL_SECONDS,
  ATTACH,
  CANCEL_TICKET,
  COMMIT_ROOM,
  CREATE_ROOM,
  INPUT_TTL_MS,
  LIMIT_ADMISSION,
  MATCHED_TTL_SECONDS,
  MAX_ACTIVE_ROUNDS,
  QUEUE_OR_MATCH,
  UPDATE_INPUT,
  UPDATE_PRESENCE,
} from '@/lib/snake-duel/scripts';
import {
  getRedisConfig,
  RedisArg,
  redisCommand,
  RedisConfig,
} from '@/lib/upstash';

const ROOM_TTL_SECONDS = 600;
const HEARTBEAT_MS = 2000;
const ATTEMPTS = 8;
const ADMISSION_LIMIT = 20;
const LOBBY_LIMIT = 20;
const DEFAULT_ROUNDS = 20;

interface Frame {
  raw: string;
  room: DuelRoom;
  presence: Pair<Presence | null>;
  input: Pair<DuelInput | null>;
}

export const DUEL_UNAVAILABLE = 'Duel sedang tidak tersedia. Coba lagi nanti.';
export const DUEL_NO_STORE =
  'Penyimpanan room belum diatur. Hubungkan Upstash Redis ke project ini.';

const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');

function player(name: string, token: string): DuelPlayer {
  return { name, tokenHash: hash(token), ready: false };
}

function newRoom(
  code: string,
  players: DuelRoom['players'],
  isPublic: boolean,
): DuelRoom {
  return { code, players, public: isPublic, version: 1, round: null };
}

function openSeat(room: DuelRoom): Seat | undefined {
  return SEATS.find((seat) => !room.players[seat]);
}

function listed(room: DuelRoom) {
  return (
    room.public && room.players.some(Boolean) && openSeat(room) !== undefined
  );
}

function lobbyEntry(
  room: DuelRoom | null,
  presence: Pair<Presence | null>,
  now: number,
): DuelLobbyEntry[] {
  if (!room || !listed(room)) return [];
  const host = openSeat(room) === 0 ? 1 : 0;
  const player = room.players[host];
  const present = presence[host];
  return player &&
    present?.id === player.tokenHash &&
    absentSince(present, now) === null
    ? [{ code: room.code, name: player.name }]
    : [];
}

const monthOf = (now: number) => new Date(now).toISOString().slice(0, 7);

function parse<T>(raw: string | null): T | null {
  return raw ? (JSON.parse(raw) as T) : null;
}

type QueuedTicket = Extract<DuelTicket, { status: 'queued' }>;
type Match = { room: DuelRoom; sessions: Pair<DuelSession> };

interface RoomChange {
  release?: string;
  reserve?: string;
  deadline?: number;
  now: number;
  monthlyRounds: number;
  lobby?: 'open' | 'hide';
  indexExpiry: number;
  roomTtl: number;
  code: string;
}

export abstract class DuelStore {
  constructor(private readonly monthlyRounds: number) {}

  abstract allowAdmission(ip: string): Promise<boolean>;
  abstract listRooms(): Promise<DuelLobbyEntry[]>;
  abstract ticket(ticket: string): Promise<DuelTicket | null>;
  abstract cancel(ticket: string): Promise<DuelTicket | null>;

  protected abstract create(room: DuelRoom, id: string): Promise<string>;
  protected abstract readFrame(code: string): Promise<Frame | null>;
  protected abstract attachSeat(
    code: string,
    seat: Seat,
    id: string,
  ): Promise<number>;
  protected abstract updatePresence(
    code: string,
    seat: Seat,
    id: string,
    action: 'pulse' | 'close',
  ): Promise<boolean>;
  protected abstract writeInput(
    code: string,
    seat: Seat,
    input: DuelInput,
  ): Promise<number>;
  protected abstract saveIf(
    frame: Frame,
    next: DuelRoom,
    change: RoomChange,
  ): Promise<number>;
  protected abstract queueOrMatch(
    ticket: string,
    queued: QueuedTicket,
    proposal: Match,
    now: number,
  ): Promise<DuelTicket | null>;

  async createRoom(
    name: string,
    isPublic: boolean,
    token: string,
  ): Promise<DuelSession> {
    const host = player(name, token);
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const room = newRoom(newCode(), [host, null], isPublic);
      const code = await this.create(room, host.tokenHash);
      if (code) return { code, token, seat: 0 };
    }
    throw new RoomError(DUEL_UNAVAILABLE, 503);
  }

  async queue(
    ticket: string,
    name: string,
    now = Date.now(),
  ): Promise<DuelTicket> {
    const queued: QueuedTicket = {
      status: 'queued',
      name,
      expiresAt: now + MATCHMAKING_MS,
    };
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const code = newCode();
      const sessions = pairOf((seat) => ({ code, seat, token: newToken() }));
      const players = pairOf((seat) => player(name, sessions[seat].token));
      const result = await this.queueOrMatch(
        ticket,
        queued,
        { room: newRoom(code, players, false), sessions },
        now,
      );
      if (result) return result;
    }
    throw new RoomError(DUEL_UNAVAILABLE, 503);
  }

  async joinRoom(
    code: string,
    name: string,
    token: string,
  ): Promise<DuelSession> {
    const joining = player(name, token);
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const frame = await this.requireFrame(code);
      const already = SEATS.find(
        (seat) => frame.room.players[seat]?.tokenHash === joining.tokenHash,
      );
      if (already !== undefined) return { code, token, seat: already };
      const seat = openSeat(frame.room);
      if (seat === undefined) throw new RoomError('Room sudah penuh.', 409);
      const next = {
        ...frame.room,
        players: pairOf((i) => (i === seat ? joining : frame.room.players[i])),
      };
      if ((await this.commit(frame, next, Date.now())) === 1)
        return { code, token, seat };
    }
    throw new RoomError('Room sedang berubah. Coba bergabung lagi.', 409);
  }

  private async requireFrame(code: string) {
    const frame = await this.readFrame(code);
    if (!frame)
      throw new RoomError('Room sudah kedaluwarsa atau tidak ditemukan.', 404);
    return frame;
  }

  private async attach(code: string, seat: Seat, id: string) {
    const attached = await this.attachSeat(code, seat, id);
    if (!attached) throw new RoomError('Kursi ini sudah tidak tersedia.', 403);
    if (attached === 1) await this.announce(code);
  }

  private async announce(code: string) {
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const frame = await this.requireFrame(code);
      if ((await this.commit(frame, frame.room, Date.now())) === 1) return;
    }
  }

  private seatOf(frame: Frame, id: string): Seat {
    const seat = SEATS.find(
      (seat) => frame.room.players[seat]?.tokenHash === id,
    );
    if (seat === undefined)
      throw new RoomError('Kursi ini sudah tidak tersedia.', 403);
    return seat;
  }

  async poll(
    code: string,
    token: string,
    version: number,
    move?: DuelMove,
  ): Promise<DuelPoll> {
    const id = hash(token);
    let frame = await this.requireFrame(code);
    const seat = this.seatOf(frame, id);
    const presence = frame.presence[seat];
    const now = Date.now();

    if (presence?.id !== id || absentSince(presence, now) !== null) {
      await this.attach(code, seat, id);
      frame = await this.requireFrame(code);
      this.seatOf(frame, id);
    } else if (now - presence.seenAt >= HEARTBEAT_MS) {
      if (!(await this.updatePresence(code, seat, id, 'pulse'))) {
        throw new RoomError('Kursi ini sudah tidak tersedia.', 403);
      }
      frame.presence[seat] = { ...presence, seenAt: now };
    }

    const round = frame.room.round;
    if (round?.phase === 'playing' && move?.roundId === round.id) {
      const input = { ...move, player: id };
      if ((await this.writeInput(code, seat, input)) === 1) {
        frame.input[seat] = input;
      }
    }
    if (round && round.phase !== 'over') {
      const at = Date.now();
      const next = advanceRound(round, frame.presence, frame.input, at);
      if (next !== round) {
        const room = { ...frame.room, round: next };
        if ((await this.commit(frame, room, at)) === 1) {
          frame.room = { ...room, version: room.version + 1 };
        } else {
          frame = await this.requireFrame(code);
          this.seatOf(frame, id);
        }
      }
    }

    // While waiting, presence can change without a room write.
    if (frame.room.round?.phase === 'playing' && version === frame.room.version)
      return { changed: false, version };
    return {
      changed: true,
      room: roomView(frame.room, frame.presence, Date.now()),
    };
  }

  async ready(code: string, token: string, ready: boolean) {
    const id = hash(token);
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const frame = await this.requireFrame(code);
      const you = this.seatOf(frame, id);
      const { room, presence } = frame;
      if (room.round && room.round.phase !== 'over') return;
      const now = Date.now();
      const players = pairOf((seat) => {
        const current = room.players[seat];
        return current && seat === you ? { ...current, ready } : current;
      });
      const starting = players.every(
        (p, seat) =>
          p?.ready &&
          p.tokenHash === presence[seat]?.id &&
          absentSince(presence[seat], now) === null,
      );
      const round = starting
        ? beginRound(newToken(), randomBytes(4).readUInt32LE(), now)
        : room.round;
      const next = {
        ...room,
        players: starting
          ? pairOf((seat) => ({ ...players[seat]!, ready: false }))
          : players,
        round,
      };
      const saved = await this.commit(frame, next, now);
      if (saved === 1) return;
      if (saved === -2 || saved === -3) {
        const waiting = await this.commit(frame, { ...room, players }, now);
        if (waiting === 0) continue;
        throw new RoomError(
          saved === -2
            ? 'Arena penuh. Coba mulai lagi sebentar.'
            : 'Kuota Duel bulan ini sudah habis.',
          429,
        );
      }
    }
    throw new RoomError('Room sedang berubah. Coba lagi.', 409);
  }

  async leave(code: string, token: string) {
    const id = hash(token);
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const frame = await this.requireFrame(code);
      const you = this.seatOf(frame, id);
      const { room } = frame;
      const round =
        room.round && room.round.phase !== 'over'
          ? endRound(room.round, {
              winner: you === 0 ? 1 : 0,
              reason: 'forfeit',
            })
          : room.round;
      const players = pairOf((seat) => {
        const other = room.players[seat];
        return seat === you || !other ? null : { ...other, ready: false };
      });
      if (
        (await this.commit(frame, { ...room, players, round }, Date.now())) ===
        1
      ) {
        await this.updatePresence(code, you, id, 'close');
        return;
      }
    }
    throw new RoomError('Room sedang berubah. Coba lagi.', 409);
  }

  private async commit(frame: Frame, room: DuelRoom, now: number) {
    const code = frame.room.code;
    const next = { ...room, version: frame.room.version + 1 };
    const opens = listed(next);
    const reserve = next.round?.id !== frame.room.round?.id ? next.round : null;
    const finished =
      next.round?.phase === 'over' && frame.room.round?.phase !== 'over';
    const change: RoomChange = {
      release: finished ? next.round?.id : undefined,
      reserve: reserve?.id,
      deadline: reserve?.expiresAt,
      now,
      monthlyRounds: this.monthlyRounds,
      lobby:
        opens !== listed(frame.room) ? (opens ? 'open' : 'hide') : undefined,
      indexExpiry: now + ROOM_TTL_SECONDS * 1000,
      roomTtl: ROOM_TTL_SECONDS,
      code,
    };
    return this.saveIf(frame, next, change);
  }
}

class RedisStore extends DuelStore {
  constructor(
    private readonly config: RedisConfig,
    private readonly prefix: string,
    monthlyRounds: number,
  ) {
    super(monthlyRounds);
  }

  private key(kind: string, id?: string) {
    return id ? `${this.prefix}:${kind}:${id}` : `${this.prefix}:${kind}`;
  }

  private command<T>(...args: RedisArg[]) {
    return redisCommand<T>(this.config, args);
  }

  private eval<T>(script: string, keys: string[], ...args: RedisArg[]) {
    return this.command<T>('EVAL', script, keys.length, ...keys, ...args);
  }

  async allowAdmission(ip: string) {
    const count = await this.eval<number>(LIMIT_ADMISSION, [
      this.key('admission', hash(ip)),
    ]);
    return count <= ADMISSION_LIMIT;
  }

  protected async create(room: DuelRoom, id: string) {
    const { code } = room;
    return this.eval<string>(
      CREATE_ROOM,
      [this.key('room', code), this.key('lobby'), this.key('creation', id)],
      JSON.stringify(room),
      ROOM_TTL_SECONDS,
      code,
      room.public ? Date.now() + ROOM_TTL_SECONDS * 1000 : '',
    );
  }

  async listRooms(now = Date.now()): Promise<DuelLobbyEntry[]> {
    const codes = await this.command<string[]>(
      'ZREVRANGEBYSCORE',
      this.key('lobby'),
      '+inf',
      now,
      'LIMIT',
      0,
      LOBBY_LIMIT * 2,
    );
    if (!codes.length) return [];
    const rows = await this.command<(string | null)[]>(
      'MGET',
      ...codes.flatMap((code) => [
        this.key('room', code),
        this.key('presence', `${code}:0`),
        this.key('presence', `${code}:1`),
      ]),
    );
    return codes
      .flatMap((_, i) =>
        lobbyEntry(
          parse<DuelRoom>(rows[3 * i]),
          [parse<Presence>(rows[3 * i + 1]), parse<Presence>(rows[3 * i + 2])],
          now,
        ),
      )
      .slice(0, LOBBY_LIMIT);
  }

  protected async queueOrMatch(
    ticket: string,
    queued: QueuedTicket,
    proposal: Match,
    now: number,
  ) {
    return parse<DuelTicket>(
      await this.eval<string>(
        QUEUE_OR_MATCH,
        [
          this.key('queue'),
          this.key('ticket', ticket),
          this.key('room', proposal.room.code),
        ],
        now,
        queued.expiresAt,
        ticket,
        JSON.stringify(queued),
        JSON.stringify(proposal),
        this.key('ticket') + ':',
        ROOM_TTL_SECONDS,
      ),
    );
  }

  async ticket(ticket: string): Promise<DuelTicket | null> {
    return parse(
      await this.command<string | null>('GET', this.key('ticket', ticket)),
    );
  }

  async cancel(ticket: string): Promise<DuelTicket | null> {
    return parse(
      await this.eval<string>(
        CANCEL_TICKET,
        [this.key('queue'), this.key('ticket', ticket)],
        ticket,
      ),
    );
  }

  protected async readFrame(code: string): Promise<Frame | null> {
    const [raw, first, second, firstInput, secondInput] = await this.command<
      (string | null)[]
    >(
      'MGET',
      this.key('room', code),
      this.key('presence', `${code}:0`),
      this.key('presence', `${code}:1`),
      this.key('input', `${code}:0`),
      this.key('input', `${code}:1`),
    );
    return raw
      ? {
          raw,
          room: JSON.parse(raw) as DuelRoom,
          presence: [parse(first), parse(second)],
          input: [parse(firstInput), parse(secondInput)],
        }
      : null;
  }

  protected async attachSeat(code: string, seat: Seat, id: string) {
    return this.eval<number>(
      ATTACH,
      [this.key('room', code), this.key('presence', code + ':' + seat)],
      seat,
      id,
      Date.now(),
      ROOM_TTL_SECONDS,
      PRESENCE_TIMEOUT_MS,
      RECONNECT_MS,
    );
  }

  protected async updatePresence(
    code: string,
    seat: Seat,
    id: string,
    action: 'pulse' | 'close',
  ) {
    return (
      (await this.eval<number>(
        UPDATE_PRESENCE,
        [this.key('presence', `${code}:${seat}`)],
        id,
        Date.now(),
        ROOM_TTL_SECONDS,
        action,
      )) === 1
    );
  }

  protected async writeInput(code: string, seat: Seat, input: DuelInput) {
    return this.eval<number>(
      UPDATE_INPUT,
      [
        this.key('presence', `${code}:${seat}`),
        this.key('input', `${code}:${seat}`),
      ],
      input.player,
      JSON.stringify(input),
      input.roundId,
      input.seq,
    );
  }

  protected async saveIf(frame: Frame, next: DuelRoom, change: RoomChange) {
    return this.eval<number>(
      COMMIT_ROOM,
      [
        this.key('room', next.code),
        this.key('active'),
        this.key('lobby'),
        this.key('quota', monthOf(change.now)),
      ],
      frame.raw,
      JSON.stringify(next),
      JSON.stringify(change),
    );
  }
}

type Expiring<T> = { value: T; expiresAt: number };
type MemoryRoom = {
  raw: string;
  presence: Pair<Presence | null>;
  input: Pair<Expiring<DuelInput> | null>;
};

interface MemoryState {
  rooms: Map<string, Expiring<MemoryRoom>>;
  creations: Map<string, Expiring<string>>;
  tickets: Map<string, Expiring<DuelTicket>>;
  active: Map<string, number>;
  quotas: Map<string, number>;
  limiter: ReturnType<typeof createLimiter>;
}

function prune<T>(entries: Map<string, Expiring<T>>, now: number) {
  for (const [key, entry] of entries) {
    if (entry.expiresAt <= now) entries.delete(key);
  }
}

/** Development only. Store updates run synchronously before returning a promise. */
class MemoryStore extends DuelStore {
  private readonly data: MemoryState;

  constructor(monthlyRounds: number) {
    super(monthlyRounds);
    const g = globalThis as typeof globalThis & {
      __snakeDuel?: MemoryState;
    };
    this.data = g.__snakeDuel ??= {
      rooms: new Map(),
      creations: new Map(),
      tickets: new Map(),
      active: new Map(),
      quotas: new Map(),
      limiter: createLimiter(ADMISSION_LIMIT, ADMISSION_TTL_SECONDS * 1000),
    };
  }

  async allowAdmission(ip: string) {
    return this.data.limiter.allow(ip);
  }

  private getRoom(code: string, now = Date.now()) {
    const entry = this.data.rooms.get(code);
    return entry && entry.expiresAt > now ? entry.value : null;
  }

  private insertRoom(room: DuelRoom, now: number) {
    prune(this.data.rooms, now);
    if (this.data.rooms.has(room.code)) return false;
    this.data.rooms.set(room.code, {
      value: {
        raw: JSON.stringify(room),
        presence: [null, null],
        input: [null, null],
      },
      expiresAt: now + ROOM_TTL_SECONDS * 1000,
    });
    return true;
  }

  protected async create(room: DuelRoom, id: string) {
    const now = Date.now();
    prune(this.data.creations, now);
    const prior = this.data.creations.get(id);
    if (prior) return prior.value;
    if (!this.insertRoom(room, now)) return '';
    this.data.creations.set(id, {
      value: room.code,
      expiresAt: now + ROOM_TTL_SECONDS * 1000,
    });
    return room.code;
  }

  async listRooms(now = Date.now()) {
    prune(this.data.rooms, now);
    return Array.from(this.data.rooms.values())
      .reverse()
      .flatMap(({ value }) =>
        lobbyEntry(parse<DuelRoom>(value.raw), value.presence, now),
      )
      .slice(0, LOBBY_LIMIT);
  }

  protected async queueOrMatch(
    ticket: string,
    queued: QueuedTicket,
    proposal: Match,
    now: number,
  ) {
    const tickets = this.data.tickets;
    prune(tickets, now);
    const prior = tickets.get(ticket);
    if (prior) return prior.value;
    for (const [peer, { value }] of tickets) {
      if (value.status !== 'queued') continue;
      const host = proposal.room.players[0]!;
      host.name = value.name;
      if (!this.insertRoom(proposal.room, now)) return null;
      const [first, second] = proposal.sessions;
      const expiresAt = now + MATCHED_TTL_SECONDS * 1000;
      tickets.set(peer, {
        value: { status: 'matched', session: first },
        expiresAt,
      });
      const matched = { status: 'matched', session: second } as const;
      tickets.set(ticket, { value: matched, expiresAt });
      return matched;
    }
    tickets.set(ticket, { value: queued, expiresAt: queued.expiresAt });
    return queued;
  }

  async ticket(ticket: string) {
    prune(this.data.tickets, Date.now());
    return this.data.tickets.get(ticket)?.value ?? null;
  }

  async cancel(ticket: string) {
    prune(this.data.tickets, Date.now());
    const prior = this.data.tickets.get(ticket)?.value;
    if (prior?.status === 'matched') return prior;
    this.data.tickets.delete(ticket);
    return null;
  }

  protected async readFrame(code: string): Promise<Frame | null> {
    const now = Date.now();
    const entry = this.getRoom(code, now);
    if (!entry) return null;
    return {
      raw: entry.raw,
      room: JSON.parse(entry.raw) as DuelRoom,
      presence: [...entry.presence],
      input: pairOf((seat) => {
        const input = entry.input[seat];
        return input && input.expiresAt > now ? input.value : null;
      }),
    };
  }

  protected async attachSeat(code: string, seat: Seat, id: string) {
    const now = Date.now();
    const entry = this.getRoom(code, now);
    if (!entry) return 0;
    const room = JSON.parse(entry.raw) as DuelRoom;
    if (room.players[seat]?.tokenHash !== id) return 0;
    const previous = entry.presence[seat];
    const lostAt = absentSince(previous, now);
    if (previous?.id === id && lostAt === null) return 2;
    const presence: Presence = { id, seenAt: now };
    const round = room.round;
    if (
      previous &&
      round &&
      round.phase !== 'over' &&
      (previous.expiredRound === round.id ||
        (lostAt !== null && now - lostAt >= RECONNECT_MS))
    ) {
      presence.expiredRound = round.id;
    }
    entry.presence[seat] = presence;
    return 1;
  }

  protected async updatePresence(
    code: string,
    seat: Seat,
    id: string,
    action: 'pulse' | 'close',
  ) {
    const entry = this.getRoom(code);
    const presence = entry?.presence[seat];
    if (!entry || presence?.id !== id || presence.closedAt !== undefined)
      return false;
    entry.presence[seat] =
      action === 'close'
        ? { ...presence, closedAt: Date.now() }
        : { ...presence, seenAt: Date.now() };
    return true;
  }

  protected async writeInput(code: string, seat: Seat, input: DuelInput) {
    const now = Date.now();
    const entry = this.getRoom(code, now);
    const presence = entry?.presence[seat];
    if (
      !entry ||
      presence?.id !== input.player ||
      presence.closedAt !== undefined
    )
      return 0;
    const previous = entry.input[seat];
    if (
      previous &&
      previous.expiresAt > now &&
      previous.value.player === input.player &&
      previous.value.roundId === input.roundId &&
      previous.value.seq >= input.seq
    )
      return 0;
    entry.input[seat] = { value: input, expiresAt: now + INPUT_TTL_MS };
    return 1;
  }

  protected async saveIf(frame: Frame, next: DuelRoom, change: RoomChange) {
    const entry = this.data.rooms.get(next.code);
    if (
      !entry ||
      entry.expiresAt <= Date.now() ||
      entry.value.raw !== frame.raw
    )
      return 0;
    const { active, quotas } = this.data;
    if (change.reserve && change.deadline) {
      for (const [id, deadline] of active) {
        if (deadline <= change.now) active.delete(id);
      }
      if (active.size >= MAX_ACTIVE_ROUNDS) return -2;
      const month = monthOf(change.now);
      const count = quotas.get(month) ?? 0;
      if (count >= change.monthlyRounds) return -3;
      active.set(change.reserve, change.deadline);
      quotas.set(month, count + 1);
    }
    if (change.release) active.delete(change.release);
    entry.value.raw = JSON.stringify(next);
    entry.expiresAt = change.now + change.roomTtl * 1000;
    return 1;
  }
}

export function requireDuelStore() {
  if (process.env.SNAKE_DUEL_ENABLED === '0')
    throw new RoomError(DUEL_UNAVAILABLE, 503);
  const config = getRedisConfig();
  const namespace =
    process.env.SNAKE_DUEL_NAMESPACE ??
    (process.env.VERCEL_ENV === 'preview' ? 'preview' : 'prod');
  const configured = Number(
    process.env.SNAKE_DUEL_MONTHLY_ROUNDS ?? DEFAULT_ROUNDS,
  );
  const quota =
    Number.isSafeInteger(configured) && configured >= 0
      ? configured
      : DEFAULT_ROUNDS;
  if (config) return new RedisStore(config, 'snake:duel:' + namespace, quota);
  if (process.env.NODE_ENV !== 'production') return new MemoryStore(quota);
  throw new RoomError(DUEL_NO_STORE, 503);
}
