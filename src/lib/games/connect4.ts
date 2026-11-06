export const COLS = 7;
export const ROWS = 6;

/** [row][col], row 0 is the top. 0 is empty, 1 and 2 are the players. */
export type Board = number[][];
export type Cell = [row: number, col: number];

export const emptyBoard = (): Board =>
  Array.from({ length: ROWS }, () => Array(COLS).fill(0));

/** Drops a disc in a column. Returns null when the column is full or invalid. */
export function drop(
  board: Board,
  col: number,
  player: 1 | 2,
): { board: Board; row: number } | null {
  if (!Number.isInteger(col) || col < 0 || col >= COLS) return null;
  for (let row = ROWS - 1; row >= 0; row--) {
    if (board[row][col] === 0) {
      const next = board.map((r) => [...r]);
      next[row][col] = player;
      return { board: next, row };
    }
  }
  return null;
}

const DIRECTIONS: Cell[] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

/** The four cells of a winning line, if any player has one. */
export function findWin(board: Board): { player: 1 | 2; cells: Cell[] } | null {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const player = board[r][c];
      if (!player) continue;
      for (const [dr, dc] of DIRECTIONS) {
        const cells: Cell[] = [];
        for (let i = 0; i < 4; i++) {
          const rr = r + dr * i;
          const cc = c + dc * i;
          if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) break;
          if (board[rr][cc] !== player) break;
          cells.push([rr, cc]);
        }
        if (cells.length === 4) return { player: player as 1 | 2, cells };
      }
    }
  }
  return null;
}

export const isFull = (board: Board) => board[0].every((cell) => cell !== 0);
