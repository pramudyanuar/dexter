import {
  Board,
  COLS,
  drop,
  emptyBoard,
  findWin,
  isFull,
  ROWS,
} from '@/lib/games/connect4';

/** Plays a list of columns, alternating players, starting with 1. */
function play(columns: number[]): Board {
  let board = emptyBoard();
  columns.forEach((col, i) => {
    const result = drop(board, col, ((i % 2) + 1) as 1 | 2);
    if (!result) throw new Error(`column ${col} rejected at move ${i}`);
    board = result.board;
  });
  return board;
}

describe('drop', () => {
  it('lands on the bottom and stacks', () => {
    const first = drop(emptyBoard(), 3, 1)!;
    expect(first.row).toBe(ROWS - 1);
    const second = drop(first.board, 3, 2)!;
    expect(second.row).toBe(ROWS - 2);
    expect(second.board[ROWS - 1][3]).toBe(1);
    expect(second.board[ROWS - 2][3]).toBe(2);
  });

  it('rejects a full column and bad columns', () => {
    let board = emptyBoard();
    for (let i = 0; i < ROWS; i++)
      board = drop(board, 0, ((i % 2) + 1) as 1 | 2)!.board;
    expect(drop(board, 0, 1)).toBeNull();
    for (const bad of [-1, COLS, 1.5, NaN])
      expect(drop(emptyBoard(), bad, 1)).toBeNull();
  });

  it('does not change the board it was given', () => {
    const board = emptyBoard();
    drop(board, 2, 1);
    expect(board.flat().every((c) => c === 0)).toBe(true);
  });
});

describe('findWin', () => {
  it('finds four in a row, a column, and both diagonals', () => {
    // 1: cols 0-3 along the bottom, 2 stacks on top of them
    expect(findWin(play([0, 0, 1, 1, 2, 2, 3]))?.player).toBe(1);
    // vertical for player 1 in column 0
    expect(findWin(play([0, 1, 0, 1, 0, 1, 0]))?.player).toBe(1);
    // rising diagonal for player 1 (bottom-left to top-right)
    expect(findWin(play([0, 1, 1, 2, 3, 2, 2, 3, 3, 4, 3]))?.player).toBe(1);
    // falling diagonal for player 1
    expect(findWin(play([3, 2, 2, 1, 0, 1, 1, 0, 0, 5, 0]))?.player).toBe(1);
  });

  it('reports exactly the four winning cells', () => {
    const win = findWin(play([0, 0, 1, 1, 2, 2, 3]))!;
    expect(win.cells).toHaveLength(4);
    expect(win.cells.every(([r]) => r === ROWS - 1)).toBe(true);
    expect(win.cells.map(([, c]) => c).sort()).toEqual([0, 1, 2, 3]);
  });

  it('does not see a win in three in a row or a mixed line', () => {
    expect(findWin(play([0, 0, 1, 1, 2]))).toBeNull();
    expect(findWin(play([0, 1, 2, 3, 4, 5]))).toBeNull(); // 1 2 1 2 1 2 alternate
    expect(findWin(emptyBoard())).toBeNull();
  });

  it('finds a win that is not anchored at the first cell scanned', () => {
    // player 2 wins in the middle of the bottom row
    expect(findWin(play([0, 1, 6, 2, 0, 3, 6, 4]))?.player).toBe(2);
  });
});

describe('isFull', () => {
  it('is true only when the top row is filled', () => {
    expect(isFull(emptyBoard())).toBe(false);
    const board = emptyBoard();
    board[0] = Array(COLS).fill(1);
    expect(isFull(board)).toBe(true);
  });
});
