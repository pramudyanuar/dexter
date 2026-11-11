import type { GameDef } from '@/lib/rooms/game';
import { RoomError } from '@/lib/rooms/types';

/**
 * 0 empty, 1 / 2 = seat 0 man / king (starts at the bottom, moves up),
 * 3 / 4 = seat 1 man / king (starts at the top, moves down).
 */
export type Board = number[][];
export type Point = [number, number]; // [row, col]

export interface CheckersMove {
  from: Point;
  to: Point;
  /** The jumped piece, for captures */
  capture?: Point;
}

export const SIZE = 8;
const owner = (p: number) => (p === 0 ? -1 : p <= 2 ? 0 : 1);
const isKing = (p: number) => p === 2 || p === 4;

export function initialBoard(): Board {
  const board: Board = Array.from({ length: SIZE }, () =>
    Array<number>(SIZE).fill(0),
  );
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if ((r + c) % 2 === 0) continue;
      if (r < 3) board[r][c] = 3;
      else if (r > 4) board[r][c] = 1;
    }
  }
  return board;
}

const inside = (r: number, c: number) =>
  r >= 0 && c >= 0 && r < SIZE && c < SIZE;

function directions(piece: number): Point[] {
  if (isKing(piece))
    return [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ];
  const dr = owner(piece) === 0 ? -1 : 1;
  return [
    [dr, -1],
    [dr, 1],
  ];
}

/** Jumps available to the piece at (r, c). */
export function capturesFrom(
  board: Board,
  r: number,
  c: number,
): CheckersMove[] {
  const piece = board[r][c];
  if (!piece) return [];
  const out: CheckersMove[] = [];
  for (const [dr, dc] of directions(piece)) {
    const mr = r + dr;
    const mc = c + dc;
    const tr = r + dr * 2;
    const tc = c + dc * 2;
    if (!inside(tr, tc)) continue;
    const over = board[mr][mc];
    if (over && owner(over) !== owner(piece) && board[tr][tc] === 0) {
      out.push({ from: [r, c], to: [tr, tc], capture: [mr, mc] });
    }
  }
  return out;
}

function stepsFrom(board: Board, r: number, c: number): CheckersMove[] {
  const piece = board[r][c];
  return directions(piece)
    .filter(([dr, dc]) => inside(r + dr, c + dc) && board[r + dr][c + dc] === 0)
    .map(
      ([dr, dc]) => ({ from: [r, c], to: [r + dr, c + dc] }) as CheckersMove,
    );
}

/**
 * All legal moves for `seat`. Capturing is mandatory, and in the middle of a
 * multi-jump only the jumping piece may continue.
 */
export function legalMoves(
  board: Board,
  seat: number,
  chain: Point | null = null,
): CheckersMove[] {
  if (chain) return capturesFrom(board, chain[0], chain[1]);
  const captures: CheckersMove[] = [];
  const steps: CheckersMove[] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (owner(board[r][c]) !== seat) continue;
      captures.push(...capturesFrom(board, r, c));
      steps.push(...stepsFrom(board, r, c));
    }
  }
  return captures.length ? captures : steps;
}

export interface CheckersState {
  board: Board;
  turn: 0 | 1;
  /** Piece that must keep jumping */
  chain: Point | null;
  status: 'playing' | 'won' | 'draw';
  winner: 0 | 1 | null;
  last: CheckersMove | null;
  /** Plies since the last capture or man move */
  quiet: number;
  starter: 0 | 1;
}

const fresh = (starter: 0 | 1): CheckersState => ({
  board: initialBoard(),
  turn: starter,
  chain: null,
  status: 'playing',
  winner: null,
  last: null,
  quiet: 0,
  starter,
});

export interface CheckersView extends CheckersState {
  /** Legal moves for the viewer (empty when it is not their turn) */
  legal: CheckersMove[];
  counts: [number, number];
}

const count = (board: Board, seat: number) =>
  board.flat().filter((p) => owner(p) === seat).length;

export const checkersGame: GameDef<CheckersState> = {
  id: 'checkers',
  minPlayers: 2,
  maxPlayers: 2,
  autoStart: true,

  start: () => fresh(0),
  restart: (previous) => fresh((1 - previous.starter) as 0 | 1),

  move(state, seat, move) {
    if (state.turn !== seat) throw new RoomError('Bukan giliranmu', 409);
    const m = move as { from?: Point; to?: Point } | null;
    const legal = legalMoves(state.board, seat, state.chain);
    const chosen = legal.find(
      (l) =>
        l.from[0] === m?.from?.[0] &&
        l.from[1] === m?.from?.[1] &&
        l.to[0] === m?.to?.[0] &&
        l.to[1] === m?.to?.[1],
    );
    if (!chosen) {
      const mustJump = legal.some((l) => l.capture);
      throw new RoomError(
        mustJump ? 'Kamu wajib memakan bidak lawan' : 'Langkah tidak sah',
        409,
      );
    }

    const board = state.board.map((row) => [...row]);
    const piece = board[chosen.from[0]][chosen.from[1]];
    board[chosen.from[0]][chosen.from[1]] = 0;
    if (chosen.capture) board[chosen.capture[0]][chosen.capture[1]] = 0;

    // a man that reaches the far row is crowned, which ends its turn
    const lastRow = seat === 0 ? 0 : SIZE - 1;
    const crowned = !isKing(piece) && chosen.to[0] === lastRow;
    board[chosen.to[0]][chosen.to[1]] = crowned ? piece + 1 : piece;

    const quiet = chosen.capture || !isKing(piece) ? 0 : state.quiet + 1;
    const base = { ...state, board, last: chosen, quiet };

    if (
      chosen.capture &&
      !crowned &&
      capturesFrom(board, chosen.to[0], chosen.to[1]).length > 0
    ) {
      return { ...base, chain: chosen.to };
    }

    const next = (1 - seat) as 0 | 1;
    if (legalMoves(board, next).length === 0) {
      return { ...base, chain: null, status: 'won', winner: seat as 0 | 1 };
    }
    if (quiet >= 80) return { ...base, chain: null, status: 'draw' };
    return { ...base, chain: null, turn: next };
  },

  waiting: (state) =>
    state.status === 'playing' ? { seats: [state.turn], seconds: 60 } : null,

  autoMove(state, seat, rng = Math.random) {
    const moves = legalMoves(state.board, seat, state.chain);
    if (!moves.length) return null;
    const m = moves[Math.floor(rng() * moves.length)];
    return { from: m.from, to: m.to };
  },

  eliminate: (state, seat) => ({
    ...state,
    chain: null,
    status: 'won',
    winner: (1 - seat) as 0 | 1,
  }),

  view(state, seat): CheckersView {
    return {
      ...state,
      legal:
        seat !== null && state.status === 'playing' && state.turn === seat
          ? legalMoves(state.board, seat, state.chain)
          : [],
      counts: [count(state.board, 0), count(state.board, 1)],
    };
  },

  isOver: (state) => state.status !== 'playing',
};
