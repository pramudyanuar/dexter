import { shuffle } from '@/lib/games/uno';
import type { GameDef } from '@/lib/rooms/game';
import { RoomError } from '@/lib/rooms/types';

export type Tile = [number, number];
export type End = 'L' | 'R';
export const HAND = 7;

export function set(): Tile[] {
  const tiles: Tile[] = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) tiles.push([a, b]);
  return tiles;
}

export interface DominoEvent {
  seat: number;
  kind: 'play' | 'draw' | 'pass';
  tile?: Tile;
}

export interface DominoState {
  players: number;
  hands: Tile[][];
  boneyard: Tile[];
  /** The chain, left to right, each tile oriented so neighbours match */
  board: Tile[];
  turn: number;
  status: 'playing' | 'won' | 'blocked';
  winner: number | null;
  /** Consecutive passes; a full lap means the game is blocked */
  passes: number;
  last: DominoEvent | null;
  starter: number;
}

export interface DominoView {
  players: number;
  hand: Tile[];
  /** For each tile in hand, the ends it can be played on */
  playable: End[][];
  counts: number[];
  boneyard: number;
  board: Tile[];
  turn: number;
  status: DominoState['status'];
  winner: number | null;
  last: DominoEvent | null;
  canDraw: boolean;
  canPass: boolean;
  /** Everyone's tiles once the round is over */
  hands: Tile[][] | null;
}

const pips = (hand: Tile[]) => hand.reduce((n, [a, b]) => n + a + b, 0);

export const ends = (board: Tile[]) =>
  board.length ? { L: board[0][0], R: board[board.length - 1][1] } : null;

/** Which ends a tile fits on. An empty board accepts it anywhere. */
export function fits(board: Tile[], tile: Tile): End[] {
  const e = ends(board);
  if (!e) return ['L'];
  const out: End[] = [];
  if (tile[0] === e.L || tile[1] === e.L) out.push('L');
  if (tile[0] === e.R || tile[1] === e.R) out.push('R');
  return out;
}

/** Orients a tile so it joins `end` correctly. */
function orient(board: Tile[], tile: Tile, end: End): Tile {
  const e = ends(board);
  if (!e) return tile;
  if (end === 'L') return tile[1] === e.L ? tile : [tile[1], tile[0]];
  return tile[0] === e.R ? tile : [tile[1], tile[0]];
}

function fresh(
  players: number,
  starter: number,
  rng: () => number = Math.random,
): DominoState {
  const tiles = shuffle(set(), rng);
  const hands = Array.from({ length: players }, () => tiles.splice(0, HAND));
  return {
    players,
    hands,
    boneyard: tiles,
    board: [],
    turn: starter,
    status: 'playing',
    winner: null,
    passes: 0,
    last: null,
    starter,
  };
}

const canPlayAny = (s: DominoState, seat: number) =>
  s.hands[seat].some((t) => fits(s.board, t).length > 0);

export const dominoGame: GameDef<DominoState> = {
  id: 'domino',
  minPlayers: 2,
  maxPlayers: 4,
  autoStart: false,

  start: (players, rng) => fresh(players, 0, rng),
  restart: (previous, players, rng) =>
    fresh(players, (previous.starter + 1) % players, rng),

  move(state, seat, move) {
    if (state.turn !== seat) throw new RoomError('Bukan giliranmu', 409);
    const m = move as { type?: string; index?: unknown; end?: unknown } | null;
    const hands = state.hands.map((h) => [...h]);
    const next = (from: number) => (from + 1) % state.players;

    if (m?.type === 'draw') {
      if (canPlayAny(state, seat))
        throw new RoomError('Kamu masih punya kartu yang bisa dimainkan', 409);
      if (state.boneyard.length === 0)
        throw new RoomError('Tumpukan sudah habis, lewati giliran', 409);
      const boneyard = [...state.boneyard];
      hands[seat].push(boneyard.pop()!);
      return {
        ...state,
        hands,
        boneyard,
        last: { seat, kind: 'draw' },
      };
    }

    if (m?.type === 'pass') {
      if (canPlayAny(state, seat))
        throw new RoomError('Kamu masih punya kartu yang bisa dimainkan', 409);
      if (state.boneyard.length > 0)
        throw new RoomError('Tarik kartu dulu', 409);
      const passes = state.passes + 1;
      const last: DominoEvent = { seat, kind: 'pass' };
      if (passes >= state.players) {
        // blocked: the lightest hand wins; a tie is no winner
        const totals = hands.map(pips);
        const min = Math.min(...totals);
        const best = totals.flatMap((t, i) => (t === min ? [i] : []));
        return {
          ...state,
          passes,
          last,
          status: 'blocked',
          winner: best.length === 1 ? best[0] : null,
        };
      }
      return { ...state, passes, last, turn: next(seat) };
    }

    if (m?.type === 'play') {
      const { index, end } = m;
      if (
        typeof index !== 'number' ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= hands[seat].length
      )
        throw new RoomError('Kartu tidak valid');
      const tile = hands[seat][index];
      const options = fits(state.board, tile);
      const chosen: End = end === 'R' ? 'R' : 'L';
      if (!options.includes(chosen))
        throw new RoomError('Kartu itu tidak cocok di sisi tersebut', 409);

      const placed = orient(state.board, tile, chosen);
      hands[seat].splice(index, 1);
      const board =
        chosen === 'L' || state.board.length === 0
          ? [placed, ...state.board]
          : [...state.board, placed];
      const last: DominoEvent = { seat, kind: 'play', tile: placed };

      if (hands[seat].length === 0) {
        return {
          ...state,
          hands,
          board,
          last,
          passes: 0,
          status: 'won',
          winner: seat,
        };
      }
      return { ...state, hands, board, last, passes: 0, turn: next(seat) };
    }

    throw new RoomError('Aksi tidak dikenal');
  },

  view(state, seat): DominoView {
    const hand = seat === null ? [] : state.hands[seat];
    const mine = seat === state.turn && state.status === 'playing';
    const playable = hand.map((t) => (mine ? fits(state.board, t) : []));
    const stuck = mine && !playable.some((p) => p.length > 0);
    return {
      players: state.players,
      hand,
      playable,
      counts: state.hands.map((h) => h.length),
      boneyard: state.boneyard.length,
      board: state.board,
      turn: state.turn,
      status: state.status,
      winner: state.winner,
      last: state.last,
      canDraw: stuck && state.boneyard.length > 0,
      canPass: stuck && state.boneyard.length === 0,
      hands: state.status === 'playing' ? null : state.hands,
    };
  },

  isOver: (state) => state.status !== 'playing',
};
