import { createHash } from 'node:crypto';

import { Pair, pairOf } from '@/features/games/logic/snake-duel';
import { newCode, newToken } from '@/features/rooms/codes';
import {
  DuelLobbyEntry,
  DuelSession,
  DuelSignal,
  DuelSignaling,
  DuelSignalUpdate,
  DuelTicket,
  MATCHMAKING_MS,
} from '@/features/snake-duel/protocol';
import {
  getSupabaseState,
  type SupabaseState,
} from '@/integrations/supabase/state';

const ROOM_TTL_MS = 600_000;
const PRESENCE_TTL_MS = 15_000;
const ATTEMPTS = 8;

interface DuelPlayer {
  name: string;
  tokenHash: string;
  reservation?: string;
}

interface DuelRoom {
  code: string;
  players: Pair<DuelPlayer | null>;
  presence: Pair<number>;
  public: boolean;
  paired?: boolean;
}

const roomKey = (code: string) => `room:${code}`;
const lobbyKey = (code: string) => `lobby:${code}`;
const signalKey = (code: string, seat: number) => `signal:${code}:${seat}`;
const ticketKey = (ticket: string) => `ticket:${ticket}`;
const queueKey = 'queue';
type QueueEntry = { ticket: string; expiresAt: number };

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

export class DuelStore {
  constructor(private readonly state: SupabaseState) {}

  async allowAdmission(ip: string) {
    const key = `admission:${hash(ip)}`;
    return this.state.transact([key], async (tx) => {
      const prior = await tx.read<number>(key);
      const count = (prior?.value ?? 0) + 1;
      if (count > 20) return false;
      tx.set(key, count, prior?.expiresAt ?? Date.now() + 60_000);
      return true;
    });
  }

  async createRoom(
    name: string,
    isPublic: boolean,
    token: string,
  ): Promise<DuelSession> {
    const creation = `creation:${hash(token)}`;
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const code = newCode();
      const key = roomKey(code);
      const lobby = lobbyKey(code);
      const created = await this.state.transact(
        isPublic ? [creation, key, lobby] : [creation, key],
        async (tx) => {
          const prior = await tx.read<string>(creation);
          if (prior) return prior.value;
          if (await tx.read<DuelRoom>(key)) return null;
          const expires = Date.now() + ROOM_TTL_MS;
          const room: DuelRoom = {
            code,
            players: [player(name, token), null],
            presence: [0, 0],
            public: isPublic,
          };
          tx.set(key, room, expires);
          tx.set(creation, code, expires);
          if (isPublic) tx.set(lobby, code, expires);
          return code;
        },
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
    const key = roomKey(code);
    const signals = [signalKey(code, 0), signalKey(code, 1)];
    const joining = player(name, token, newToken());
    return this.state.transact([key, ...signals], async (tx) => {
      const stored = await tx.read<DuelRoom>(key);
      if (!stored)
        throw new DuelError(
          'Room sudah kedaluwarsa atau tidak ditemukan.',
          404,
        );
      const room = stored.value;
      if (room.paired) throw new DuelError('Room sudah penuh.');
      if (room.players[0]?.tokenHash === joining.tokenHash)
        return { code, token, seat: 0 };

      const now = Date.now();
      const guest = room.players[1];
      if (guest && room.presence[1] > now) {
        if (guest.tokenHash === joining.tokenHash)
          return { code, token, seat: 1 };
        throw new DuelError('Room sudah penuh.');
      }

      room.players[1] = joining;
      room.presence[1] = now + PRESENCE_TTL_MS;
      tx.set(key, room, stored.expiresAt);
      for (const signal of signals) tx.delete(signal);
      return { code, token, seat: 1 };
    });
  }

  async listRooms(now = Date.now()): Promise<DuelLobbyEntry[]> {
    const lobby = await this.state.newestKeys('lobby:', 40);
    const rooms = await this.state.getMany<DuelRoom>(
      lobby.map((key) => roomKey(key.slice('lobby:'.length))),
    );
    return rooms
      .flatMap((room) => {
        const host = room?.players[0];
        return room &&
          host &&
          room.public &&
          !room.paired &&
          room.presence[0] > now &&
          room.presence[1] <= now
          ? [{ code: room.code, name: host.name }]
          : [];
      })
      .slice(0, 20);
  }

  async queue(
    ticket: string,
    name: string,
    now = Date.now(),
  ): Promise<DuelTicket> {
    const key = ticketKey(ticket);
    const queued: DuelTicket = {
      status: 'queued',
      name,
      expiresAt: now + MATCHMAKING_MS,
    };

    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const code = newCode();
      const matchRoom = roomKey(code);
      const sessions = pairOf((seat) => ({ code, seat, token: newToken() }));
      const reservation = newToken();

      const result = await this.state.transact(
        [queueKey, key, matchRoom],
        async (tx) => {
          const prior = await tx.read<DuelTicket>(key);
          if (prior) return prior.value;
          const queue = (await tx.read<QueueEntry[]>(queueKey))?.value ?? [];
          const active = queue.filter(
            (entry) => entry.expiresAt > now && entry.ticket !== ticket,
          );
          const next = active.shift();
          if (next) {
            const peerKey = ticketKey(next.ticket);
            const peer = (await tx.read<DuelTicket>(peerKey))?.value;
            if (peer?.status === 'queued' && peer.expiresAt > now) {
              if (await tx.read<DuelRoom>(matchRoom)) return null;
              const room: DuelRoom = {
                code,
                players: [
                  player(peer.name, sessions[0].token),
                  player(name, sessions[1].token, reservation),
                ],
                presence: [0, Date.now() + PRESENCE_TTL_MS],
                public: false,
              };
              const matched: DuelTicket = {
                status: 'matched',
                session: sessions[1],
              };
              const expiresAt = Date.now() + 90_000;
              tx.set(matchRoom, room, Date.now() + ROOM_TTL_MS);
              tx.set(
                peerKey,
                { status: 'matched', session: sessions[0] },
                expiresAt,
              );
              tx.set(key, matched, expiresAt);
              if (active.length)
                tx.set(queueKey, active, active.at(-1)!.expiresAt);
              else tx.delete(queueKey);
              return matched;
            }
          }
          active.push({ ticket, expiresAt: queued.expiresAt });
          active.sort(
            (a, b) =>
              a.expiresAt - b.expiresAt || a.ticket.localeCompare(b.ticket),
          );
          tx.set(queueKey, active, active.at(-1)!.expiresAt);
          tx.set(key, queued, queued.expiresAt);
          return queued;
        },
      );
      if (result) return result;
    }
    throw new DuelError(DUEL_UNAVAILABLE, 503);
  }

  ticket(ticket: string) {
    return this.state.get<DuelTicket>(ticketKey(ticket));
  }

  cancel(ticket: string) {
    const key = ticketKey(ticket);
    return this.state.transact([queueKey, key], async (tx) => {
      const stored = await tx.read<DuelTicket>(key);
      if (stored?.value.status === 'matched') return stored.value;
      const waiting = await tx.read<QueueEntry[]>(queueKey);
      const queue =
        waiting?.value.filter((entry) => entry.ticket !== ticket) ?? [];
      if (queue.length) tx.set(queueKey, queue, queue.at(-1)!.expiresAt);
      else if (waiting) tx.delete(queueKey);
      if (stored) tx.delete(key);
      return null;
    });
  }

  exchangeSignal(
    session: DuelSession,
    outgoing?: DuelSignalUpdate,
  ): Promise<DuelSignaling> {
    const { code, seat, token } = session;
    const key = roomKey(code);
    const incoming = signalKey(code, 1 - seat);
    const own = signalKey(code, seat);
    const lobby = lobbyKey(code);
    const keys = outgoing
      ? [key, incoming, 'paired' in outgoing ? lobby : own]
      : [key, incoming];
    return this.state.transact(keys, async (tx) => {
      const stored = await tx.read<DuelRoom>(key);
      if (!stored)
        throw new DuelError(
          'Room sudah kedaluwarsa atau tidak ditemukan.',
          404,
        );
      const room = stored.value;
      const now = Date.now();
      const guest =
        room.paired || room.presence[1] > now ? room.players[1] : null;
      if (
        room.players[seat]?.tokenHash !== hash(token) ||
        (seat === 1 && !guest)
      ) {
        throw new DuelError('Kursi ini sudah tidak tersedia.', 403);
      }

      if (outgoing) {
        if (
          !guest ||
          ('paired' in outgoing ? outgoing.paired : outgoing.guest) !==
            guest.reservation
        ) {
          throw new DuelError('Lawan sudah berganti.', 409);
        }
        if (!room.paired && 'paired' in outgoing) {
          room.paired = true;
          tx.set(key, room, stored.expiresAt);
          if (room.public) tx.delete(lobby);
        } else if (!room.paired && 'guest' in outgoing) {
          tx.set(own, outgoing, now + ROOM_TTL_MS);
        }
      }
      if (!room.paired) {
        room.presence[seat] = now + PRESENCE_TTL_MS;
        tx.set(key, room, stored.expiresAt);
      }
      return {
        names: [room.players[0]?.name ?? null, guest?.name ?? null],
        guest: guest?.reservation ?? null,
        signal: guest
          ? ((await tx.read<DuelSignal>(incoming))?.value ?? null)
          : null,
      };
    });
  }
}

export function getDuelStore() {
  const environment = process.env.VERCEL_ENV === 'preview' ? 'preview' : 'prod';
  const state = getSupabaseState(`snake-duel:${environment}`);
  if (!state) throw new DuelError(DUEL_UNAVAILABLE, 503);
  return new DuelStore(state);
}
