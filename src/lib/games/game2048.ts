import { nextRandom } from '@/lib/games/seeded-random';

export type Board = number[][];
export type Move = 'up' | 'down' | 'left' | 'right';
export type Action2048 = Move | 'undo';

interface Spawn {
  row: number;
  column: number;
  value: number;
}

interface Run2048 {
  board: Board;
  score: number;
  over: boolean;
  randomState: number;
  previous: Pick<Run2048, 'board' | 'score'> | null;
  usedUndo: boolean;
  spawn: Spawn | null;
  reroll: Spawn | null;
}

export const SIZE = 4;

export function emptyBoard(): Board {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

/** Slides a row to the left, merging equal neighbours once each. */
export function slideRow(row: number[]): { row: number[]; gained: number } {
  const tiles = row.filter(Boolean);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === tiles[i + 1]) {
      out.push(tiles[i] * 2);
      gained += tiles[i] * 2;
      i++;
    } else {
      out.push(tiles[i]);
    }
  }
  while (out.length < SIZE) out.push(0);
  return { row: out, gained };
}

const transpose = (b: Board): Board => b[0].map((_, c) => b.map((r) => r[c]));
const mirror = (b: Board): Board => b.map((r) => [...r].reverse());

export function move(board: Board, dir: Move) {
  // turn every direction into "slide left", then turn the result back
  const prepare = (b: Board) =>
    dir === 'left'
      ? b
      : dir === 'right'
        ? mirror(b)
        : dir === 'up'
          ? transpose(b)
          : mirror(transpose(b));
  const restore = (b: Board) =>
    dir === 'left'
      ? b
      : dir === 'right'
        ? mirror(b)
        : dir === 'up'
          ? transpose(b)
          : transpose(mirror(b));

  let gained = 0;
  const slid = prepare(board).map((row) => {
    const res = slideRow(row);
    gained += res.gained;
    return res.row;
  });
  const next = restore(slid);
  const moved = next.some((r, y) => r.some((v, x) => v !== board[y][x]));
  return { board: next, gained, moved };
}

function spawnTile(board: Board, rng: () => number, avoid?: Spawn | null) {
  const empty: [number, number][] = [];
  board.forEach((row, y) =>
    row.forEach((v, x) => {
      if (!v) empty.push([y, x]);
    }),
  );
  if (!empty.length) return { board, spawn: null };

  const choices =
    avoid && empty.length > 1
      ? empty.filter(
          ([row, column]) => row !== avoid.row || column !== avoid.column,
        )
      : empty;
  const [row, column] = choices[Math.floor(rng() * choices.length)];
  const rolled = rng() < 0.9 ? 2 : 4;
  const value =
    row === avoid?.row && column === avoid.column && rolled === avoid.value
      ? rolled === 2
        ? 4
        : 2
      : rolled;
  const next = board.map((r) => [...r]);
  next[row][column] = value;
  return { board: next, spawn: { row, column, value } };
}

export function addTile(board: Board, rng: () => number = Math.random): Board {
  return spawnTile(board, rng).board;
}

export function newBoard(rng: () => number = Math.random): Board {
  return addTile(addTile(emptyBoard(), rng), rng);
}

export function canMove(board: Board): boolean {
  return (['up', 'down', 'left', 'right'] as const).some(
    (d) => move(board, d).moved,
  );
}

export const maxTile = (board: Board) => Math.max(...board.flat());

function withRandomState<T>(
  randomState: number,
  sample: (rng: () => number) => T,
) {
  const result = sample(() => {
    const [next, value] = nextRandom(randomState);
    randomState = next;
    return value;
  });
  return { result, randomState };
}

export function start2048(seed: number): Run2048 {
  const { result: board, randomState } = withRandomState(seed, newBoard);
  return {
    board,
    randomState,
    score: 0,
    over: false,
    previous: null,
    usedUndo: false,
    spawn: null,
    reroll: null,
  };
}

export function play2048(run: Run2048, action: Action2048): Run2048 | null {
  if (action === 'undo') {
    if (!run.previous) return null;
    return {
      ...run,
      ...run.previous,
      over: false,
      previous: null,
      usedUndo: true,
      spawn: null,
      reroll: run.spawn,
    };
  }
  if (run.over) return null;
  const result = move(run.board, action);
  if (!result.moved) return null;
  const {
    result: { board, spawn },
    randomState,
  } = withRandomState(run.randomState, (rng) =>
    spawnTile(result.board, rng, run.reroll),
  );
  return {
    board,
    spawn,
    randomState,
    score: run.score + result.gained,
    over: !canMove(board),
    previous: run.usedUndo ? null : { board: run.board, score: run.score },
    usedUndo: run.usedUndo,
    reroll: null,
  };
}
