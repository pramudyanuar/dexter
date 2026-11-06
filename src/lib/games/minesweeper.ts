export type CellState = 'hidden' | 'open' | 'flag';

export interface Cell {
  mine: boolean;
  /** Mines among the 8 neighbours */
  adjacent: number;
  state: CellState;
}

export type Status = 'ready' | 'playing' | 'won' | 'lost';

export interface MinesGame {
  width: number;
  height: number;
  mines: number;
  /** Row-major, index = y * width + x */
  cells: Cell[];
  status: Status;
  flags: number;
  /** Cells opened so far */
  opened: number;
}

export const LEVELS = {
  mudah: { width: 9, height: 9, mines: 10 },
  sedang: { width: 12, height: 12, mines: 25 },
  sulit: { width: 16, height: 16, mines: 40 },
} as const;

export type Level = keyof typeof LEVELS;

const idx = (g: Pick<MinesGame, 'width'>, x: number, y: number) =>
  y * g.width + x;

function neighbours(
  g: Pick<MinesGame, 'width' | 'height'>,
  x: number,
  y: number,
) {
  const out: [number, number][] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if ((dx || dy) && nx >= 0 && ny >= 0 && nx < g.width && ny < g.height) {
        out.push([nx, ny]);
      }
    }
  }
  return out;
}

/** Mines are only placed on the first reveal, so that click is always safe. */
export function newGame(level: Level): MinesGame {
  const { width, height, mines } = LEVELS[level];
  return {
    width,
    height,
    mines,
    cells: Array.from({ length: width * height }, () => ({
      mine: false,
      adjacent: 0,
      state: 'hidden' as CellState,
    })),
    status: 'ready',
    flags: 0,
    opened: 0,
  };
}

function countAdjacent(g: MinesGame) {
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      g.cells[idx(g, x, y)].adjacent = neighbours(g, x, y).filter(
        ([nx, ny]) => g.cells[idx(g, nx, ny)].mine,
      ).length;
    }
  }
}

function placeMines(
  g: MinesGame,
  safeX: number,
  safeY: number,
  rng: () => number,
) {
  // keep the clicked cell and its neighbours free, so the first click opens an area
  const blocked = new Set([
    idx(g, safeX, safeY),
    ...neighbours(g, safeX, safeY).map(([x, y]) => idx(g, x, y)),
  ]);
  let candidates = g.cells.map((_, i) => i).filter((i) => !blocked.has(i));
  if (candidates.length < g.mines) {
    // tiny boards: only protect the clicked cell itself
    candidates = g.cells
      .map((_, i) => i)
      .filter((i) => i !== idx(g, safeX, safeY));
  }
  for (let n = 0; n < g.mines; n++) {
    const pick = Math.floor(rng() * candidates.length);
    g.cells[candidates[pick]].mine = true;
    candidates.splice(pick, 1);
  }
  countAdjacent(g);
}

function clone(g: MinesGame): MinesGame {
  return { ...g, cells: g.cells.map((c) => ({ ...c })) };
}

function finish(g: MinesGame) {
  if (g.status !== 'playing') return;
  if (g.opened === g.width * g.height - g.mines) {
    g.status = 'won';
    g.cells.forEach((c) => {
      if (c.mine) c.state = 'flag';
    });
    g.flags = g.mines;
  }
}

/** Opens a cell, spreading across empty areas. Opening a mine loses. */
export function reveal(
  game: MinesGame,
  x: number,
  y: number,
  rng: () => number = Math.random,
): MinesGame {
  if (game.status === 'won' || game.status === 'lost') return game;
  const first = game.cells[idx(game, x, y)];
  if (first.state !== 'hidden') return game;

  const g = clone(game);
  if (g.status === 'ready') {
    placeMines(g, x, y, rng);
    g.status = 'playing';
  }

  const start = g.cells[idx(g, x, y)];
  if (start.mine) {
    g.status = 'lost';
    g.cells.forEach((c) => {
      if (c.mine && c.state !== 'flag') c.state = 'open';
    });
    start.state = 'open';
    return g;
  }

  const stack: [number, number][] = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop()!;
    const cell = g.cells[idx(g, cx, cy)];
    if (cell.state !== 'hidden' || cell.mine) continue;
    cell.state = 'open';
    g.opened++;
    if (cell.adjacent === 0) stack.push(...neighbours(g, cx, cy));
  }
  finish(g);
  return g;
}

export function toggleFlag(game: MinesGame, x: number, y: number): MinesGame {
  if (game.status === 'won' || game.status === 'lost') return game;
  const cell = game.cells[idx(game, x, y)];
  if (cell.state === 'open') return game;

  const g = clone(game);
  const target = g.cells[idx(g, x, y)];
  if (target.state === 'flag') {
    target.state = 'hidden';
    g.flags--;
  } else {
    target.state = 'flag';
    g.flags++;
  }
  return g;
}

/** On an opened number whose flags match it, opens the remaining neighbours. */
export function chord(
  game: MinesGame,
  x: number,
  y: number,
  rng: () => number = Math.random,
): MinesGame {
  if (game.status !== 'playing') return game;
  const cell = game.cells[idx(game, x, y)];
  if (cell.state !== 'open' || cell.adjacent === 0) return game;

  const around = neighbours(game, x, y);
  const flagged = around.filter(
    ([nx, ny]) => game.cells[idx(game, nx, ny)].state === 'flag',
  );
  if (flagged.length !== cell.adjacent) return game;

  let next = game;
  for (const [nx, ny] of around) {
    next = reveal(next, nx, ny, rng);
  }
  return next;
}

/** Builds a game from a picture, for tests: `*` mine, `.` safe. Status playing. */
export function fromLayout(rows: string[]): MinesGame {
  const height = rows.length;
  const width = rows[0].length;
  const g: MinesGame = {
    width,
    height,
    mines: rows.join('').split('*').length - 1,
    cells: rows
      .join('')
      .split('')
      .map((ch) => ({
        mine: ch === '*',
        adjacent: 0,
        state: 'hidden' as CellState,
      })),
    status: 'playing',
    flags: 0,
    opened: 0,
  };
  countAdjacent(g);
  return g;
}
