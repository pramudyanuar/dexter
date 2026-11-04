export type Board = number[][];
export type Move = 'up' | 'down' | 'left' | 'right';

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

export function addTile(board: Board, rng: () => number = Math.random): Board {
  const empty: [number, number][] = [];
  board.forEach((row, y) =>
    row.forEach((v, x) => {
      if (!v) empty.push([y, x]);
    }),
  );
  if (!empty.length) return board;

  const [y, x] = empty[Math.floor(rng() * empty.length)];
  const next = board.map((r) => [...r]);
  next[y][x] = rng() < 0.9 ? 2 : 4;
  return next;
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
