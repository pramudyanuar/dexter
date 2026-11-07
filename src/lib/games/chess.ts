import type { GameDef } from '@/lib/rooms/game';
import { RoomError } from '@/lib/rooms/types';

export type Color = 'w' | 'b';
export type Kind = 'P' | 'N' | 'B' | 'R' | 'Q' | 'K';
export type Piece = `${Color}${Kind}`;
export type Point = [number, number]; // [row, col]; row 0 is rank 8 (black's side)
export type Board = (Piece | null)[][];
export type Promo = 'Q' | 'R' | 'B' | 'N';

export interface ChessMove {
  from: Point;
  to: Point;
  promo?: Promo;
}

export interface Castling {
  wK: boolean;
  wQ: boolean;
  bK: boolean;
  bQ: boolean;
}

export interface ChessState {
  board: Board;
  /** 0 = white (bottom), 1 = black (top) */
  turn: 0 | 1;
  castling: Castling;
  /** Square a pawn may capture onto en passant */
  ep: Point | null;
  /** Plies since the last capture or pawn move */
  half: number;
  status: 'playing' | 'checkmate' | 'stalemate' | 'draw';
  winner: 0 | 1 | null;
  check: boolean;
  last: ChessMove | null;
  /** Pieces taken so far, in order */
  taken: Piece[];
  starter: 0 | 1;
}

export interface ChessView extends ChessState {
  legal: ChessMove[];
}

const colorOf = (seat: number): Color => (seat === 0 ? 'w' : 'b');
const inside = (r: number, c: number) => r >= 0 && c >= 0 && r < 8 && c < 8;

export function initialBoard(): Board {
  const back: Kind[] = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  const board: Board = Array.from({ length: 8 }, () => Array(8).fill(null));
  back.forEach((k, c) => {
    board[0][c] = `b${k}`;
    board[7][c] = `w${k}`;
    board[1][c] = 'bP';
    board[6][c] = 'wP';
  });
  return board;
}

const KNIGHT: Point[] = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
];
const KING: Point[] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];
const DIAG: Point[] = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];
const ORTHO: Point[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/** Whether any piece of `by` attacks (r, c). */
export function isAttacked(board: Board, r: number, c: number, by: Color) {
  // pawns attack diagonally forward: white pawns move up the board (row - 1)
  const pr = by === 'w' ? r + 1 : r - 1;
  for (const dc of [-1, 1]) {
    if (inside(pr, c + dc) && board[pr][c + dc] === `${by}P`) return true;
  }
  for (const [dr, dc] of KNIGHT) {
    if (inside(r + dr, c + dc) && board[r + dr][c + dc] === `${by}N`)
      return true;
  }
  for (const [dr, dc] of KING) {
    if (inside(r + dr, c + dc) && board[r + dr][c + dc] === `${by}K`)
      return true;
  }
  const ray = (dirs: Point[], kinds: Kind[]) => {
    for (const [dr, dc] of dirs) {
      let rr = r + dr;
      let cc = c + dc;
      while (inside(rr, cc)) {
        const p = board[rr][cc];
        if (p) {
          if (p[0] === by && kinds.includes(p[1] as Kind)) return true;
          break;
        }
        rr += dr;
        cc += dc;
      }
    }
    return false;
  };
  return ray(DIAG, ['B', 'Q']) || ray(ORTHO, ['R', 'Q']);
}

function kingSquare(board: Board, color: Color): Point | null {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) if (board[r][c] === `${color}K`) return [r, c];
  return null;
}

export const inCheck = (board: Board, color: Color) => {
  const k = kingSquare(board, color);
  return !!k && isAttacked(board, k[0], k[1], color === 'w' ? 'b' : 'w');
};

/** Moves a piece on a copy of the board, handling en passant, castling and promotion. */
function applyToBoard(
  board: Board,
  move: ChessMove,
  ep: Point | null,
): { board: Board; captured: Piece | null } {
  const next = board.map((row) => [...row]);
  const [fr, fc] = move.from;
  const [tr, tc] = move.to;
  const piece = next[fr][fc]!;
  let captured = next[tr][tc];

  if (
    piece[1] === 'P' &&
    ep &&
    tr === ep[0] &&
    tc === ep[1] &&
    fc !== tc &&
    !captured
  ) {
    captured = next[fr][tc];
    next[fr][tc] = null;
  }
  if (piece[1] === 'K' && Math.abs(tc - fc) === 2) {
    const rookFrom = tc > fc ? 7 : 0;
    const rookTo = tc > fc ? tc - 1 : tc + 1;
    next[fr][rookTo] = next[fr][rookFrom];
    next[fr][rookFrom] = null;
  }
  next[fr][fc] = null;
  const lastRank = piece[0] === 'w' ? 0 : 7;
  next[tr][tc] =
    piece[1] === 'P' && tr === lastRank
      ? (`${piece[0]}${move.promo ?? 'Q'}` as Piece)
      : piece;
  return { board: next, captured };
}

function pseudoMoves(state: ChessState, color: Color): ChessMove[] {
  const { board, castling, ep } = state;
  const enemy: Color = color === 'w' ? 'b' : 'w';
  const out: ChessMove[] = [];
  const push = (from: Point, to: Point) => out.push({ from, to });

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece || piece[0] !== color) continue;
      const kind = piece[1] as Kind;
      const from: Point = [r, c];

      if (kind === 'P') {
        const dir = color === 'w' ? -1 : 1;
        const startRow = color === 'w' ? 6 : 1;
        const lastRank = color === 'w' ? 0 : 7;
        const add = (to: Point) => {
          if (to[0] === lastRank) {
            for (const promo of ['Q', 'R', 'B', 'N'] as Promo[])
              out.push({ from, to, promo });
          } else push(from, to);
        };
        if (inside(r + dir, c) && !board[r + dir][c]) {
          add([r + dir, c]);
          if (r === startRow && !board[r + 2 * dir][c])
            push(from, [r + 2 * dir, c]);
        }
        for (const dc of [-1, 1]) {
          const tr = r + dir;
          const tc = c + dc;
          if (!inside(tr, tc)) continue;
          const target = board[tr][tc];
          if (target && target[0] === enemy) add([tr, tc]);
          else if (!target && ep && ep[0] === tr && ep[1] === tc)
            push(from, [tr, tc]);
        }
      } else if (kind === 'N' || kind === 'K') {
        for (const [dr, dc] of kind === 'N' ? KNIGHT : KING) {
          const tr = r + dr;
          const tc = c + dc;
          if (inside(tr, tc) && board[tr][tc]?.[0] !== color)
            push(from, [tr, tc]);
        }
        if (kind === 'K') {
          const row = color === 'w' ? 7 : 0;
          if (r === row && c === 4 && !isAttacked(board, row, 4, enemy)) {
            if (
              castling[`${color}K`] &&
              board[row][7] === `${color}R` &&
              !board[row][5] &&
              !board[row][6] &&
              !isAttacked(board, row, 5, enemy)
            )
              push(from, [row, 6]);
            if (
              castling[`${color}Q`] &&
              board[row][0] === `${color}R` &&
              !board[row][1] &&
              !board[row][2] &&
              !board[row][3] &&
              !isAttacked(board, row, 3, enemy)
            )
              push(from, [row, 2]);
          }
        }
      } else {
        const dirs =
          kind === 'B' ? DIAG : kind === 'R' ? ORTHO : [...DIAG, ...ORTHO];
        for (const [dr, dc] of dirs) {
          let tr = r + dr;
          let tc = c + dc;
          while (inside(tr, tc)) {
            const target = board[tr][tc];
            if (target?.[0] === color) break;
            push(from, [tr, tc]);
            if (target) break;
            tr += dr;
            tc += dc;
          }
        }
      }
    }
  }
  return out;
}

/** Every legal move for `seat` (pseudo-legal moves that do not leave the king in check). */
export function legalMoves(state: ChessState, seat: number): ChessMove[] {
  const color = colorOf(seat);
  return pseudoMoves(state, color).filter(
    (m) => !inCheck(applyToBoard(state.board, m, state.ep).board, color),
  );
}

function insufficient(board: Board) {
  const rest = board
    .flat()
    .filter((p): p is Piece => !!p && p[1] !== 'K')
    .map((p) => p[1]);
  return (
    rest.length === 0 ||
    (rest.length === 1 && (rest[0] === 'B' || rest[0] === 'N'))
  );
}

const fresh = (starter: 0 | 1): ChessState => ({
  board: initialBoard(),
  turn: 0,
  castling: { wK: true, wQ: true, bK: true, bQ: true },
  ep: null,
  half: 0,
  status: 'playing',
  winner: null,
  check: false,
  last: null,
  taken: [],
  starter,
});

const same = (a: Point, b: Point) => a[0] === b[0] && a[1] === b[1];

export const chessGame: GameDef<ChessState> = {
  id: 'chess',
  minPlayers: 2,
  maxPlayers: 2,
  autoStart: true,

  start: () => fresh(0),
  // seat 0 is always white
  restart: (previous) => fresh(previous.starter),

  move(state, seat, move) {
    if (state.turn !== seat) throw new RoomError('Bukan giliranmu', 409);
    const m = move as ChessMove | null;
    if (!m || !Array.isArray(m.from) || !Array.isArray(m.to))
      throw new RoomError('Langkah tidak valid');

    const promo = m.promo ?? 'Q';
    const chosen = legalMoves(state, seat).find(
      (l) =>
        same(l.from, m.from) &&
        same(l.to, m.to) &&
        (l.promo === undefined || l.promo === promo),
    );
    if (!chosen) throw new RoomError('Langkah tidak sah', 409);

    const color = colorOf(seat);
    const piece = state.board[chosen.from[0]][chosen.from[1]]!;
    const { board, captured } = applyToBoard(state.board, chosen, state.ep);

    // castling rights end when the king or a rook moves, or a rook is taken
    const castling = { ...state.castling };
    if (piece[1] === 'K') {
      castling[`${color}K`] = false;
      castling[`${color}Q`] = false;
    }
    for (const sq of [chosen.from, chosen.to]) {
      if (sq[0] === 7 && sq[1] === 0) castling.wQ = false;
      if (sq[0] === 7 && sq[1] === 7) castling.wK = false;
      if (sq[0] === 0 && sq[1] === 0) castling.bQ = false;
      if (sq[0] === 0 && sq[1] === 7) castling.bK = false;
    }

    const double =
      piece[1] === 'P' && Math.abs(chosen.to[0] - chosen.from[0]) === 2;
    const ep: Point | null = double
      ? [(chosen.from[0] + chosen.to[0]) / 2, chosen.from[1]]
      : null;
    const half = captured || piece[1] === 'P' ? 0 : state.half + 1;

    const next: ChessState = {
      ...state,
      board,
      castling,
      ep,
      half,
      last: { from: chosen.from, to: chosen.to, promo: chosen.promo },
      taken: captured ? [...state.taken, captured] : state.taken,
      turn: (1 - seat) as 0 | 1,
      check: false,
    };

    const check = inCheck(board, colorOf(1 - seat));
    next.check = check;
    if (legalMoves(next, 1 - seat).length === 0) {
      return check
        ? { ...next, status: 'checkmate', winner: seat as 0 | 1 }
        : { ...next, status: 'stalemate' };
    }
    if (half >= 100 || insufficient(board)) return { ...next, status: 'draw' };
    return next;
  },

  view(state, seat): ChessView {
    return {
      ...state,
      legal:
        seat !== null && state.status === 'playing' && state.turn === seat
          ? legalMoves(state, seat)
          : [],
    };
  },

  isOver: (state) => state.status !== 'playing',
};
