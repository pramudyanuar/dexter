import {
  Board,
  Cell,
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

  // nothing is hidden in Connect Four
  view: (state) => state,
  isOver: (state) => state.status !== 'playing',
};
