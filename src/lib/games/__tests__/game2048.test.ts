import {
  addTile,
  Board,
  canMove,
  emptyBoard,
  move,
  newBoard,
  slideRow,
} from '@/lib/games/game2048';

describe('slideRow', () => {
  it.each([
    [[2, 2, 2, 2], [4, 4, 0, 0], 8],
    [[2, 2, 4, 0], [4, 4, 0, 0], 4],
    [[4, 0, 2, 2], [4, 4, 0, 0], 4],
    [[2, 4, 2, 4], [2, 4, 2, 4], 0],
    [[0, 0, 0, 2], [2, 0, 0, 0], 0],
    [[2, 2, 2, 0], [4, 2, 0, 0], 4], // merges the leading pair first
    [[4, 4, 8, 0], [8, 8, 0, 0], 8], // a merged tile does not merge again
  ])('%j -> %j', (row, expected, gained) => {
    expect(slideRow(row)).toEqual({ row: expected, gained });
  });
});

describe('move', () => {
  const board: Board = [
    [2, 0, 0, 2],
    [0, 4, 0, 0],
    [0, 0, 0, 0],
    [2, 0, 0, 2],
  ];

  it('moves in all four directions', () => {
    expect(move(board, 'left').board[0]).toEqual([4, 0, 0, 0]);
    expect(move(board, 'right').board[0]).toEqual([0, 0, 0, 4]);
    expect(move(board, 'up').board.map((r) => r[0])).toEqual([4, 0, 0, 0]);
    expect(move(board, 'down').board.map((r) => r[0])).toEqual([0, 0, 0, 4]);
  });

  it('reports score gained and whether anything moved', () => {
    expect(move(board, 'left').gained).toBe(8);
    const stuck: Board = [
      [2, 4, 8, 16],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    expect(move(stuck, 'left').moved).toBe(false);
    expect(move(stuck, 'left').gained).toBe(0);
  });

  it('does not change the original board', () => {
    const copy = JSON.stringify(board);
    move(board, 'left');
    expect(JSON.stringify(board)).toBe(copy);
  });
});

describe('addTile / newBoard / canMove', () => {
  it('adds exactly one 2 or 4 to an empty cell', () => {
    const next = addTile(emptyBoard(), () => 0);
    const tiles = next.flat().filter(Boolean);
    expect(tiles).toEqual([2]);
    expect(
      addTile(emptyBoard(), () => 0.95)
        .flat()
        .filter(Boolean),
    ).toEqual([4]);
  });

  it('starts with two tiles', () => {
    expect(newBoard().flat().filter(Boolean)).toHaveLength(2);
  });

  it('detects a dead board', () => {
    const dead: Board = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ];
    expect(canMove(dead)).toBe(false);
    const alive: Board = [
      [2, 2, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ];
    expect(canMove(alive)).toBe(true);
  });
});
