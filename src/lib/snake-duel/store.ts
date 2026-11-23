import { createHash, randomBytes } from 'node:crypto';

import { Pair, pairOf, Seat, SEATS } from '@/lib/games/snake-duel';
import { newCode, newToken } from '@/lib/rooms/codes';
import {
  DuelLobbyEntry,
  DuelSession,
  DuelTicket,
  DuelView,
  MATCHMAKING_MS,
  RECONNECT_MS,
} from '@/lib/snake-duel/protocol';
import {
  absentSince,
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
  ATTACH,
  CANCEL_TICKET,
  COMMIT_ROOM,
  CREATE_ROOM,
  LIMIT_ADMISSION,
  QUEUE_OR_MATCH,
  UPDATE_INPUT,
  UPDATE_LEASE,
  UPDATE_PRESENCE,
} from '@/lib/snake-duel/scripts';
import {
  getRedisConfig,
  RedisArg,
  redisCommand,
  RedisConfig,
  subscribeRedis,
} from '@/lib/upstash';

const ROOM_TTL_SECONDS = 600;
const LEASE_MS = 2000;
const ATTEMPTS = 8;
const DEFAULT_ROUNDS = 20;

interface Frame {
  raw: string;
  room: DuelRoom;
  presence: Pair<Presence | null>;
  input: Pair<DuelInput | null>;
}

export class DuelError extends Error {
  constructor(
    message: string,
    readonly status = 409,
  ) {
    super(message);
  }
}

export const DUEL_UNAVAILABLE = 'Duel sedang tidak tersedia. Coba lagi nanti.';

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

function parse<T>(raw: string | null): T | null {
  return raw ? (JSON.parse(raw) as T) : null;
}

export class DuelStore {
  constructor(
    private readonly config: RedisConfig,
    private readonly prefix: string,
    private readonly monthlyRounds: number,
  ) {}

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
    return count <= 20;
  }

  async createRoom(
    name: string,
    isPublic: boolean,
    token: string,
  ): Promise<DuelSession> {
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const code = newCode();
      const room = newRoom(code, [player(name, token), null], isPublic);
      const created = await this.eval<string>(
        CREATE_ROOM,
        [
          this.key('room', code),
          this.key('lobby'),
          this.key('creation', hash(token)),
        ],
        JSON.stringify(room),
        ROOM_TTL_SECONDS,
        code,
        isPublic ? Date.now() + ROOM_TTL_SECONDS * 1000 : '',
      );
      if (created) return { code: created, token, seat: 0 };
    }
    throw new DuelError(DUEL_UNAVAILABLE, 503);
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
      if (seat === undefined) throw new DuelError('Room sudah penuh.');
      const next = {
        ...frame.room,
        players: pairOf((i) => (i === seat ? joining : frame.room.players[i])),
      };
      if ((await this.commit(frame, next, Date.now())) === 1)
        return { code, token, seat };
    }
    throw new DuelError('Room sedang berubah. Coba bergabung lagi.');
  }

  async listRooms(now = Date.now()): Promise<DuelLobbyEntry[]> {
    const codes = await this.command<string[]>(
      'ZREVRANGEBYSCORE',
      this.key('lobby'),
      '+inf',
      now,
      'LIMIT',
      0,
      40,
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
      .flatMap((code, i) => {
        const room = parse<DuelRoom>(rows[3 * i]);
        if (!room || !listed(room)) return [];
        const host = openSeat(room) === 0 ? 1 : 0;
        const present = parse<Presence>(rows[3 * i + 1 + host]);
        return present && absentSince(present, now) === null
          ? [{ code, name: room.players[host]!.name }]
          : [];
      })
      .slice(0, 20);
  }

  async queue(
    ticket: string,
    name: string,
    now = Date.now(),
  ): Promise<DuelTicket> {
    const queued: DuelTicket = {
      status: 'queued',
      name,
      expiresAt: now + MATCHMAKING_MS,
    };
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const code = newCode();
      const sessions = pairOf((seat) => ({ code, seat, token: newToken() }));
      const players = pairOf((seat) => player(name, sessions[seat].token));
      const raw = await this.eval<string>(
        QUEUE_OR_MATCH,
        [this.key('queue'), this.key('ticket', ticket), this.key('room', code)],
        now,
        queued.expiresAt,
        ticket,
        JSON.stringify(queued),
        JSON.stringify({ room: newRoom(code, players, false), sessions }),
        `${this.key('ticket')}:`,
        ROOM_TTL_SECONDS,
      );
      if (raw) return JSON.parse(raw) as DuelTicket;
    }
    throw new DuelError(DUEL_UNAVAILABLE, 503);
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

  async readFrame(code: string): Promise<Frame | null> {
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

  private async requireFrame(code: string) {
    const frame = await this.readFrame(code);
    if (!frame)
      throw new DuelError('Room sudah kedaluwarsa atau tidak ditemukan.', 404);
    return frame;
  }

  async attach(session: DuelSession, connection: string) {
    const { code, seat, token } = session;
    const attached = await this.eval<number>(
      ATTACH,
      [this.key('room', code), this.key('presence', `${code}:${seat}`)],
      seat,
      hash(token),
      connection,
      Date.now(),
      ROOM_TTL_SECONDS,
      PRESENCE_TIMEOUT_MS,
      RECONNECT_MS,
    );
    if (attached !== 1)
      throw new DuelError('Kursi ini sudah tidak tersedia.', 403);
    return this.announce(code);
  }

  async updatePresence(
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

  private async announce(code: string): Promise<DuelView> {
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const frame = await this.requireFrame(code);
      const now = Date.now();
      if ((await this.commit(frame, frame.room, now)) === 1) {
        return roomView(
          { ...frame.room, version: frame.room.version + 1 },
          frame.presence,
          now,
        );
      }
    }
    const frame = await this.requireFrame(code);
    return roomView(frame.room, frame.presence, Date.now());
  }

  async detach(code: string, seat: Seat, id: string) {
    const closed = await this.updatePresence(code, seat, id, 'close');
    await this.updateLease(code, id, false);
    if (closed) await this.announce(code);
  }

  private checkSession(frame: Frame, session: DuelSession, connection: string) {
    if (
      frame.room.players[session.seat]?.tokenHash !== hash(session.token) ||
      frame.presence[session.seat]?.id !== connection ||
      absentSince(frame.presence[session.seat], Date.now()) !== null
    ) {
      throw new DuelError('Kursi ini sudah tidak tersedia.', 403);
    }
  }

  async ready(session: DuelSession, connection: string, ready: boolean) {
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const frame = await this.requireFrame(session.code);
      this.checkSession(frame, session, connection);
      const { room, presence } = frame;
      if (room.round && room.round.phase !== 'over') return;
      const now = Date.now();
      const players = pairOf((seat) => {
        const current = room.players[seat];
        return current && seat === session.seat
          ? { ...current, ready }
          : current;
      });
      const starting = players.every(
        (p, seat) => p?.ready && absentSince(presence[seat], now) === null,
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
        throw new DuelError(
          saved === -2
            ? 'Arena penuh. Coba mulai lagi sebentar.'
            : 'Kuota Duel bulan ini sudah habis.',
          429,
        );
      }
    }
    throw new DuelError('Room sedang berubah. Coba lagi.');
  }

  async leave(session: DuelSession, connection: string) {
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const frame = await this.requireFrame(session.code);
      this.checkSession(frame, session, connection);
      const { room } = frame;
      const round =
        room.round && room.round.phase !== 'over'
          ? endRound(room.round, {
              winner: session.seat === 0 ? 1 : 0,
              reason: 'forfeit',
            })
          : room.round;
      const players = pairOf((seat) => {
        const other = room.players[seat];
        return seat === session.seat || !other
          ? null
          : { ...other, ready: false };
      });
      if (
        (await this.commit(frame, { ...room, players, round }, Date.now())) ===
        1
      )
        return;
    }
    throw new DuelError('Room sedang berubah. Coba lagi.');
  }

  async writeInput(code: string, seat: Seat, input: DuelInput) {
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

  async claimLease(code: string, owner: string) {
    return (
      (await this.command<string | null>(
        'SET',
        this.key('lease', code),
        owner,
        'NX',
        'PX',
        LEASE_MS,
      )) === 'OK'
    );
  }

  async updateLease(code: string, owner: string, renew: boolean) {
    return (
      (await this.eval<number>(
        UPDATE_LEASE,
        [this.key('lease', code)],
        owner,
        renew ? LEASE_MS : 0,
      )) === 1
    );
  }

  subscribe(
    code: string,
    signal: AbortSignal,
    receive: (view: DuelView) => void,
  ) {
    return subscribeRedis(
      this.config,
      this.key('events', code),
      signal,
      (data) => {
        receive(JSON.parse(data) as DuelView);
      },
    );
  }

  async commit(frame: Frame, room: DuelRoom, now: number, owner?: string) {
    const code = frame.room.code;
    const next = { ...room, version: frame.room.version + 1 };
    const opens = listed(next);
    const reserve = next.round?.id !== frame.room.round?.id ? next.round : null;
    const finished =
      next.round?.phase === 'over' && frame.room.round?.phase !== 'over';
    const change = {
      owner,
      leaseMs: LEASE_MS,
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
    return this.eval<number>(
      COMMIT_ROOM,
      [
        this.key('room', code),
        this.key('events', code),
        this.key('lease', code),
        this.key('active'),
        this.key('lobby'),
        this.key('quota', new Date(now).toISOString().slice(0, 7)),
      ],
      frame.raw,
      JSON.stringify(next),
      JSON.stringify(roomView(next, frame.presence, now)),
      JSON.stringify(change),
    );
  }
}

export function getDuelStore() {
  if (process.env.SNAKE_DUEL_ENABLED !== '1') {
    throw new DuelError(
      'Snake Duel belum diaktifkan. Kamu masih bisa bermain Klasik atau Harian.',
      503,
    );
  }
  const config = getRedisConfig();
  if (!config) throw new DuelError(DUEL_UNAVAILABLE, 503);
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
  return new DuelStore(config, `snake:duel:${namespace}`, quota);
}
