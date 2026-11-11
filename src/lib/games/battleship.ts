import type { GameDef } from '@/lib/rooms/game';
import { RoomError } from '@/lib/rooms/types';

export const SIZE = 10;
/** Ship lengths every player must place. */
export const FLEET = [5, 4, 3, 3, 2] as const;

export interface Ship {
  x: number;
  y: number;
  len: number;
  horizontal: boolean;
}

export interface Shot {
  x: number;
  y: number;
  hit: boolean;
}

export const shipCells = (ship: Ship) =>
  Array.from({ length: ship.len }, (_, i) => ({
    x: ship.x + (ship.horizontal ? i : 0),
    y: ship.y + (ship.horizontal ? 0 : i),
  }));

const key = (x: number, y: number) => `${x},${y}`;

/** Right lengths, inside the board, no two ships on the same cell. */
export function validFleet(ships: unknown): ships is Ship[] {
  if (!Array.isArray(ships) || ships.length !== FLEET.length) return false;
  const used = new Set<string>();
  for (const s of ships as Ship[]) {
    if (
      !s ||
      !Number.isInteger(s.x) ||
      !Number.isInteger(s.y) ||
      !Number.isInteger(s.len) ||
      typeof s.horizontal !== 'boolean'
    )
      return false;
    for (const c of shipCells(s)) {
      if (c.x < 0 || c.y < 0 || c.x >= SIZE || c.y >= SIZE) return false;
      if (used.has(key(c.x, c.y))) return false;
      used.add(key(c.x, c.y));
    }
  }
  const lens = (ships as Ship[]).map((s) => s.len).sort();
  return lens.join() === [...FLEET].sort().join();
}

export function randomFleet(rng: () => number = Math.random): Ship[] {
  for (;;) {
    const used = new Set<string>();
    const ships: Ship[] = [];
    let ok = true;
    for (const len of FLEET) {
      let placed = false;
      for (let tries = 0; tries < 200 && !placed; tries++) {
        const horizontal = rng() < 0.5;
        const ship = {
          len,
          horizontal,
          x: Math.floor(rng() * (SIZE - (horizontal ? len - 1 : 0))),
          y: Math.floor(rng() * (SIZE - (horizontal ? 0 : len - 1))),
        };
        const cells = shipCells(ship);
        if (cells.every((c) => !used.has(key(c.x, c.y)))) {
          cells.forEach((c) => used.add(key(c.x, c.y)));
          ships.push(ship);
          placed = true;
        }
      }
      if (!placed) ok = false;
    }
    if (ok) return ships;
  }
}

export interface BattleshipState {
  fleets: [Ship[] | null, Ship[] | null];
  /** shots[i] are the shots seat i fired at the other player */
  shots: [Shot[], Shot[]];
  phase: 'placing' | 'battle';
  turn: 0 | 1;
  winner: 0 | 1 | null;
  last: {
    seat: number;
    x: number;
    y: number;
    hit: boolean;
    sunk: number;
  } | null;
}

export interface BattleshipView {
  phase: BattleshipState['phase'];
  turn: 0 | 1;
  winner: 0 | 1 | null;
  mine: Ship[] | null;
  opponentReady: boolean;
  /** Shots I fired (hit/miss) */
  myShots: Shot[];
  /** Shots the opponent fired at me */
  incoming: Shot[];
  /** Enemy ships that are fully sunk, or all of them once the game ends */
  revealed: Ship[];
  last: BattleshipState['last'];
}

const fresh = (): BattleshipState => ({
  fleets: [null, null],
  shots: [[], []],
  phase: 'placing',
  turn: 0,
  winner: null,
  last: null,
});

const isSunk = (ship: Ship, shots: Shot[]) =>
  shipCells(ship).every((c) =>
    shots.some((s) => s.hit && s.x === c.x && s.y === c.y),
  );

export const battleshipGame: GameDef<BattleshipState> = {
  id: 'battleship',
  minPlayers: 2,
  maxPlayers: 2,
  autoStart: true,

  start: fresh,
  restart: fresh,

  move(state, seat, move, rng = Math.random) {
    const m = move as {
      type?: string;
      ships?: unknown;
      x?: unknown;
      y?: unknown;
    } | null;

    if (m?.type === 'place') {
      if (state.phase !== 'placing')
        throw new RoomError('Pertempuran sudah dimulai', 409);
      if (state.fleets[seat]) throw new RoomError('Armadamu sudah siap', 409);
      if (!validFleet(m.ships))
        throw new RoomError('Susunan kapal tidak valid');

      const fleets = [...state.fleets] as BattleshipState['fleets'];
      fleets[seat] = (m.ships as Ship[]).map((s) => ({
        x: s.x,
        y: s.y,
        len: s.len,
        horizontal: s.horizontal,
      }));
      const ready = fleets[0] && fleets[1];
      return {
        ...state,
        fleets,
        phase: ready ? 'battle' : 'placing',
        turn: ready ? (rng() < 0.5 ? 0 : 1) : state.turn,
      };
    }

    if (m?.type === 'fire') {
      if (state.phase !== 'battle')
        throw new RoomError('Pertempuran belum dimulai', 409);
      if (state.turn !== seat) throw new RoomError('Bukan giliranmu', 409);
      const { x, y } = m;
      if (
        typeof x !== 'number' ||
        typeof y !== 'number' ||
        !Number.isInteger(x) ||
        !Number.isInteger(y) ||
        x < 0 ||
        y < 0 ||
        x >= SIZE ||
        y >= SIZE
      )
        throw new RoomError('Koordinat tidak valid');
      if (state.shots[seat].some((s) => s.x === x && s.y === y))
        throw new RoomError('Petak itu sudah ditembak', 409);

      const enemy = state.fleets[1 - seat]!;
      const hit = enemy.some((s) =>
        shipCells(s).some((c) => c.x === x && c.y === y),
      );
      const shots = [...state.shots] as BattleshipState['shots'];
      shots[seat] = [...shots[seat], { x, y, hit }];

      const sunkShip = hit
        ? enemy.find(
            (s) =>
              shipCells(s).some((c) => c.x === x && c.y === y) &&
              isSunk(s, shots[seat]),
          )
        : undefined;
      const allSunk = enemy.every((s) => isSunk(s, shots[seat]));

      return {
        ...state,
        shots,
        winner: allSunk ? (seat as 0 | 1) : null,
        turn: (1 - seat) as 0 | 1,
        last: { seat, x, y, hit, sunk: sunkShip?.len ?? 0 },
      };
    }

    throw new RoomError('Aksi tidak dikenal');
  },

  waiting(state) {
    if (state.winner !== null) return null;
    if (state.phase === 'placing') {
      const seats = [0, 1].filter((s) => !state.fleets[s]);
      return seats.length ? { seats, seconds: 90 } : null;
    }
    return { seats: [state.turn], seconds: 60 };
  },

  autoMove(state, seat, rng = Math.random) {
    if (state.phase === 'placing') {
      return { type: 'place', ships: randomFleet(rng) };
    }
    const fired = new Set(state.shots[seat].map((s) => key(s.x, s.y)));
    const free: { x: number; y: number }[] = [];
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++)
        if (!fired.has(key(x, y))) free.push({ x, y });
    if (!free.length) return null;
    return { type: 'fire', ...free[Math.floor(rng() * free.length)] };
  },

  eliminate: (state, seat) => ({ ...state, winner: (1 - seat) as 0 | 1 }),

  view(state, seat): BattleshipView {
    const me = seat ?? 0;
    const enemy = state.fleets[1 - me];
    const done = state.winner !== null;
    return {
      phase: state.phase,
      turn: state.turn,
      winner: state.winner,
      mine: state.fleets[me],
      opponentReady: !!state.fleets[1 - me],
      myShots: state.shots[me],
      incoming: state.shots[1 - me],
      revealed: enemy
        ? enemy.filter((s) => done || isSunk(s, state.shots[me]))
        : [],
      last: state.last,
    };
  },

  isOver: (state) => state.winner !== null,
};
