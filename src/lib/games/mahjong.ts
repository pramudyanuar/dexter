import { LayoutId, layoutPositions, Pos } from '@/lib/games/mahjong-layouts';
import {
  allPairs,
  canMatch,
  DEFAULT_MATCH,
  matchClass,
  MatchRules,
  shuffled,
} from '@/lib/games/mahjong-tiles';

/**
 * Mahjong Solitaire: clear the board by matching pairs of free tiles.
 *
 * A tile is free when nothing lies on top of it and at least one of its left
 * and right sides is open. Boards are never just shuffled: they are built by
 * playing the game backwards (taking two free tiles at a time and giving them a
 * matching pair), so every board has at least one way to be cleared.
 */

export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

export interface Scoring {
  match: number;
  /** Extra for each match in a row, on top of the one before */
  combo: number;
  comboCap: number;
  complete: number;
  hint: number;
  shuffle: number;
  undo: number;
}

export interface MahjongRules extends MatchRules {
  shuffleEnabled: boolean;
  hintLimit: number;
  shuffleLimit: number;
  undoLimit: number;
  /** Matches closer together than this are "in a row" */
  comboWindowMs: number;
  scoring: Scoring;
}

export const SCORING: Scoring = {
  match: 100,
  combo: 25,
  comboCap: 8,
  complete: 1000,
  hint: 50,
  shuffle: 100,
  undo: 25,
};

export const BASE_RULES: MahjongRules = {
  ...DEFAULT_MATCH,
  shuffleEnabled: true,
  hintLimit: 5,
  shuffleLimit: 3,
  undoLimit: 99,
  comboWindowMs: 6000,
  scoring: SCORING,
};

/** What each difficulty changes. */
export const DIFFICULTY: Record<
  Difficulty,
  { rules: Partial<MahjongRules>; layout: LayoutId; pairing: Pairing }
> = {
  easy: {
    rules: { hintLimit: 10, shuffleLimit: 5, comboWindowMs: 9000 },
    layout: 'pyramid',
    pairing: 'near',
  },
  medium: { rules: {}, layout: 'turtle', pairing: 'random' },
  hard: {
    rules: { hintLimit: 3, shuffleLimit: 1, undoLimit: 5, comboWindowMs: 4000 },
    layout: 'spider',
    pairing: 'far',
  },
};

/** How the board builder picks the second tile of each pair. */
export type Pairing = 'near' | 'random' | 'far';

export const rulesFor = (
  difficulty: Difficulty,
  extra: Partial<MahjongRules> = {},
): MahjongRules => ({
  ...BASE_RULES,
  ...DIFFICULTY[difficulty].rules,
  ...extra,
});

export interface Tile extends Pos {
  id: number;
  kind: string;
  removed: boolean;
}

interface Played {
  a: number;
  b: number;
  gained: number;
  streakBefore: number;
  lastMatchBefore: number | null;
}

export type Status = 'playing' | 'won' | 'stuck';

export interface MahjongState {
  layout: LayoutId;
  difficulty: Difficulty;
  rules: MahjongRules;
  tiles: Tile[];
  selected: number | null;
  history: Played[];
  score: number;
  /** Pairs taken off, counting each time (an undone one stays counted) */
  moves: number;
  /** Pairs on the table's way out right now */
  pairs: number;
  /** Tries that did not match */
  wrong: number;
  hints: number;
  shuffles: number;
  undos: number;
  streak: number;
  lastMatchAt: number | null;
  /** Milliseconds played, paused time not counted */
  elapsed: number;
  status: Status;
  hint: [number, number] | null;
  mismatch: [number, number] | null;
}

// ------------------------------------------------------------- free tiles

const overlapsY = (a: Pos, b: Pos) => Math.abs(a.y - b.y) < 2;

/** Whether `top` lies (partly) on `under`. */
const covers = (top: Pos, under: Pos) =>
  top.z === under.z + 1 &&
  Math.abs(top.x - under.x) < 2 &&
  Math.abs(top.y - under.y) < 2;

/**
 * Whether tile `i` can be picked: it is still there, nothing is on top of it,
 * and it has nothing touching it on at least one of its two sides.
 */
export function isFree(
  tiles: readonly Pick<Tile, 'x' | 'y' | 'z' | 'removed'>[],
  i: number,
): boolean {
  const t = tiles[i];
  if (t.removed) return false;
  let left = false;
  let right = false;
  for (let j = 0; j < tiles.length; j++) {
    const o = tiles[j];
    if (j === i || o.removed) continue;
    if (covers(o, t)) return false;
    if (o.z === t.z && overlapsY(o, t)) {
      if (o.x < t.x && o.x >= t.x - 2) left = true;
      else if (o.x > t.x && o.x <= t.x + 2) right = true;
    }
  }
  return !(left && right);
}

export const freeTiles = (tiles: readonly Tile[]) =>
  tiles.flatMap((_, i) => (isFree(tiles, i) ? [i] : []));

/** Every pair of free tiles that match, as indexes. */
export function validPairs(
  tiles: readonly Tile[],
  rules: MatchRules,
): [number, number][] {
  const free = freeTiles(tiles);
  const out: [number, number][] = [];
  for (let x = 0; x < free.length; x++) {
    for (let y = x + 1; y < free.length; y++) {
      if (canMatch(tiles[free[x]].kind, tiles[free[y]].kind, rules)) {
        out.push([free[x], free[y]]);
      }
    }
  }
  return out;
}

export const hasMoves = (tiles: readonly Tile[], rules: MatchRules) =>
  validPairs(tiles, rules).length > 0;

export const remaining = (tiles: readonly Tile[]) =>
  tiles.filter((t) => !t.removed).length;

// ------------------------------------------------------- building a board

const dist = (a: Pos, b: Pos) =>
  (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + ((a.z - b.z) * 4) ** 2;

/**
 * Gives the positions their tiles by taking two free ones at a time and
 * handing them a pair. Played in this order the board clears, so it is
 * solvable by construction. Returns null when a try paints itself into a
 * corner (one free tile left with more under it); the caller tries again.
 */
function build(
  positions: Pos[],
  pairs: [string, string][],
  rng: () => number,
  pairing: Pairing,
): { kinds: string[]; solution: [number, number][] } | null {
  const tiles = positions.map((p) => ({ ...p, removed: false }));
  const kinds: string[] = Array(tiles.length).fill('');
  const solution: [number, number][] = [];
  const stock = [...pairs];
  let left = tiles.length;

  while (left > 0) {
    const free = tiles.flatMap((_, i) => (isFree(tiles, i) ? [i] : []));
    if (free.length < 2) return null;
    let done = false;
    for (let attempt = 0; attempt < 8 && !done; attempt++) {
      const a = free[Math.floor(rng() * free.length)];
      const others = free.filter((i) => i !== a);
      let b: number;
      if (pairing === 'random') {
        b = others[Math.floor(rng() * others.length)];
      } else {
        const sorted = [...others].sort(
          (p, q) => dist(tiles[a], tiles[p]) - dist(tiles[a], tiles[q]),
        );
        const pool = pairing === 'near' ? sorted : sorted.reverse();
        // mostly the nearest (or farthest), with a little luck in it
        b = pool[Math.min(pool.length - 1, Math.floor(rng() * rng() * 3))];
      }
      tiles[a].removed = true;
      tiles[b].removed = true;
      const rest = left - 2;
      const ok =
        rest === 0 || tiles.filter((_, i) => isFree(tiles, i)).length >= 2;
      if (ok) {
        const pair = stock.pop()!;
        const flip = rng() < 0.5;
        kinds[a] = flip ? pair[1] : pair[0];
        kinds[b] = flip ? pair[0] : pair[1];
        solution.push([a, b]);
        left = rest;
        done = true;
      } else {
        tiles[a].removed = false;
        tiles[b].removed = false;
      }
    }
    if (!done) return null;
  }
  return { kinds, solution };
}

function buildWithRetries(
  positions: Pos[],
  pairs: [string, string][],
  rng: () => number,
  pairing: Pairing,
) {
  for (let i = 0; i < 300; i++) {
    const built = build(positions, shuffled(pairs, rng), rng, pairing);
    if (built) return built;
  }
  return null;
}

/** What a game is made of: where the tiles sit, and which tile is where. */
export function makeBoard(
  layout: LayoutId,
  rules: MatchRules,
  rng: () => number,
  pairing: Pairing = 'random',
  custom: Pos[] = [],
): { tiles: Tile[]; solution: [number, number][] } {
  const positions = layoutPositions(layout, custom);
  if (positions.length < 2 || positions.length % 2 !== 0) {
    throw new Error('A board needs an even number of tiles');
  }
  const pool = shuffled(allPairs(rules, rng), rng).slice(
    0,
    positions.length / 2,
  );
  const built = buildWithRetries(positions, pool, rng, pairing);
  if (!built) throw new Error('Could not build a solvable board');
  return {
    tiles: positions.map((p, id) => ({
      ...p,
      id,
      kind: built.kinds[id],
      removed: false,
    })),
    solution: built.solution,
  };
}

/** Whether playing `solution` from the start clears the board. */
export function replay(
  tiles: readonly Tile[],
  solution: [number, number][],
  rules: MatchRules,
): boolean {
  const board = tiles.map((t) => ({ ...t }));
  for (const [a, b] of solution) {
    if (!isFree(board, a) || !isFree(board, b)) return false;
    if (!canMatch(board[a].kind, board[b].kind, rules)) return false;
    board[a].removed = true;
    board[b].removed = true;
  }
  return board.every((t) => t.removed);
}

/**
 * Looks for a way to clear the rest of the board. `true` and `false` are
 * certain; `null` means the search gave up (it is capped, big boards are big).
 */
export function solvable(
  tiles: readonly Tile[],
  rules: MatchRules,
  maxNodes = 200_000,
): boolean | null {
  const board = tiles.map((t) => ({ ...t }));
  const failed = new Set<string>();
  let nodes = 0;
  let gaveUp = false;

  const key = () => board.map((t) => (t.removed ? 1 : 0)).join('');
  const left = () => board.filter((t) => !t.removed).length;

  const go = (): boolean => {
    if (left() === 0) return true;
    if (++nodes > maxNodes) {
      gaveUp = true;
      return false;
    }
    const k = key();
    if (failed.has(k)) return false;
    const pairs = validPairs(board as Tile[], rules);
    // a class with only two tiles left, both free, is always safe to take
    const counts = new Map<string, number>();
    for (const t of board) {
      if (!t.removed) {
        const c = matchClass(t.kind, rules);
        counts.set(c, (counts.get(c) ?? 0) + 1);
      }
    }
    const safe = pairs.find(
      ([a]) => counts.get(matchClass(board[a].kind, rules)) === 2,
    );
    const options = safe ? [safe] : pairs;
    for (const [a, b] of options) {
      board[a].removed = true;
      board[b].removed = true;
      const ok = go();
      board[a].removed = false;
      board[b].removed = false;
      if (ok) return true;
      if (gaveUp) return false;
    }
    failed.add(k);
    return false;
  };

  const result = go();
  return result ? true : gaveUp ? null : false;
}

// --------------------------------------------------------------- the game

export function newGame(
  layout: LayoutId,
  difficulty: Difficulty,
  rng: () => number = Math.random,
  options: { rules?: Partial<MahjongRules>; custom?: Pos[] } = {},
): MahjongState {
  const rules = rulesFor(difficulty, options.rules);
  const { tiles } = makeBoard(
    layout,
    rules,
    rng,
    DIFFICULTY[difficulty].pairing,
    options.custom,
  );
  return {
    layout,
    difficulty,
    rules,
    tiles,
    selected: null,
    history: [],
    score: 0,
    moves: 0,
    pairs: 0,
    wrong: 0,
    hints: 0,
    shuffles: 0,
    undos: 0,
    streak: 0,
    lastMatchAt: null,
    elapsed: 0,
    status: 'playing',
    hint: null,
    mismatch: null,
  };
}

const withStatus = (s: MahjongState): MahjongState => {
  if (remaining(s.tiles) === 0) return { ...s, status: 'won' };
  const stuck = !hasMoves(s.tiles, s.rules);
  return { ...s, status: stuck ? 'stuck' : 'playing' };
};

export type PickResult =
  'blocked' | 'selected' | 'deselected' | 'matched' | 'mismatch' | 'ignored';

/**
 * Picks a tile: the first pick selects it, the second matches or does not.
 * `elapsed` is how long the game has been played, in ms.
 */
export function pick(
  s: MahjongState,
  i: number,
  elapsed = s.elapsed,
): { state: MahjongState; result: PickResult } {
  if (s.status === 'won' || !s.tiles[i] || s.tiles[i].removed) {
    return { state: s, result: 'ignored' };
  }
  const base = { ...s, elapsed, hint: null, mismatch: null };
  if (!isFree(s.tiles, i)) return { state: base, result: 'blocked' };

  if (s.selected === null) {
    return { state: { ...base, selected: i }, result: 'selected' };
  }
  if (s.selected === i) {
    return { state: { ...base, selected: null }, result: 'deselected' };
  }
  const a = s.selected;
  if (!canMatch(s.tiles[a].kind, s.tiles[i].kind, s.rules)) {
    return {
      state: { ...base, selected: i, wrong: s.wrong + 1, mismatch: [a, i] },
      result: 'mismatch',
    };
  }

  const sc = s.rules.scoring;
  const inARow =
    s.lastMatchAt !== null && elapsed - s.lastMatchAt <= s.rules.comboWindowMs;
  const streak = inARow ? s.streak + 1 : 0;
  const gained = sc.match + sc.combo * Math.min(streak, sc.comboCap);
  const tiles = s.tiles.map((t) =>
    t.id === a || t.id === i ? { ...t, removed: true } : t,
  );
  const won = tiles.every((t) => t.removed);
  const next: MahjongState = withStatus({
    ...base,
    tiles,
    selected: null,
    history: [
      ...s.history,
      {
        a,
        b: i,
        gained,
        streakBefore: s.streak,
        lastMatchBefore: s.lastMatchAt,
      },
    ],
    score: s.score + gained + (won ? sc.complete : 0),
    moves: s.moves + 1,
    pairs: s.pairs + 1,
    streak,
    lastMatchAt: elapsed,
  });
  return { state: next, result: 'matched' };
}

export type Denied = 'limit' | 'none' | 'disabled' | 'empty';

/** Takes back the last pair. */
export function undo(s: MahjongState): {
  state: MahjongState;
  denied?: Denied;
} {
  const last = s.history[s.history.length - 1];
  if (!last || s.status === 'won') return { state: s, denied: 'empty' };
  if (s.undos >= s.rules.undoLimit) return { state: s, denied: 'limit' };
  const tiles = s.tiles.map((t) =>
    t.id === last.a || t.id === last.b ? { ...t, removed: false } : t,
  );
  return {
    state: withStatus({
      ...s,
      tiles,
      history: s.history.slice(0, -1),
      score: Math.max(0, s.score - last.gained - s.rules.scoring.undo),
      pairs: s.pairs - 1,
      undos: s.undos + 1,
      streak: last.streakBefore,
      lastMatchAt: last.lastMatchBefore,
      selected: null,
      hint: null,
      mismatch: null,
    }),
  };
}

/** Shows one pair that can be taken, at a price. */
export function hint(s: MahjongState): {
  state: MahjongState;
  denied?: Denied;
} {
  if (s.status === 'won') return { state: s, denied: 'empty' };
  if (s.hints >= s.rules.hintLimit) return { state: s, denied: 'limit' };
  const pairs = validPairs(s.tiles, s.rules);
  if (!pairs.length) return { state: s, denied: 'none' };
  // prefer a pair that frees the most, so the hint is a good move
  const pair = pairs[0];
  return {
    state: {
      ...s,
      hint: pair,
      selected: null,
      hints: s.hints + 1,
      score: Math.max(0, s.score - s.rules.scoring.hint),
    },
  };
}

/**
 * Rearranges the tiles still on the table: the same tiles, new places, built
 * the same way as a fresh board so that there is a way through.
 */
export function shuffleTiles(
  s: MahjongState,
  rng: () => number = Math.random,
): { state: MahjongState; denied?: Denied } {
  if (!s.rules.shuffleEnabled) return { state: s, denied: 'disabled' };
  if (s.status === 'won') return { state: s, denied: 'empty' };
  if (s.shuffles >= s.rules.shuffleLimit) return { state: s, denied: 'limit' };

  const left = s.tiles.filter((t) => !t.removed);
  // the tiles on the table, paired up by what matches what
  const byClass = new Map<string, string[]>();
  for (const t of left) {
    const c = matchClass(t.kind, s.rules);
    byClass.set(c, [...(byClass.get(c) ?? []), t.kind]);
  }
  const pairs: [string, string][] = [];
  for (const kinds of byClass.values()) {
    const mixed = shuffled(kinds, rng);
    for (let i = 0; i + 1 < mixed.length; i += 2) {
      pairs.push([mixed[i], mixed[i + 1]]);
    }
  }
  const positions = left.map((t) => ({ x: t.x, y: t.y, z: t.z }));
  let kinds: string[] | null = null;
  if (pairs.length * 2 === left.length) {
    kinds = buildWithRetries(positions, pairs, rng, 'random')?.kinds ?? null;
  }
  // an odd tile cannot happen in normal play; deal them out as they come
  if (!kinds) {
    kinds = shuffled(
      left.map((t) => t.kind),
      rng,
    );
  }
  let n = 0;
  const tiles = s.tiles.map((t) =>
    t.removed ? t : { ...t, kind: kinds![n++] },
  );
  return {
    state: withStatus({
      ...s,
      tiles,
      selected: null,
      hint: null,
      mismatch: null,
      shuffles: s.shuffles + 1,
      score: Math.max(0, s.score - s.rules.scoring.shuffle),
      streak: 0,
    }),
  };
}

export const accuracy = (s: MahjongState) => {
  const tries = s.moves + s.wrong;
  return tries === 0 ? 1 : s.moves / tries;
};

export const pairsLeft = (s: MahjongState) => remaining(s.tiles) / 2;
