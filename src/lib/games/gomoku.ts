import type { GameDef } from '@/lib/rooms/game';
import { RoomError } from '@/lib/rooms/types';

export const SIZE = 15;
export const WIN = 5;

/** 0 empty, 1 = seat 0 (black), 2 = seat 1 (white) */
export type Board = number[][];
export type Point = [number, number]; // [row, col]

export const emptyBoard = (): Board =>
  Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(0));

const DIRS: Point[] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

/** The winning line through (r, c), if the stone there completes five. */
export function lineThrough(
  board: Board,
  r: number,
  c: number,
): Point[] | null {
  const who = board[r][c];
  if (!who) return null;
  for (const [dr, dc] of DIRS) {
    const line: Point[] = [[r, c]];
    for (const sign of [1, -1]) {
      let rr = r + dr * sign;
      let cc = c + dc * sign;
      while (
        rr >= 0 &&
        cc >= 0 &&
        rr < SIZE &&
        cc < SIZE &&
        board[rr][cc] === who
      ) {
        line.push([rr, cc]);
        rr += dr * sign;
        cc += dc * sign;
      }
    }
    if (line.length >= WIN) return line;
  }
  return null;
}

export interface GomokuState {
  board: Board;
  turn: 0 | 1;
  status: 'playing' | 'won' | 'draw';
  winner: 0 | 1 | null;
  line: Point[] | null;
  last: Point | null;
  moves: number;
  starter: 0 | 1;
}

const fresh = (starter: 0 | 1): GomokuState => ({
  board: emptyBoard(),
  turn: starter,
  status: 'playing',
  winner: null,
  line: null,
  last: null,
  moves: 0,
  starter,
});

export const gomokuGame: GameDef<GomokuState> = {
  id: 'gomoku',
  minPlayers: 2,
  maxPlayers: 2,
  autoStart: true,

  start: () => fresh(0),
  restart: (previous) => fresh((1 - previous.starter) as 0 | 1),

  move(state, seat, move) {
    if (state.turn !== seat) throw new RoomError('Bukan giliranmu', 409);
    const { r, c } = (move ?? {}) as { r?: unknown; c?: unknown };
    if (
      typeof r !== 'number' ||
      typeof c !== 'number' ||
      !Number.isInteger(r) ||
      !Number.isInteger(c) ||
      r < 0 ||
      c < 0 ||
      r >= SIZE ||
      c >= SIZE
    )
      throw new RoomError('Petak tidak valid');
    if (state.board[r][c]) throw new RoomError('Petak itu sudah terisi', 409);

    const board = state.board.map((row) => [...row]);
    board[r][c] = seat + 1;
    const moves = state.moves + 1;
    const base = { ...state, board, moves, last: [r, c] as Point };

    const line = lineThrough(board, r, c);
    if (line) return { ...base, status: 'won', winner: seat as 0 | 1, line };
    if (moves >= SIZE * SIZE) return { ...base, status: 'draw' };
    return { ...base, turn: (1 - seat) as 0 | 1 };
  },

  view: (state) => state,
  isOver: (state) => state.status !== 'playing',
};
