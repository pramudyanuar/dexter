export const COLS = 10;
export const ROWS = 20;

export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
export const PIECE_TYPES: readonly PieceType[] = [
  'I',
  'O',
  'T',
  'S',
  'Z',
  'J',
  'L',
];

type Matrix = number[][];

const SHAPES: Record<PieceType, Matrix> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
};

/** Board cells hold 0 (empty) or the index + 1 of the piece type that filled them. */
export type Board = number[][];

export interface Piece {
  type: PieceType;
  matrix: Matrix;
  x: number;
  y: number;
}

export interface TetrisState {
  board: Board;
  piece: Piece;
  /** Upcoming piece types, at least two long */
  queue: PieceType[];
  score: number;
  lines: number;
  level: number;
  over: boolean;
}

export const emptyBoard = (): Board =>
  Array.from({ length: ROWS }, () => Array(COLS).fill(0));

export const colorIndex = (type: PieceType) => PIECE_TYPES.indexOf(type) + 1;

/** One shuffled set of all seven pieces. */
export function bag(rng: () => number = Math.random): PieceType[] {
  const pieces = [...PIECE_TYPES];
  for (let i = pieces.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
  }
  return pieces;
}

export function spawn(type: PieceType): Piece {
  const matrix = SHAPES[type].map((row) => [...row]);
  return { type, matrix, x: Math.floor((COLS - matrix.length) / 2), y: 0 };
}

export function collides(board: Board, matrix: Matrix, x: number, y: number) {
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (!matrix[r][c]) continue;
      const bx = x + c;
      const by = y + r;
      if (bx < 0 || bx >= COLS || by >= ROWS) return true;
      if (by >= 0 && board[by][bx]) return true;
    }
  }
  return false;
}

export function rotateMatrix(matrix: Matrix, clockwise = true): Matrix {
  const n = matrix.length;
  return matrix.map((row, y) =>
    row.map((_, x) =>
      clockwise ? matrix[n - 1 - x][y] : matrix[x][n - 1 - y],
    ),
  );
}

function refill(queue: PieceType[], rng: () => number) {
  while (queue.length < 7) queue.push(...bag(rng));
}

export function newGame(rng: () => number = Math.random): TetrisState {
  const queue: PieceType[] = [];
  refill(queue, rng);
  const first = queue.shift()!;
  return {
    board: emptyBoard(),
    piece: spawn(first),
    queue,
    score: 0,
    lines: 0,
    level: 1,
    over: false,
  };
}

export function moveSideways(state: TetrisState, dx: -1 | 1): TetrisState {
  const { piece, board, over } = state;
  if (over || collides(board, piece.matrix, piece.x + dx, piece.y))
    return state;
  return { ...state, piece: { ...piece, x: piece.x + dx } };
}

/** Rotates, nudging sideways when that makes room next to a wall or block. */
export function rotate(state: TetrisState, clockwise = true): TetrisState {
  const { piece, board, over } = state;
  if (over || piece.type === 'O') return state;

  const matrix = rotateMatrix(piece.matrix, clockwise);
  for (const kick of [0, -1, 1, -2, 2]) {
    if (!collides(board, matrix, piece.x + kick, piece.y)) {
      return { ...state, piece: { ...piece, matrix, x: piece.x + kick } };
    }
  }
  return state;
}

/** Row where the current piece would land. */
export function landingY(state: TetrisState): number {
  const { piece, board } = state;
  let y = piece.y;
  while (!collides(board, piece.matrix, piece.x, y + 1)) y++;
  return y;
}

const LINE_POINTS = [0, 100, 300, 500, 800];

export const delayFor = (level: number) => Math.max(70, 800 - (level - 1) * 65);

/** Fixes the piece in place, clears full rows, and brings in the next piece. */
function lock(state: TetrisState, rng: () => number): TetrisState {
  const board = state.board.map((row) => [...row]);
  const { piece } = state;
  const color = colorIndex(piece.type);

  piece.matrix.forEach((row, r) =>
    row.forEach((cell, c) => {
      const y = piece.y + r;
      if (cell && y >= 0) board[y][piece.x + c] = color;
    }),
  );

  const kept = board.filter((row) => row.some((cell) => !cell));
  const cleared = ROWS - kept.length;
  const nextBoard = [
    ...Array.from({ length: cleared }, () => Array(COLS).fill(0)),
    ...kept,
  ];

  const lines = state.lines + cleared;
  const level = Math.floor(lines / 10) + 1;
  const score = state.score + LINE_POINTS[cleared] * state.level;

  const queue = [...state.queue];
  const next = spawn(queue.shift()!);
  refill(queue, rng);

  return {
    board: nextBoard,
    piece: next,
    queue,
    score,
    lines,
    level,
    over: collides(nextBoard, next.matrix, next.x, next.y),
  };
}

/** One step of gravity: the piece falls a row, or locks if it cannot. */
export function tick(
  state: TetrisState,
  rng: () => number = Math.random,
): TetrisState {
  if (state.over) return state;
  const { piece, board } = state;
  if (!collides(board, piece.matrix, piece.x, piece.y + 1)) {
    return { ...state, piece: { ...piece, y: piece.y + 1 } };
  }
  return lock(state, rng);
}

/** Player-driven fall: same as a tick, worth one point when the piece moves. */
export function softDrop(
  state: TetrisState,
  rng: () => number = Math.random,
): TetrisState {
  if (state.over) return state;
  const next = tick(state, rng);
  const moved =
    next.piece.y === state.piece.y + 1 && next.piece.type === state.piece.type;
  return moved ? { ...next, score: next.score + 1 } : next;
}

export function hardDrop(
  state: TetrisState,
  rng: () => number = Math.random,
): TetrisState {
  if (state.over) return state;
  const y = landingY(state);
  const fell = y - state.piece.y;
  const dropped = {
    ...state,
    piece: { ...state.piece, y },
    score: state.score + fell * 2,
  };
  return lock(dropped, rng);
}
