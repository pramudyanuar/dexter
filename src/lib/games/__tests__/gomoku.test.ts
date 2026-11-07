import { gomokuGame, GomokuState, lineThrough } from '@/lib/games/gomoku';

const start = () => gomokuGame.start(2) as GomokuState;

describe('gomoku', () => {
  it('alternates turns and refuses taken or out-of-range cells', () => {
    let s = start();
    s = gomokuGame.move(s, 0, { r: 7, c: 7 }) as GomokuState;
    expect(s.turn).toBe(1);
    expect(() => gomokuGame.move(s, 1, { r: 7, c: 7 })).toThrow(/terisi/);
    expect(() => gomokuGame.move(s, 1, { r: 15, c: 0 })).toThrow(/tidak valid/);
    expect(() => gomokuGame.move(s, 0, { r: 0, c: 0 })).toThrow(/giliran/);
  });

  it('detects five in a row horizontally and diagonally', () => {
    let s = start();
    for (let i = 0; i < 4; i++) {
      s = gomokuGame.move(s, 0, { r: 3, c: i }) as GomokuState;
      s = gomokuGame.move(s, 1, { r: 10, c: i }) as GomokuState;
    }
    s = gomokuGame.move(s, 0, { r: 3, c: 4 }) as GomokuState;
    expect(s.status).toBe('won');
    expect(s.winner).toBe(0);
    expect(s.line).toHaveLength(5);

    const board = start().board;
    for (let i = 0; i < 5; i++) board[i][i + 2] = 2;
    expect(lineThrough(board, 2, 4)).toHaveLength(5);
    board[4][6] = 0;
    expect(lineThrough(board, 2, 4)).toBeNull();
  });
});
