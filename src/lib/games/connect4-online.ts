import {
  Board,
  Cell,
  COLS,
  drop,
  emptyBoard,
  findWin,
  isFull,
} from '@/lib/games/connect4';
import type { GameDef } from '@/lib/rooms/game';
import { RoomError } from '@/lib/rooms/types';

export interface Connect4State {
  board: Board;
  /** Seat whose turn it is */
  turn: 0 | 1;
  status: 'playing' | 'won' | 'draw';
  winner: 0 | 1 | null;
  line: Cell[] | null;
  moves: number;
  /** Who opens the current round; alternates on rematch */
  starter: 0 | 1;
}

function fresh(starter: 0 | 1): Connect4State {
  return {
    board: emptyBoard(),
    turn: starter,
    status: 'playing',
    winner: null,
    line: null,
    moves: 0,
    starter,
  };
}

export const connect4Game: GameDef<Connect4State> = {
  id: 'connect4',
  minPlayers: 2,
  maxPlayers: 2,
  autoStart: true,

  start: () => fresh(0),
  restart: (previous) => fresh((1 - previous.starter) as 0 | 1),

  move(state, seat, move) {
    if (state.turn !== seat) throw new RoomError('Bukan giliranmu', 409);
    const col = (move as { col?: unknown } | null)?.col;
    if (typeof col !== 'number') throw new RoomError('Kolom tidak valid', 400);

    const dropped = drop(state.board, col, (seat + 1) as 1 | 2);
    if (!dropped) throw new RoomError('Kolom itu penuh atau tidak valid', 400);

    const win = findWin(dropped.board);
    const base = { ...state, board: dropped.board, moves: state.moves + 1 };
    if (win)
      return { ...base, status: 'won', winner: seat as 0 | 1, line: win.cells };
    if (isFull(dropped.board)) return { ...base, status: 'draw' };
    return { ...base, turn: (1 - seat) as 0 | 1 };
  },

  waiting: (state) =>
    state.status === 'playing' ? { seats: [state.turn], seconds: 45 } : null,

  // a random column that still has room
  autoMove(state, seat, rng = Math.random) {
    const open = Array.from({ length: COLS }, (_, c) => c).filter(
      (c) => drop(state.board, c, (seat + 1) as 1 | 2) !== null,
    );
    return open.length ? { col: open[Math.floor(rng() * open.length)] } : null;
  },

  // whoever is left wins
  eliminate: (state, seat) => ({
    ...state,
    status: 'won',
    winner: (1 - seat) as 0 | 1,
    line: null,
  }),

  // nothing is hidden in Connect Four
  view: (state) => state,
  isOver: (state) => state.status !== 'playing',
};
