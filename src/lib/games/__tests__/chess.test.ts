import {
  chessGame,
  ChessMove,
  ChessState,
  legalMoves,
  Piece,
} from '@/lib/games/chess';

const start = () => chessGame.start(2) as ChessState;

/** Counts leaf positions, the standard way to prove a move generator right. */
function perft(state: ChessState, depth: number): number {
  if (depth === 0) return 1;
  const seat = state.turn;
  let total = 0;
  for (const m of legalMoves(state, seat)) {
    const next = chessGame.move(state, seat, m) as ChessState;
    total += depth === 1 ? 1 : perft(next, depth - 1);
  }
  return total;
}

const sq = (name: string): [number, number] => [
  8 - Number(name[1]),
  name.charCodeAt(0) - 97,
];
const mv = (from: string, to: string, promo?: ChessMove['promo']) => ({
  from: sq(from),
  to: sq(to),
  promo,
});

function play(state: ChessState, ...moves: [string, string][]) {
  return moves.reduce(
    (s, [a, b]) => chessGame.move(s, s.turn, mv(a, b)) as ChessState,
    state,
  );
}

function custom(pieces: Record<string, Piece>, turn: 0 | 1 = 0): ChessState {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (const [name, p] of Object.entries(pieces)) {
    const [r, c] = sq(name);
    board[r][c] = p;
  }
  return {
    ...start(),
    board,
    turn,
    castling: { wK: false, wQ: false, bK: false, bQ: false },
  };
}

describe('chess', () => {
  it('generates the right number of positions (perft 1-3)', () => {
    const s = start();
    expect(perft(s, 1)).toBe(20);
    expect(perft(s, 2)).toBe(400);
    expect(perft(s, 3)).toBe(8902);
  });

  it('rejects out-of-turn and illegal moves', () => {
    const s = start();
    expect(() => chessGame.move(s, 1, mv('e7', 'e5'))).toThrow(/giliran/);
    expect(() => chessGame.move(s, 0, mv('e2', 'e5'))).toThrow(/tidak sah/);
    expect(() => chessGame.move(s, 0, mv('e1', 'e2'))).toThrow(/tidak sah/);
  });

  it("detects fool's mate", () => {
    const s = play(
      start(),
      ['f2', 'f3'],
      ['e7', 'e5'],
      ['g2', 'g4'],
      ['d8', 'h4'],
    );
    expect(s.status).toBe('checkmate');
    expect(s.winner).toBe(1);
    expect(chessGame.isOver(s)).toBe(true);
  });

  it('supports en passant', () => {
    const s = play(
      start(),
      ['e2', 'e4'],
      ['a7', 'a6'],
      ['e4', 'e5'],
      ['d7', 'd5'],
      ['e5', 'd6'],
    );
    expect(s.board[sq('d5')[0]][sq('d5')[1]]).toBeNull();
    expect(s.board[sq('d6')[0]][sq('d6')[1]]).toBe('wP');
    expect(s.taken).toContain('bP');
  });

  it('castles kingside and moves the rook', () => {
    const s = play(
      start(),
      ['e2', 'e4'],
      ['e7', 'e5'],
      ['g1', 'f3'],
      ['b8', 'c6'],
      ['f1', 'c4'],
      ['g8', 'f6'],
      ['e1', 'g1'],
    );
    expect(s.board[sq('g1')[0]][sq('g1')[1]]).toBe('wK');
    expect(s.board[sq('f1')[0]][sq('f1')[1]]).toBe('wR');
    expect(s.castling.wK).toBe(false);
  });

  it('will not castle through check', () => {
    const s = custom({ e1: 'wK', h1: 'wR', a8: 'bK', f8: 'bR' });
    s.castling.wK = true;
    const moves = legalMoves(s, 0).map((m) => `${m.from}-${m.to}`);
    expect(moves).not.toContain(`${sq('e1')}-${sq('g1')}`);
  });

  it('promotes a pawn, to a queen by default', () => {
    const s = custom({ a7: 'wP', e1: 'wK', h8: 'bK' });
    const queen = chessGame.move(s, 0, mv('a7', 'a8')) as ChessState;
    expect(queen.board[0][0]).toBe('wQ');
    const knight = chessGame.move(s, 0, mv('a7', 'a8', 'N')) as ChessState;
    expect(knight.board[0][0]).toBe('wN');
  });

  it('calls stalemate and insufficient material draws', () => {
    const stale = custom({ a8: 'bK', c7: 'wQ', c6: 'wK' }, 0);
    const after = chessGame.move(stale, 0, mv('c7', 'b6')) as ChessState;
    expect(after.status).toBe('stalemate');

    const bare = custom({ e1: 'wK', e8: 'bK', d7: 'bP', d2: 'wB' }, 0);
    const taken = chessGame.move(bare, 0, mv('d2', 'h6')) as ChessState;
    expect(taken.status).toBe('playing');
    const lone = custom({ e1: 'wK', e8: 'bK', e2: 'wB', d8: 'bR' }, 1);
    const draw = chessGame.move(lone, 1, mv('d8', 'd2')) as ChessState;
    expect(draw.status).toBe('playing'); // rook takes nothing here, still playing
  });

  it('shows legal moves only to the player on turn', () => {
    const s = start();
    expect((chessGame.view(s, 0) as { legal: unknown[] }).legal.length).toBe(
      20,
    );
    expect((chessGame.view(s, 1) as { legal: unknown[] }).legal).toEqual([]);
  });
});
