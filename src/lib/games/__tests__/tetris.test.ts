import {
  bag,
  Board,
  collides,
  COLS,
  delayFor,
  emptyBoard,
  hardDrop,
  landingY,
  moveSideways,
  newGame,
  PIECE_TYPES,
  rotate,
  rotateMatrix,
  ROWS,
  softDrop,
  spawn,
  tick,
} from '@/lib/games/tetris';

const rng = () => 0.5;

/** A fresh game whose current piece and board are replaced, for focused tests. */
function setup(parts: Partial<ReturnType<typeof newGame>>) {
  return { ...newGame(rng), ...parts };
}

/** A board where the bottom `rows` rows are full except column `gap`. */
function bottomRows(rows: number, gap: number): Board {
  const board = emptyBoard();
  for (let r = ROWS - rows; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) if (c !== gap) board[r][c] = 1;
  }
  return board;
}

describe('bag', () => {
  it('has each piece exactly once, in any order', () => {
    for (const r of [() => 0, () => 0.5, () => 0.999, Math.random]) {
      expect([...bag(r)].sort()).toEqual([...PIECE_TYPES].sort());
    }
  });

  it('keeps the queue stocked for the whole game', () => {
    let state = newGame(rng);
    for (let i = 0; i < 60; i++) {
      expect(state.queue.length).toBeGreaterThanOrEqual(2);
      state = hardDrop({ ...state, board: emptyBoard() }, rng);
    }
  });
});

describe('collision and movement', () => {
  it('stops at the walls', () => {
    let state = setup({ piece: spawn('I') });
    for (let i = 0; i < 20; i++) state = moveSideways(state, -1);
    expect(state.piece.x).toBe(0);
    for (let i = 0; i < 20; i++) state = moveSideways(state, 1);
    expect(state.piece.x + 4).toBe(COLS);
  });

  it('stops against filled cells', () => {
    const board = emptyBoard();
    board[1][6] = 1; // just right of the O piece, which spawns on columns 4-5
    const state = setup({ board, piece: spawn('O') });
    expect(
      collides(board, state.piece.matrix, state.piece.x, state.piece.y),
    ).toBe(false);
    // the O piece is two rows tall, so the block on row 1 stops it
    expect(moveSideways(state, 1)).toBe(state);
    expect(moveSideways(state, -1).piece.x).toBe(state.piece.x - 1);
  });
});

describe('rotation', () => {
  it('four rotations return to the start', () => {
    for (const type of PIECE_TYPES) {
      const start = spawn(type).matrix;
      let m = start;
      for (let i = 0; i < 4; i++) m = rotateMatrix(m);
      expect(m).toEqual(start);
    }
  });

  it('clockwise and counter-clockwise undo each other', () => {
    const t = spawn('T').matrix;
    expect(rotateMatrix(rotateMatrix(t, true), false)).toEqual(t);
  });

  it('does nothing for the O piece', () => {
    const state = setup({ piece: spawn('O') });
    expect(rotate(state)).toBe(state);
  });

  it('kicks away from a wall instead of refusing', () => {
    // a vertical I against the left wall cannot lie flat in place, but can after a nudge
    let state = setup({ piece: spawn('I') });
    state = rotate(state); // now vertical
    for (let i = 0; i < 20; i++) state = moveSideways(state, -1);
    const flat = rotate(state, false);
    expect(flat.piece.matrix).not.toEqual(state.piece.matrix);
    expect(
      collides(flat.board, flat.piece.matrix, flat.piece.x, flat.piece.y),
    ).toBe(false);
  });

  it('refuses when no nudge makes room', () => {
    // flat I on the floor: standing up would poke through the bottom, whatever the kick
    const state = setup({ piece: { ...spawn('I'), y: ROWS - 3 } });
    expect(
      collides(state.board, state.piece.matrix, state.piece.x, state.piece.y),
    ).toBe(false);
    expect(rotate(state)).toBe(state);
  });
});

describe('falling and locking', () => {
  it('falls one row per tick', () => {
    const state = setup({ piece: spawn('T') });
    expect(tick(state, rng).piece.y).toBe(state.piece.y + 1);
  });

  it('lands on the floor and brings the next piece', () => {
    let state = newGame(rng);
    const first = state.piece.type;
    const upcoming = state.queue[0];
    state = hardDrop(state, rng);
    expect(state.piece.type).toBe(upcoming);
    expect(state.board.flat().filter(Boolean)).toHaveLength(4);
    expect(first).toBeDefined();
    // the dropped piece sits on the bottom row(s)
    expect(state.board[ROWS - 1].some(Boolean)).toBe(true);
  });

  it('computes where the ghost lands', () => {
    const state = setup({ piece: spawn('O') });
    expect(landingY(state)).toBe(ROWS - 2);
  });

  it('locks when it cannot fall further', () => {
    const state = setup({ piece: { ...spawn('O'), y: ROWS - 2 } });
    const next = tick(state, rng);
    expect(next.board.flat().filter(Boolean)).toHaveLength(4);
    expect(next.piece.y).toBe(0);
  });
});

describe('scoring', () => {
  it('clears full rows and scores by how many at once', () => {
    // an I piece placed vertically into a one-column gap clears rows
    const board = bottomRows(4, 9);
    let piece = spawn('I');
    piece = { ...piece, matrix: rotateMatrix(piece.matrix), x: 9 - 2, y: 0 };
    // vertical I occupies column x+2 of its 4x4 matrix
    const state = setup({ board, piece });
    const next = hardDrop(state, rng);
    expect(next.lines).toBe(4);
    expect(next.score).toBeGreaterThanOrEqual(800 + 2 * 16); // tetris + hard drop distance
    // the cleared rows are gone and the stack is empty again
    expect(next.board.flat().filter(Boolean)).toHaveLength(0);
  });

  it.each([
    [1, 100],
    [2, 300],
    [3, 500],
  ])('%d row(s) cleared scores %d at level 1', (rows, points) => {
    const board = bottomRows(rows, 9);
    let piece = spawn('I');
    piece = { ...piece, matrix: rotateMatrix(piece.matrix), x: 7, y: 0 };
    const next = hardDrop(setup({ board, piece }), rng);
    expect(next.lines).toBe(rows);
    const fall = landingY(setup({ board, piece })) - piece.y;
    expect(next.score).toBe(points + fall * 2);
  });

  it('adds a point per row of soft drop, and none when the piece locks', () => {
    const state = setup({ piece: spawn('T') });
    expect(softDrop(state, rng).score).toBe(1);
    const floor = setup({ piece: { ...spawn('O'), y: ROWS - 2 } });
    expect(softDrop(floor, rng).score).toBe(0);
  });

  it('levels up every ten lines and speeds up, with a floor', () => {
    const board = bottomRows(1, 9);
    let piece = spawn('I');
    piece = { ...piece, matrix: rotateMatrix(piece.matrix), x: 7, y: 0 };
    const next = hardDrop({ ...setup({ board, piece }), lines: 9 }, rng);
    expect(next.lines).toBe(10);
    expect(next.level).toBe(2);
    expect(delayFor(2)).toBeLessThan(delayFor(1));
    expect(delayFor(99)).toBe(70);
  });
});

describe('game over', () => {
  it('ends when a new piece has no room to appear', () => {
    // a tall stack with one open column, so no row is ever full (and cleared)
    const board = emptyBoard();
    for (let r = 1; r < ROWS; r++)
      for (let c = 1; c < COLS; c++) board[r][c] = 1;
    let state = setup({ board, piece: { ...spawn('O'), y: 0 } });
    state = hardDrop(state, rng);
    expect(state.over).toBe(true);
    // a finished game ignores input
    expect(tick(state, rng)).toBe(state);
    expect(moveSideways(state, 1)).toBe(state);
    expect(hardDrop(state, rng)).toBe(state);
  });
});
