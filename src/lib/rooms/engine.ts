import { GAMES } from '@/lib/rooms/games';
import type { GameId } from '@/lib/rooms/types';
import {
  HOST_NOTICE_MS,
  LEAVE_GRACE_MS,
  MAX_STRIKES,
  OutWhy,
  Room,
  RoomError,
  RoomView,
} from '@/lib/rooms/types';

export const NAME_MAX = 16;

/**
 * A display name as typed by a player: trimmed, single-spaced, without control
 * characters and at most NAME_MAX characters. Null when nothing is left.
 */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = Array.from(
    raw
      .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e]/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
  )
    .slice(0, NAME_MAX)
    .join('')
    .trim();
  return name || null;
}

const namesOf = (room: Room) =>
  room.names ?? Array<string | null>(room.tokens.length).fill(null);

export function newRoom(
  game: GameId,
  code: string,
  token: string,
  now = Date.now(),
  name?: unknown,
): Room {
  const tokens: (string | null)[] = Array(GAMES[game].maxPlayers).fill(null);
  tokens[0] = token;
  const names: (string | null)[] = Array(tokens.length).fill(null);
  names[0] = cleanName(name);
  return {
    code,
    game,
    tokens,
    names,
    status: 'waiting',
    state: null,
    version: 1,
    createdAt: now,
    host: 0,
  };
}

/** Which seat a token holds, or null. */
export function seatOf(room: Room, token: unknown): number | null {
  if (typeof token !== 'string' || !token) return null;
  const seat = room.tokens.indexOf(token);
  return seat === -1 ? null : seat;
}

export const seated = (room: Room) => room.tokens.filter(Boolean).length;

const outOf = (room: Room) =>
  room.out ?? Array<boolean>(room.tokens.length).fill(false);
const strikesOf = (room: Room) =>
  room.strikes ?? Array<number>(room.tokens.length).fill(0);
const leftOf = (room: Room) =>
  room.left ?? Array<number | null>(room.tokens.length).fill(null);
const whyOf = (room: Room) =>
  room.why ?? Array<OutWhy | null>(room.tokens.length).fill(null);
const stampOf = (room: Room) => room.stamp ?? room.createdAt;
export const hostOf = (room: Room) => room.host ?? 0;

const put = <T>(items: T[], at: number, value: T) =>
  items.map((v, i) => (i === at ? value : v));

/** Closes the gaps left by players who went away, so seats run 0..n-1 again. */
function compact(room: Room): Room {
  const keep = room.tokens.flatMap((t, i) => (t ? [i] : []));
  if (keep.every((old, i) => old === i)) return room;
  const pad = <T>(items: T[], fill: T) => [
    ...keep.map((i) => items[i]),
    ...Array<T>(room.tokens.length - keep.length).fill(fill),
  ];
  return {
    ...room,
    tokens: pad(room.tokens, null),
    names: pad(namesOf(room), null),
    out: pad(outOf(room), false),
    strikes: pad(strikesOf(room), 0),
    left: pad(leftOf(room), null),
    why: pad(whyOf(room), null),
    // the admin keeps their role; their seat number may have moved up
    host: Math.max(0, keep.indexOf(hostOf(room))),
  };
}

function begin(room: Room, rng?: () => number, now = Date.now()): Room {
  const tidy = compact(room);
  const n = tidy.tokens.length;
  return {
    ...tidy,
    status: 'playing',
    state: GAMES[room.game].start(seated(tidy), rng),
    out: Array<boolean>(n).fill(false),
    strikes: Array<number>(n).fill(0),
    left: Array<number | null>(n).fill(null),
    why: Array<OutWhy | null>(n).fill(null),
    stamp: now,
    version: room.version + 1,
  };
}

/** Passes the admin role to another player still in the room (the first one still in the game). */
function handOverHost(room: Room, now: number): Room {
  const out = outOf(room);
  const left = leftOf(room);
  const others = room.tokens.flatMap((t, i) =>
    t && i !== hostOf(room) ? [i] : [],
  );
  const next =
    others.find((i) => !out[i] && left[i] === null) ??
    others.find((i) => left[i] === null) ??
    others[0];
  return next === undefined ? room : { ...room, host: next, hostAt: now };
}

/** Takes a seat out of the room altogether (it can be taken by someone else). */
function removeSeat(room: Room, seat: number, now: number): Room {
  if (!room.tokens[seat]) return room;
  const emptied: Room = {
    ...room,
    tokens: put(room.tokens, seat, null),
    names: put(namesOf(room), seat, null),
    out: put(outOf(room), seat, false),
    strikes: put(strikesOf(room), seat, 0),
    left: put(leftOf(room), seat, null),
    why: put(whyOf(room), seat, null),
    version: room.version + 1,
  };
  return seat === hostOf(room) ? handOverHost(emptied, now) : emptied;
}

/**
 * Takes a free seat with `newToken`. A player who already has a seat (same
 * token) just gets it back, so reloading the page does not lose the game, and
 * coming back after pressing "keluar" cancels the leaving.
 */
export function join(
  room: Room,
  existingToken: unknown,
  newToken: string,
  rng?: () => number,
  name?: unknown,
  now = Date.now(),
): { room: Room; token: string; you: number } {
  const seat = seatOf(room, existingToken);
  if (seat !== null) {
    return {
      room: revive(room, seat),
      token: existingToken as string,
      you: seat,
    };
  }

  if (room.status !== 'waiting')
    throw new RoomError('Permainan sudah dimulai', 409);
  const free = room.tokens.indexOf(null);
  if (free === -1) throw new RoomError('Room sudah penuh', 409);

  const tokens = [...room.tokens];
  tokens[free] = newToken;
  const names = [...namesOf(room)];
  names[free] = cleanName(name);
  let next: Room = { ...room, tokens, names, version: room.version + 1 };
  // an empty room (everyone left) has no admin: the newcomer becomes it
  if (!room.tokens[hostOf(room)]) next = { ...next, host: free, hostAt: now };
  if (GAMES[room.game].autoStart && tokens.every(Boolean))
    next = begin(next, rng, now);
  return { room: next, token: newToken, you: free };
}

/** A player is back: cancel their leaving. */
export function revive(room: Room, seat: number): Room {
  const left = leftOf(room);
  if (left[seat] === null) return room;
  return {
    ...room,
    left: put(left, seat, null),
    version: room.version + 1,
  };
}

const requireHost = (room: Room, token: unknown, what: string) => {
  const seat = seatOf(room, token);
  if (seat === null || seat !== hostOf(room))
    throw new RoomError(`Hanya admin room yang bisa ${what}`, 403);
  return seat;
};

/** The admin starts games that wait for a variable number of players. */
export function start(
  room: Room,
  token: unknown,
  rng?: () => number,
  now = Date.now(),
): Room {
  requireHost(room, token, 'memulai');
  if (room.status !== 'waiting')
    throw new RoomError('Permainan sudah dimulai', 409);
  const { minPlayers } = GAMES[room.game];
  if (seated(room) < minPlayers) {
    throw new RoomError(`Butuh minimal ${minPlayers} pemain`, 409);
  }
  return begin(room, rng, now);
}

export function act(
  room: Room,
  token: unknown,
  move: unknown,
  rng?: () => number,
  now = Date.now(),
): Room {
  const seat = seatOf(room, token);
  if (seat === null) throw new RoomError('Kamu bukan pemain di room ini', 403);
  if (outOf(room)[seat])
    throw new RoomError('Kamu sudah dikeluarkan dari permainan', 403);
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
    // playing again means they are back
    left: put(leftOf(room), seat, null),
    stamp: now,
    version: room.version + 1,
  };
}

/** Changes the display name of the token's seat. */
export function rename(room: Room, token: unknown, name: unknown): Room {
  const seat = seatOf(room, token);
  if (seat === null) throw new RoomError('Kamu bukan pemain di room ini', 403);
  const names = [...namesOf(room)];
  const clean = cleanName(name);
  if (names[seat] === clean) return room;
  names[seat] = clean;
  return { ...room, names, version: room.version + 1 };
}

/**
 * The player pressed "keluar" (or closed the page). Before a game, or after it,
 * the seat is simply freed. In the middle of a game they get a short grace to
 * come back before they are taken out of it. Leaving twice changes nothing.
 */
export function leaveRoom(room: Room, token: unknown, now = Date.now()): Room {
  const seat = seatOf(room, token);
  if (seat === null) return room;
  if (room.status === 'playing' && !outOf(room)[seat]) {
    const left = leftOf(room);
    if (left[seat] !== null) return room;
    return { ...room, left: put(left, seat, now), version: room.version + 1 };
  }
  return removeSeat(room, seat, now);
}

/**
 * The admin removes another player. Before or after a game that frees the
 * seat; in the middle of one the player is taken out of the game and the others
 * carry on (or the last one wins).
 */
export function kick(
  room: Room,
  token: unknown,
  seat: unknown,
  rng?: () => number,
  now = Date.now(),
): Room {
  const host = requireHost(room, token, 'mengeluarkan pemain');
  if (
    !Number.isInteger(seat) ||
    (seat as number) < 0 ||
    (seat as number) >= room.tokens.length
  ) {
    throw new RoomError('Pemain tidak ada', 400);
  }
  const target = seat as number;
  if (target === host)
    throw new RoomError('Admin tidak bisa mengeluarkan dirinya sendiri', 400);
  if (!room.tokens[target]) return room; // seat already empty

  if (room.status === 'playing' && !outOf(room)[target]) {
    return eliminate(room, target, rng, now, 'kicked');
  }
  return removeSeat(room, target, now);
}

/** Starts another round once one has ended. */
export function rematch(
  room: Room,
  token: unknown,
  rng?: () => number,
  now = Date.now(),
): Room {
  const seat = seatOf(room, token);
  if (seat === null) throw new RoomError('Kamu bukan pemain di room ini', 403);
  if (outOf(room)[seat])
    throw new RoomError('Kamu sudah dikeluarkan dari permainan', 403);
  // a second click after the first already restarted: nothing to do
  if (room.status !== 'over') return room;

  // players who were removed during the game do not come back for the next one
  const out = outOf(room);
  const tidy = compact({
    ...room,
    tokens: room.tokens.map((t, i) => (out[i] ? null : t)),
  });
  const n0 = tidy.tokens.length;
  const next: Room = {
    ...tidy,
    out: Array<boolean>(n0).fill(false),
    strikes: Array<number>(n0).fill(0),
    left: Array<number | null>(n0).fill(null),
    why: Array<OutWhy | null>(n0).fill(null),
    stamp: now,
    version: room.version + 1,
  };

  const def = GAMES[room.game];
  const n = seated(next);
  // too few left to play (or a fixed-size game missing someone): wait for more
  if (n < def.minPlayers || (def.autoStart && n < def.maxPlayers)) {
    return { ...next, status: 'waiting', state: null };
  }
  return { ...next, status: 'playing', state: def.restart(room.state, n, rng) };
}

/** Takes a player out of the running game; the others carry on, or win. */
export function eliminate(
  room: Room,
  seat: number,
  rng?: () => number,
  now = Date.now(),
  why: OutWhy = 'left',
): Room {
  const out = [...outOf(room)];
  if (room.status !== 'playing' || out[seat] || !room.tokens[seat]) return room;
  out[seat] = true;
  const def = GAMES[room.game];
  const state = def.eliminate
    ? def.eliminate(room.state, seat, rng)
    : room.state;
  const next: Room = {
    ...room,
    out,
    why: put(whyOf(room), seat, why),
    left: put(leftOf(room), seat, null),
    state,
    status: def.isOver(state) ? 'over' : 'playing',
    stamp: now,
    version: room.version + 1,
  };
  // someone who is out cannot be the admin
  return seat === hostOf(room) ? handOverHost(next, now) : next;
}

/** Plays for a seat until the game stops waiting for it (or nothing can be played). */
function autoplay(room: Room, seat: number, rng?: () => number): unknown {
  const def = GAMES[room.game];
  let state = room.state;
  for (let i = 0; i < 4; i++) {
    const waiting = def.waiting?.(state);
    if (!waiting || !waiting.seats.includes(seat)) break;
    const move = def.autoMove?.(state, seat, rng);
    if (move == null) break;
    try {
      state = def.move(state, seat, move, rng);
    } catch {
      break;
    }
  }
  return state;
}

/** A missed turn: a strike and a forced move, and out after the last strike. */
function penalize(
  room: Room,
  seat: number,
  rng: (() => number) | undefined,
  now: number,
): Room {
  const strikes = [...strikesOf(room)];
  strikes[seat] += 1;
  const marked = { ...room, strikes };
  if (strikes[seat] >= MAX_STRIKES)
    return eliminate(marked, seat, rng, now, 'idle');

  const def = GAMES[room.game];
  const state = autoplay(room, seat, rng);
  return {
    ...marked,
    state,
    status: def.isOver(state) ? 'over' : 'playing',
    stamp: now,
    version: room.version + 1,
  };
}

/**
 * Applies what time has done to a running game, with no one having to report
 * it: players who pressed "keluar" and did not come back within the grace are
 * taken out, and a player who sat on their turn too long gets a strike and a
 * forced move. Returns `room` itself when nothing has to change, so it is cheap
 * to ask on every poll.
 */
export function sweep(room: Room, now = Date.now(), rng?: () => number): Room {
  if (room.status !== 'playing') return room;

  let next = room;
  const left = leftOf(room);
  for (let seat = 0; seat < room.tokens.length; seat++) {
    if (next.status !== 'playing') break;
    const at = left[seat];
    if (at !== null && now - at > LEAVE_GRACE_MS) {
      next = eliminate(next, seat, rng, now, 'left');
    }
  }
  if (next.status !== 'playing') return next;

  const waiting = GAMES[next.game].waiting?.(next.state);
  if (waiting && now - stampOf(next) > waiting.seconds * 1000) {
    for (const seat of waiting.seats) {
      if (next.status !== 'playing') break;
      if (!outOf(next)[seat]) next = penalize(next, seat, rng, now);
    }
  }
  return next;
}

/** The only way a room reaches a client: shaped for one viewer. */
export function toView(
  room: Room,
  token?: unknown,
  now = Date.now(),
): RoomView {
  const seat = seatOf(room, token);
  const def = GAMES[room.game];
  const waiting =
    room.status === 'playing' && room.state !== null
      ? def.waiting?.(room.state)
      : null;
  const out = outOf(room);
  return {
    code: room.code,
    game: room.game,
    status: room.status,
    seat,
    joined: room.tokens.map(Boolean),
    names: namesOf(room),
    capacity: room.tokens.length,
    minPlayers: def.minPlayers,
    version: room.version,
    state: room.state === null ? null : def.view(room.state, seat),
    out,
    outWhy: whyOf(room),
    strikes: strikesOf(room),
    maxStrikes: MAX_STRIKES,
    host: hostOf(room),
    hostNotice: room.hostAt
      ? Math.max(0, Math.ceil((room.hostAt + HOST_NOTICE_MS - now) / 1000))
      : 0,
    leaving: leftOf(room).flatMap((at, s) =>
      at !== null && room.tokens[s] && !out[s]
        ? [
            {
              seat: s,
              goneIn: Math.max(
                0,
                Math.ceil((LEAVE_GRACE_MS - (now - at)) / 1000),
              ),
            },
          ]
        : [],
    ),
    waiting: waiting
      ? {
          seats: waiting.seats,
          seconds: waiting.seconds,
          remaining: Math.max(
            0,
            Math.ceil((stampOf(room) + waiting.seconds * 1000 - now) / 1000),
          ),
        }
      : null,
  };
}
