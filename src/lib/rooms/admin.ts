import { GameId, OutWhy, Room, RoomError, RoomStatus } from '@/lib/rooms/types';

export interface AdminPlayerInfo {
  seat: number;
  name: string;
  occupied: boolean;
  isHost: boolean;
  out: boolean;
  strikes: number;
  leftAt: number | null;
  why: OutWhy | null;
}

export interface AdminRoomSummary {
  code: string;
  game: GameId;
  status: RoomStatus;
  version: number;
  createdAt: number;
  lastActiveAt: number;
  hostSeat: number;
  playerCount: number;
  activeCount: number;
  players: AdminPlayerInfo[];
}

export type AdminAction =
  | { action: 'kick'; seat: number }
  | { action: 'setHost'; seat: number }
  | { action: 'forceEnd' };

/**
 * Converts a stored Room into a safe admin summary without leaking player tokens.
 */
export function summarizeRoom(room: Room): AdminRoomSummary {
  const hostSeat = room.host ?? 0;
  const players: AdminPlayerInfo[] = room.tokens.map((tok, seat) => {
    const occupied = tok !== null;
    const isOut = Boolean(room.out?.[seat]);
    const rawName = room.names?.[seat]?.trim();
    return {
      seat,
      name: rawName || (occupied ? `Pemain ${seat + 1}` : 'Kosong'),
      occupied,
      isHost: occupied && seat === hostSeat,
      out: isOut,
      strikes: room.strikes?.[seat] ?? 0,
      leftAt: room.left?.[seat] ?? null,
      why: room.why?.[seat] ?? null,
    };
  });

  const occupiedPlayers = players.filter((p) => p.occupied);
  const activeCount = occupiedPlayers.filter((p) => !p.out).length;

  return {
    code: room.code,
    game: room.game,
    status: room.status,
    version: room.version,
    createdAt: room.createdAt,
    lastActiveAt: room.stamp ?? room.createdAt,
    hostSeat,
    playerCount: occupiedPlayers.length,
    activeCount,
    players: occupiedPlayers,
  };
}

/**
 * Applies an admin moderation action to a Room, returning an updated copy.
 */
export function applyAdminAction(
  room: Room,
  input: AdminAction,
  now = Date.now(),
): Room {
  const next: Room = {
    ...room,
    out: room.out ? [...room.out] : room.tokens.map(() => false),
    why: room.why ? [...room.why] : room.tokens.map(() => null),
    version: room.version + 1,
    stamp: now,
  };

  if (input.action === 'forceEnd') {
    next.status = 'over';
    return next;
  }

  const { seat } = input;
  if (
    !Number.isInteger(seat) ||
    seat < 0 ||
    seat >= room.tokens.length ||
    room.tokens[seat] === null
  ) {
    throw new RoomError('Kursi pemain tidak valid atau kosong', 400);
  }

  if (input.action === 'kick') {
    next.out![seat] = true;
    next.why![seat] = 'kicked';
    return next;
  }

  if (input.action === 'setHost') {
    next.host = seat;
    next.hostAt = now;
    return next;
  }

  throw new RoomError('Aksi tidak dikenal', 400);
}
