import { Hit, hitAt, Ring, SHOTS } from '@/lib/games/dart-board';
import {
  CRICKET,
  DartConfig,
  DEFAULT_DART,
  sanitizeDart,
} from '@/lib/games/dart-config';
import type { GameDef } from '@/lib/rooms/game';
import { RoomError } from '@/lib/rooms/types';

export * from '@/lib/games/dart-config';

/**
 * Darts for one to four players: 301/501, Count Up, Around the Clock and
 * Cricket on the same board. The server decides where a dart lands: it takes
 * the point the player aimed at and adds a spread that depends on the throwing
 * mode, so what you aim at matters, but you cannot place a dart exactly by
 * lying about where it went.
 */

export const DARTS_PER_TURN = 3;

/** How far a dart strays from where it was aimed (a standard deviation, in board units). */
const SPREAD = {
  casual: 0.012,
  /** Perfect timing leaves this much, the worst timing adds `skillRange` on top */
  skillBase: 0.02,
  skillRange: 0.085,
};
const DIFFICULTY_FACTOR = { easy: 0.6, normal: 1, hard: 1.6 } as const;

export interface Throw {
  /** Where it landed */
  x: number;
  y: number;
  /** Where the player aimed */
  aimX: number;
  aimY: number;
  ring: Ring;
  number: number | null;
  /** What the dart is worth where it landed */
  points: number;
  label: string;
  /** Counts up through the game, so clients can animate the newest dart */
  seq: number;
  /** What it did to the score: points off, points on, marks, a target reached */
  counted: number;
  note?: string;
}

export type TurnResult = 'ok' | 'bust' | 'checkout' | 'win';

export interface Turn {
  seat: number;
  round: number;
  throws: Throw[];
  total: number;
  result: TurnResult;
  before: number;
  after: number;
}

export interface Stat {
  darts: number;
  points: number;
  bestTurn: number;
  busts: number;
}

export interface DartState {
  config: DartConfig;
  players: number;
  turn: number;
  round: number;
  /** The darts in the board right now */
  throws: Throw[];
  /** The turn is over (three darts, a bust or a win) and waits for "next player" */
  turnDone: boolean;
  turnResult: TurnResult | null;
  /** The score at the start of this turn, to go back to after a bust */
  turnStart: number;
  /** 301/501: points left. Count Up: total. Clock: the target. Cricket: points. */
  scores: number[];
  /** Cricket marks on 20, 19, 18, 17, 16, 15 and the bull, per player */
  marks: number[][];
  history: Turn[];
  stats: Stat[];
  dropped: number[];
  seq: number;
  startedAt: number;
  endedAt: number | null;
  over: boolean;
  winner: number | null;
  tie: number[];
  endReason: 'checkout' | 'finished' | 'rounds' | 'left' | null;
}

export interface DartView extends DartState {
  you: number | null;
  /** A way to finish from where the current player stands (301/501) */
  checkout: string[] | null;
  /** Seats best to worst, once the game is over */
  ranking: number[];
  /** Seconds the game has run, as the server counts them */
  elapsed: number;
}

// -------------------------------------------------------------------- throws

/** A normal random number (Box-Muller), from the room's random source. */
function gauss(rng: () => number) {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * The spread of a throw. In casual play it is small and fixed. In skill play
 * it depends on timing (`power` from 0, badly timed, to 1, perfectly timed).
 */
export function spreadFor(config: DartConfig, power: number | undefined) {
  const factor = DIFFICULTY_FACTOR[config.difficulty];
  if (config.throwMode === 'casual') return SPREAD.casual * factor;
  const quality = Math.min(1, Math.max(0, power ?? 0.3));
  return (SPREAD.skillBase + (1 - quality) * SPREAD.skillRange) * factor;
}

/** Where a dart aimed at (aimX, aimY) ends up. */
export function land(
  aimX: number,
  aimY: number,
  config: DartConfig,
  power: number | undefined,
  rng: () => number,
) {
  const sigma = spreadFor(config, power);
  return { x: aimX + gauss(rng) * sigma, y: aimY + gauss(rng) * sigma };
}

// ------------------------------------------------------------------ helpers

const isIn = (s: DartState, seat: number) => !s.dropped.includes(seat);
const active = (s: DartState) =>
  Array.from({ length: s.players }, (_, i) => i).filter((i) => isIn(s, i));

/** A hit on a double (or the inner bull) is a valid finish. */
export const isDouble = (hit: Hit) =>
  hit.ring === 'double' || hit.ring === 'ibull';

/** The cricket target index a hit counts toward, or -1. */
function cricketIndex(hit: Hit) {
  if (hit.ring === 'ibull' || hit.ring === 'obull') return 6;
  return hit.number === null
    ? -1
    : (CRICKET as readonly number[]).indexOf(hit.number);
}

/** Marks a hit is worth in Cricket: single 1, double 2, triple 3, outer bull 1, inner bull 2. */
const marksOf = (hit: Hit) => (hit.multiplier === 0 ? 0 : hit.multiplier);

export function start(
  players: number,
  _rng?: () => number,
  options?: unknown,
): DartState {
  const config = sanitizeDart(options);
  const scores = Array.from({ length: players }, () => {
    if (config.mode === '301' || config.mode === '501')
      return config.startScore;
    if (config.mode === 'clock') return 1;
    return 0;
  });
  return {
    config,
    players,
    turn: 0,
    round: 1,
    throws: [],
    turnDone: false,
    turnResult: null,
    turnStart: scores[0],
    scores,
    marks: Array.from({ length: players }, () => Array(CRICKET.length).fill(0)),
    history: [],
    stats: Array.from({ length: players }, () => ({
      darts: 0,
      points: 0,
      bestTurn: 0,
      busts: 0,
    })),
    dropped: [],
    seq: 0,
    startedAt: Date.now(),
    endedAt: null,
    over: false,
    winner: null,
    tie: [],
    endReason: null,
  };
}

const x01 = (c: DartConfig) => c.mode === '301' || c.mode === '501';

/** Best to worst. */
export function ranking(s: DartState): number[] {
  const seats = Array.from({ length: s.players }, (_, i) => i).filter((i) =>
    isIn(s, i),
  );
  const m = s.config.mode;
  const closed = (i: number) => s.marks[i].filter((n) => n >= 3).length;
  const key = (i: number): number => {
    if (x01(s.config)) return s.winner === i ? -Infinity : s.scores[i];
    if (m === 'clock') return -s.scores[i];
    if (m === 'cricket') return -(s.scores[i] + closed(i) * 0.001);
    return -s.scores[i];
  };
  const order = [...seats].sort((a, b) => key(a) - key(b));
  if (s.winner !== null && order[0] !== s.winner) {
    return [s.winner, ...order.filter((i) => i !== s.winner), ...s.dropped];
  }
  return [...order, ...s.dropped];
}

function end(
  s: DartState,
  reason: NonNullable<DartState['endReason']>,
  winner: number | null,
) {
  s.over = true;
  s.endReason = reason;
  s.endedAt = Date.now();
  if (winner !== null) {
    s.winner = winner;
  } else {
    // decided on points: the best total, and a tie says so
    const order = ranking(s);
    s.winner = order[0] ?? null;
    const top = s.winner;
    if (top !== null) {
      const same = (i: number) =>
        s.scores[i] === s.scores[top] &&
        (s.config.mode !== 'cricket' ||
          s.marks[i].filter((n) => n >= 3).length ===
            s.marks[top].filter((n) => n >= 3).length);
      s.tie = order.filter(same).length > 1 ? order.filter(same) : [];
    }
  }
}

/** Applies one landed dart to the score, and returns the result for the turn. */
function score(
  s: DartState,
  seat: number,
  hit: Hit,
  t: Throw,
): TurnResult | null {
  const c = s.config;

  if (x01(c)) {
    const before = s.scores[seat];
    const after = before - hit.points;
    const bust =
      after < 0 ||
      (c.doubleOut && after === 1) ||
      (after === 0 && c.doubleOut && !isDouble(hit));
    if (bust) {
      t.note = 'bust';
      t.counted = 0;
      s.scores[seat] = s.turnStart;
      return 'bust';
    }
    s.scores[seat] = after;
    t.counted = hit.points;
    if (after === 0) {
      t.note = 'checkout';
      return 'win';
    }
    return null;
  }

  if (c.mode === 'countup') {
    s.scores[seat] += hit.points;
    t.counted = hit.points;
    return null;
  }

  if (c.mode === 'clock') {
    const target = s.scores[seat];
    const reached =
      target <= 20
        ? hit.number === target
        : hit.ring === 'ibull' || hit.ring === 'obull';
    if (!reached) return null;
    t.counted = 1;
    t.note = 'target';
    s.scores[seat] = target + 1;
    const last = c.clockBull ? 21 : 20;
    return s.scores[seat] > last ? 'win' : null;
  }

  // cricket
  const i = cricketIndex(hit);
  if (i === -1) return null;
  const value = CRICKET[i];
  const others = active(s).filter((p) => p !== seat);
  let gained = 0;
  let added = 0;
  for (let m = 0; m < marksOf(hit); m++) {
    if (s.marks[seat][i] < 3) {
      s.marks[seat][i] += 1;
      added += 1;
    } else if (others.length === 0 || others.some((p) => s.marks[p][i] < 3)) {
      gained += value;
    }
  }
  s.scores[seat] += gained;
  t.counted = gained;
  if (added || gained)
    t.note = added ? `${added} mark${added > 1 ? 's' : ''}` : 'points';
  const allClosed = s.marks[seat].every((n) => n >= 3);
  const mine = s.scores[seat];
  const lead = others.every((p) => mine >= s.scores[p]);
  return allClosed && lead ? 'win' : null;
}

function finishTurn(s: DartState, seat: number, result: TurnResult) {
  const total = s.throws.reduce((a, t) => a + t.counted, 0);
  s.turnDone = true;
  s.turnResult = result;
  const st = s.stats[seat];
  st.darts += s.throws.length;
  if (x01(s.config)) {
    if (result !== 'bust') {
      st.points += s.turnStart - s.scores[seat];
      st.bestTurn = Math.max(st.bestTurn, s.turnStart - s.scores[seat]);
    } else st.busts += 1;
  } else if (s.config.mode === 'countup') {
    st.points += total;
    st.bestTurn = Math.max(st.bestTurn, total);
  } else if (s.config.mode === 'cricket') {
    st.points += total;
    st.bestTurn = Math.max(st.bestTurn, total);
  }
  s.history.push({
    seat,
    round: s.round,
    throws: s.throws,
    total: x01(s.config) && result === 'bust' ? 0 : total,
    result,
    before: s.turnStart,
    after: s.scores[seat],
  });
  if (s.history.length > 60) s.history.shift();
}

function nextPlayer(s: DartState) {
  const seats = active(s);
  const at = seats.indexOf(s.turn);
  const wrapped = at === seats.length - 1;
  const next = seats[(at + 1) % seats.length] ?? s.turn;
  if (wrapped) {
    s.round += 1;
    const c = s.config;
    if (c.mode === 'countup' && s.round > c.rounds) {
      end(s, 'rounds', null);
      return;
    }
    if (c.maxRounds && s.round > c.maxRounds && !s.over) {
      end(s, 'rounds', null);
      return;
    }
  }
  s.turn = next;
  s.throws = [];
  s.turnDone = false;
  s.turnResult = null;
  s.turnStart = s.scores[next];
}

function doThrow(
  s: DartState,
  seat: number,
  move: { x: unknown; y: unknown; power?: unknown },
  rng: () => number,
) {
  if (s.turnDone) throw new RoomError('End your turn first', 409);
  if (s.throws.length >= DARTS_PER_TURN)
    throw new RoomError('No darts left', 409);
  const ax = Number(move.x);
  const ay = Number(move.y);
  if (!Number.isFinite(ax) || !Number.isFinite(ay)) {
    throw new RoomError('Aim at the board', 400);
  }
  // nobody can aim further off than the room around the board
  const aimX = Math.max(-1.6, Math.min(1.6, ax));
  const aimY = Math.max(-1.6, Math.min(1.6, ay));
  const power = typeof move.power === 'number' ? move.power : undefined;
  const at = land(aimX, aimY, s.config, power, rng);
  const hit = hitAt(at.x, at.y);

  const t: Throw = {
    x: at.x,
    y: at.y,
    aimX,
    aimY,
    ring: hit.ring,
    number: hit.number,
    points: hit.points,
    label: hit.label,
    seq: ++s.seq,
    counted: 0,
  };
  s.throws.push(t);
  const result = score(s, seat, hit, t);

  if (result === 'win') {
    finishTurn(s, seat, 'win');
    end(
      s,
      s.config.mode === 'clock' || s.config.mode === 'cricket'
        ? 'finished'
        : 'checkout',
      seat,
    );
    return;
  }
  if (result === 'bust') {
    finishTurn(s, seat, 'bust');
    return;
  }
  if (s.throws.length === DARTS_PER_TURN) finishTurn(s, seat, 'ok');
}

// ---------------------------------------------------------------- finishes

/**
 * Up to three darts that take `left` to zero, if there is a way: the highest
 * scores first, ending on a double when the rules ask for one.
 */
export function suggestCheckout(
  left: number,
  darts: number,
  doubleOut: boolean,
): string[] | null {
  if (left < 1 || left > 170 || darts < 1) return null;
  const finishes = (rem: number, k: number): string[] | null => {
    // the last dart
    for (const shot of [...SHOTS].reverse()) {
      if (shot.points === rem && (!doubleOut || shot.double))
        return [shot.label];
    }
    if (k <= 1) return null;
    for (const shot of SHOTS) {
      if (shot.points >= rem - (doubleOut ? 1 : 0)) continue;
      const rest = finishes(rem - shot.points, k - 1);
      if (rest) return [shot.label, ...rest];
    }
    return null;
  };
  return finishes(left, darts);
}

// ------------------------------------------------------------------- the game

export const dartGame: GameDef<DartState> = {
  id: 'dart',
  minPlayers: 1,
  maxPlayers: 4,
  autoStart: false,
  defaultOptions: DEFAULT_DART,
  sanitizeOptions: sanitizeDart,

  start,
  restart: (previous, players, rng) => start(players, rng, previous.config),

  move(state, seat, raw, rng = Math.random) {
    if (state.over) throw new RoomError('The match is over', 409);
    const move = raw as {
      type?: string;
      x?: unknown;
      y?: unknown;
      power?: unknown;
    } | null;
    if (!move || typeof move !== 'object')
      throw new RoomError('Invalid move', 400);
    if (state.turn !== seat) throw new RoomError('Not your turn', 409);

    const s = structuredClone(state);
    switch (move.type) {
      case 'throw':
        doThrow(s, seat, move as never, rng);
        break;
      case 'next':
        if (!s.turnDone) throw new RoomError('Your turn is not over yet', 409);
        nextPlayer(s);
        break;
      default:
        throw new RoomError('Unknown move', 400);
    }
    return s;
  },

  waiting: (state) =>
    state.over ? null : { seats: [state.turn], seconds: 45 },

  // an idle player's dart misses the board, and their turn ends
  autoMove: (state) =>
    state.turnDone ? { type: 'next' } : { type: 'throw', x: 3, y: 3 },

  eliminate(state, seat) {
    if (!isIn(state, seat) || state.over) return state;
    const s = structuredClone(state);
    s.dropped.push(seat);
    const left = active(s);
    if (left.length === 0) {
      end(s, 'left', null);
    } else if (left.length === 1 && s.players > 1) {
      end(s, 'left', left[0]);
    } else if (s.turn === seat) {
      if (!s.turnDone) {
        s.turnDone = true;
        s.scores[seat] = s.turnStart;
      }
      // hand the turn over without counting the leaver's darts
      const seats = left;
      const after = seats.find((i) => i > seat) ?? seats[0];
      if (after <= seat) s.round += 1;
      s.turn = after;
      s.throws = [];
      s.turnDone = false;
      s.turnResult = null;
      s.turnStart = s.scores[after];
    }
    return s;
  },

  view(state, seat): DartView {
    const left = DARTS_PER_TURN - state.throws.length;
    return {
      ...state,
      you: seat,
      checkout:
        x01(state.config) && !state.over && !state.turnDone
          ? suggestCheckout(
              state.scores[state.turn],
              left,
              state.config.doubleOut,
            )
          : null,
      ranking: state.over ? ranking(state) : [],
      elapsed: Math.max(
        0,
        Math.floor(((state.endedAt ?? Date.now()) - state.startedAt) / 1000),
      ),
    };
  },

  isOver: (state) => state.over,
};
