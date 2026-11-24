import { createHash } from 'node:crypto';

import { Pair, pairOf } from '@/lib/games/snake-duel';
import { newCode, newToken } from '@/lib/rooms/codes';
import {
  DuelLobbyEntry,
  DuelSession,
  DuelSignaling,
  DuelSignalUpdate,
  DuelTicket,
  MATCHMAKING_MS,
} from '@/lib/snake-duel/protocol';
import {
  CANCEL_TICKET,
  CREATE_ROOM,
  EXCHANGE_SIGNAL,
  JOIN_ROOM,
  LIMIT_ADMISSION,
  QUEUE_OR_MATCH,
} from '@/lib/snake-duel/scripts';
import {
  getRedisConfig,
  RedisArg,
  redisCommand,
  RedisConfig,
} from '@/lib/upstash';

const ROOM_TTL_SECONDS = 600;
const PRESENCE_TTL_SECONDS = 15;
const ATTEMPTS = 8;

interface DuelPlayer {
  name: string;
  tokenHash: string;
  reservation?: string;
}

interface DuelRoom {
  code: string;
  players: Pair<DuelPlayer | null>;
  public: boolean;
  paired?: boolean;
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

function player(name: string, token: string, reservation?: string): DuelPlayer {
  return { name, tokenHash: hash(token), reservation };
}

function newRoom(
  code: string,
  players: DuelRoom['players'],
  isPublic: boolean,
): DuelRoom {
  return { code, players, public: isPublic };
}

function parse<T>(raw: string | null): T | null {
  return raw ? (JSON.parse(raw) as T) : null;
}

export class DuelStore {
  constructor(
    private readonly config: RedisConfig,
    private readonly prefix: string,
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
    const joined = await this.eval<string>(
      JOIN_ROOM,
      [
        this.key('room', code),
        this.key('presence', `${code}:1`),
        this.key('signal', `${code}:0`),
        this.key('signal', `${code}:1`),
      ],
      JSON.stringify(player(name, token, newToken())),
      PRESENCE_TTL_SECONDS,
    );
    if (joined === 'missing')
      throw new DuelError('Room sudah kedaluwarsa atau tidak ditemukan.', 404);
    if (joined !== 'host' && joined !== 'guest')
      throw new DuelError('Room sudah penuh.');
    return { code, token, seat: joined === 'host' ? 0 : 1 };
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
        const host = room?.players[0];
        return host &&
          room.public &&
          !room.paired &&
          rows[3 * i + 1] &&
          !rows[3 * i + 2]
          ? [{ code, name: host.name }]
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
      const players = pairOf((seat) =>
        player(name, sessions[seat].token, seat === 1 ? newToken() : undefined),
      );
      const raw = await this.eval<string>(
        QUEUE_OR_MATCH,
        [
          this.key('queue'),
          this.key('ticket', ticket),
          this.key('room', code),
          this.key('presence', `${code}:1`),
        ],
        now,
        queued.expiresAt,
        ticket,
        JSON.stringify(queued),
        JSON.stringify({ room: newRoom(code, players, false), sessions }),
        `${this.key('ticket')}:`,
        ROOM_TTL_SECONDS,
        PRESENCE_TTL_SECONDS,
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

  async exchangeSignal(
    session: DuelSession,
    outgoing?: DuelSignalUpdate,
  ): Promise<DuelSignaling> {
    const { code, seat, token } = session;
    const result = await this.eval<string>(
      EXCHANGE_SIGNAL,
      [
        this.key('room', code),
        this.key('signal', `${code}:${seat}`),
        this.key('signal', `${code}:${1 - seat}`),
        this.key('presence', `${code}:${seat}`),
        this.key('presence', `${code}:1`),
        this.key('lobby'),
      ],
      seat,
      hash(token),
      outgoing ? JSON.stringify(outgoing) : '',
      PRESENCE_TTL_SECONDS,
      ROOM_TTL_SECONDS,
    );
    if (!result)
      throw new DuelError('Room sudah kedaluwarsa atau tidak ditemukan.', 404);
    if (result === 'forbidden')
      throw new DuelError('Kursi ini sudah tidak tersedia.', 403);
    if (result === 'stale') throw new DuelError('Lawan sudah berganti.', 409);
    return JSON.parse(result) as DuelSignaling;
  }
}

export function getDuelStore() {
  const config = getRedisConfig();
  if (!config) throw new DuelError(DUEL_UNAVAILABLE, 503);
  const namespace = process.env.VERCEL_ENV === 'preview' ? 'preview' : 'prod';
  return new DuelStore(config, `snake:duel:rtc:${namespace}`);
}
