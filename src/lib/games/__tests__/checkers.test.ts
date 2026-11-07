import {
  Board,
  checkersGame,
  CheckersState,
  initialBoard,
  legalMoves,
} from '@/lib/games/checkers';

const start = () => checkersGame.start(2) as CheckersState;
const empty = (): Board =>
  Array.from({ length: 8 }, () => Array<number>(8).fill(0));

describe('checkers', () => {
  it('sets up 12 pieces each and 7 opening moves', () => {
    const b = initialBoard();
    expect(b.flat().filter((p) => p === 1)).toHaveLength(12);
    expect(b.flat().filter((p) => p === 3)).toHaveLength(12);
    expect(legalMoves(b, 0)).toHaveLength(7);
  });

  it('rejects moves out of turn and illegal moves', () => {
    const s = start();
    expect(() => checkersGame.move(s, 1, { from: [2, 1], to: [3, 0] })).toThrow(
      /giliran/,
    );
    expect(() => checkersGame.move(s, 0, { from: [5, 0], to: [3, 2] })).toThrow(
      /tidak sah/,
    );
  });

  it('forces a capture', () => {
    const board = empty();
    board[5][2] = 1;
    board[4][3] = 3;
    board[5][6] = 1;
    const s = { ...start(), board };
    const moves = legalMoves(board, 0);
    expect(moves.every((m) => m.capture)).toBe(true);
    expect(() => checkersGame.move(s, 0, { from: [5, 6], to: [4, 5] })).toThrow(
      /wajib memakan/,
    );
  });

  it('keeps the turn through a multi-jump, then passes it', () => {
    const board = empty();
    board[6][1] = 1;
    board[5][2] = 3;
    board[3][4] = 3;
    board[0][7] = 3; // keeps seat 1 alive
    const s = { ...start(), board };
    const first = checkersGame.move(s, 0, {
      from: [6, 1],
      to: [4, 3],
    }) as CheckersState;
    expect(first.turn).toBe(0);
    expect(first.chain).toEqual([4, 3]);
    const second = checkersGame.move(first, 0, {
      from: [4, 3],
      to: [2, 5],
    }) as CheckersState;
    expect(second.turn).toBe(1);
    expect(second.chain).toBeNull();
  });

  it('crowns a man and ends the game when the opponent is out of pieces', () => {
    const board = empty();
    board[1][2] = 1;
    board[2][1] = 3;
    const s = { ...start(), board };
    const moved = checkersGame.move(s, 0, {
      from: [1, 2],
      to: [0, 1],
    }) as CheckersState;
    expect(moved.board[0][1]).toBe(2);

    const cap = empty();
    cap[4][3] = 1;
    cap[3][2] = 3;
    const done = checkersGame.move({ ...start(), board: cap }, 0, {
      from: [4, 3],
      to: [2, 1],
    }) as CheckersState;
    expect(done.status).toBe('won');
    expect(done.winner).toBe(0);
  });
});
