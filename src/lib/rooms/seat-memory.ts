import type { GameId } from '@/lib/rooms/types';

/**
 * A player's seat is a secret token. If the page forgets it (the player left by
 * accident, or closed the tab), joining the same room again would take a second
 * seat as if they were someone new. So the token is remembered per room, and
 * reused when the same player comes back.
 *
 * Two tabs of one browser can be two players, so a token is only reused when no
 * other open tab is still holding that seat (see `holdSeat`).
 */

const KEEP = 8;

interface Remembered {
  token: string;
  you: number;
  at: number;
}

const key = (game: GameId) => `room-seats-${game}`;

/** Every seat this browser has held, per room: two tabs can sit in one room. */
function read(game: GameId): Record<string, Remembered[]> {
  try {
    const parsed = JSON.parse(localStorage.getItem(key(game)) ?? '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function write(game: GameId, all: Record<string, Remembered[]>) {
  // keep the newest few rooms; rooms only live a couple of hours anyway
  const newest = Object.entries(all)
    .filter(([, seats]) => Array.isArray(seats) && seats.length > 0)
    .sort(
      (a, b) =>
        Math.max(...b[1].map((s) => s.at)) - Math.max(...a[1].map((s) => s.at)),
    )
    .slice(0, KEEP);
  localStorage.setItem(key(game), JSON.stringify(Object.fromEntries(newest)));
}

export function rememberSeat(
  game: GameId,
  code: string,
  seat: { token: string; you: number },
) {
  try {
    const all = read(game);
    const others = (all[code] ?? []).filter((s) => s.token !== seat.token);
    all[code] = [
      ...others,
      { token: seat.token, you: seat.you, at: Date.now() },
    ];
    write(game, all);
  } catch {
    // storage unavailable or full: rejoining just becomes a new seat
  }
}

export function forgetSeat(game: GameId, code: string) {
  try {
    const all = read(game);
    delete all[code];
    write(game, all);
  } catch {
    // nothing to forget
  }
}

const lockName = (token: string) => `room-seat:${token}`;

/** Whether another open tab is currently playing with this token. */
async function heldElsewhere(token: string) {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  if (!locks?.query) return false; // very old browser: assume a single tab
  try {
    const { held } = await locks.query();
    return !!held?.some((l) => l.name === lockName(token));
  } catch {
    return false;
  }
}

/**
 * The token to rejoin `code` with: a seat this browser held before that no other
 * open tab is using. With several to choose from, the most recent one wins.
 */
export async function recallSeat(
  game: GameId,
  code: string,
): Promise<{ token: string; you: number } | null> {
  const seats = [...(read(game)[code] ?? [])].sort((a, b) => b.at - a.at);
  for (const seat of seats) {
    if (!(await heldElsewhere(seat.token))) {
      return { token: seat.token, you: seat.you };
    }
  }
  return null;
}

/**
 * Marks this tab as the one using `token`, for as long as it stays open.
 * Returns a function that lets go (when the player leaves the room).
 */
export function holdSeat(token: string): () => void {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  if (!locks?.request) return () => {};
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  // the lock is held until `release` runs, or until the tab goes away
  locks.request(lockName(token), () => held).catch(() => {});
  return release;
}
