import {
  Action2048,
  addTile,
  canMove,
  move,
  newBoard,
  play2048,
  start2048,
} from '@/lib/games/game2048';
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
  expect(verifySoloReplay('2048', { seed, moves })).toMatchObject({
    score,
    usedUndo: undefined,
  });
  expect(
    verifySoloReplay('2048', { seed, moves: ['undo', ...moves] }),
  ).toBeNull();
  expect(
    verifySoloReplay('2048', { seed, moves: [...moves, 'undo'] }),
  ).toBeNull();
  expect(
    verifySoloReplay('2048', { seed, moves: moves.slice(0, -1) }),
  ).toBeNull();
});

it('replays exactly one undo and rejects a second one in a finished run', () => {
  const seed = 12;
  const start = start2048(seed);
  const first = play2048(start, 'up')!;
  const rewound = play2048(first, 'undo')!;
  let run = play2048(rewound, 'up')!;
  expect(rewound.board).toEqual(start.board);
  expect(rewound.score).toBe(start.score);
  expect(run.spawn).not.toEqual(first.spawn);
  expect(play2048(run, 'undo')).toBeNull();
  const moves: Action2048[] = ['up', 'undo', 'up'];
  for (let i = 0; i < 500 && !run.over; i++) {
    for (const dir of ['up', 'left', 'down', 'right'] as const) {
      const next = play2048(run, dir);
      if (!next) continue;
      moves.push(dir);
      run = next;
      break;
    }
  }
  expect(run.over).toBe(true);
  expect(verifySoloReplay('2048', { seed, moves })).toMatchObject({
    score: run.score,
    usedUndo: true,
  });
  expect(
    verifySoloReplay('2048', {
      seed,
      moves: [...moves.slice(0, 3), 'undo', ...moves.slice(3)],
    }),
  ).toBeNull();
});

it('changes the rerolled tile value when only the original cell is free', () => {
  const start = {
    ...start2048(12),
    board: [
      [0, 2, 4, 8],
      [16, 32, 64, 128],
      [256, 512, 1024, 2048],
      [4096, 8192, 16384, 32768],
    ],
  };
  const first = play2048(start, 'left')!;
  const replayed = play2048(play2048(first, 'undo')!, 'left')!;
  expect(first.spawn).toMatchObject({ row: 0, column: 3 });
  expect(replayed.spawn).toMatchObject({ row: 0, column: 3 });
  expect(replayed.spawn?.value).not.toBe(first.spawn?.value);
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
