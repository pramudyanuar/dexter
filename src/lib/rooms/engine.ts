import { GAMES } from '@/lib/rooms/games';
import type { GameId } from '@/lib/rooms/types';
import { Room, RoomError, RoomView } from '@/lib/rooms/types';

export function newRoom(
  game: GameId,
  code: string,
  token: string,
  now = Date.now(),
): Room {
  const tokens: (string | null)[] = Array(GAMES[game].maxPlayers).fill(null);
  tokens[0] = token;
  return {
    code,
    game,
    tokens,
    status: 'waiting',
    state: null,
    version: 1,
    createdAt: now,
  };
}

/** Which seat a token holds, or null. */
export function seatOf(room: Room, token: unknown): number | null {
  if (typeof token !== 'string' || !token) return null;
  const seat = room.tokens.indexOf(token);
  return seat === -1 ? null : seat;
}

export const seated = (room: Room) => room.tokens.filter(Boolean).length;

function begin(room: Room, rng?: () => number): Room {
  return {
    ...room,
    status: 'playing',
    state: GAMES[room.game].start(seated(room), rng),
    version: room.version + 1,
  };
}

/**
 * Takes a free seat with `newToken`. A player who already has a seat (same
 * token) just gets it back, so reloading the page does not lose the game.
 */
export function join(
  room: Room,
  existingToken: unknown,
  newToken: string,
  rng?: () => number,
): { room: Room; token: string; you: number } {
  const seat = seatOf(room, existingToken);
  if (seat !== null) return { room, token: existingToken as string, you: seat };

  if (room.status !== 'waiting')
    throw new RoomError('Permainan sudah dimulai', 409);
  const free = room.tokens.indexOf(null);
  if (free === -1) throw new RoomError('Room sudah penuh', 409);

  const tokens = [...room.tokens];
  tokens[free] = newToken;
  let next: Room = { ...room, tokens, version: room.version + 1 };
  if (GAMES[room.game].autoStart && tokens.every(Boolean))
    next = begin(next, rng);
  return { room: next, token: newToken, you: free };
}

/** The host starts games that wait for a variable number of players. */
export function start(room: Room, token: unknown, rng?: () => number): Room {
  if (seatOf(room, token) !== 0)
    throw new RoomError('Hanya pembuat room yang bisa memulai', 403);
  if (room.status !== 'waiting')
    throw new RoomError('Permainan sudah dimulai', 409);
  const { minPlayers } = GAMES[room.game];
  if (seated(room) < minPlayers) {
    throw new RoomError(`Butuh minimal ${minPlayers} pemain`, 409);
  }
  return begin(room, rng);
}

export function act(
  room: Room,
  token: unknown,
  move: unknown,
  rng?: () => number,
): Room {
  const seat = seatOf(room, token);
  if (seat === null) throw new RoomError('Kamu bukan pemain di room ini', 403);
  if (room.status === 'waiting')
    throw new RoomError('Permainan belum dimulai', 409);
  if (room.status === 'over')
    throw new RoomError('Permainan sudah selesai', 409);

  const def = GAMES[room.game];
  const state = def.move(room.state, seat, move, rng);
  return {
    ...room,
    state,
    status: def.isOver(state) ? 'over' : 'playing',
    version: room.version + 1,
  };
}

/** Starts another round once one has ended. */
export function rematch(room: Room, token: unknown, rng?: () => number): Room {
  if (seatOf(room, token) === null)
    throw new RoomError('Kamu bukan pemain di room ini', 403);
  // a second click after the first already restarted: nothing to do
  if (room.status !== 'over') return room;

  return {
    ...room,
    status: 'playing',
    state: GAMES[room.game].restart(room.state, seated(room), rng),
    version: room.version + 1,
  };
}

/** The only way a room reaches a client: shaped for one viewer. */
export function toView(room: Room, token?: unknown): RoomView {
  const seat = seatOf(room, token);
  const def = GAMES[room.game];
  return {
    code: room.code,
    game: room.game,
    status: room.status,
    seat,
    joined: room.tokens.map(Boolean),
    capacity: room.tokens.length,
    minPlayers: def.minPlayers,
    version: room.version,
    state: room.state === null ? null : def.view(room.state, seat),
  };
}
