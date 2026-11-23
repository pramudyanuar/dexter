import { addTile, canMove, move, newBoard } from '@/lib/games/game2048';
import { seededRandom } from '@/lib/games/seeded-random';
import { newGame, playTetris, TetrisAction } from '@/lib/games/tetris';
import { verifySoloReplay } from '@/lib/leaderboard/replay';

it('replays a completed 2048 game and rejects an unfinished one', () => {
  const seed = 12;
  const rng = seededRandom(seed);
  let board = newBoard(rng);
  let score = 0;
  const moves = [];
  for (let i = 0; i < 500 && canMove(board); i++) {
    for (const dir of ['up', 'left', 'down', 'right'] as const) {
      const next = move(board, dir);
      if (!next.moved) continue;
      moves.push(dir);
      score += next.gained;
      board = addTile(next.board, rng);
      break;
    }
  }
  expect(canMove(board)).toBe(false);
  expect(verifySoloReplay('2048', { seed, moves })).toMatchObject({ score });
  expect(
    verifySoloReplay('2048', { seed, moves: moves.slice(0, -1) }),
  ).toBeNull();
});

it('replays Tetris drops and requires the run to finish', () => {
  const seed = 9;
  const rng = seededRandom(seed);
  let board = newGame(rng);
  const moves: TetrisAction[] = [];
  while (!board.over) {
    moves.push('hard');
    board = playTetris(board, 'hard', rng);
  }
  expect(verifySoloReplay('tetris', { seed, moves })).toMatchObject({
    score: board.score,
  });
  expect(
    verifySoloReplay('tetris', { seed, moves: moves.slice(0, -1) }),
  ).toBeNull();
});
