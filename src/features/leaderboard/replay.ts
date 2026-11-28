import { z } from 'zod';

import { play2048, start2048 } from '@/features/games/logic/game2048';
import type { Level } from '@/features/games/logic/minesweeper';
import {
  chord,
  LEVELS,
  newGame,
  reveal,
  toggleFlag,
} from '@/features/games/logic/minesweeper';
import { seededRandom } from '@/features/games/logic/seeded-random';
import {
  readSnakeReplay,
  replaySnake,
} from '@/features/games/logic/snake-daily';
import {
  newGame as newTetris,
  playTetris,
  TETRIS_ACTIONS,
} from '@/features/games/logic/tetris';

export const seedSchema = z.int().min(0).max(0xffffffff);
const MAX_MOVES = 20_000;
const proof = z.object({ seed: seedSchema, moves: z.unknown() });
const slides = z
  .array(z.enum(['up', 'down', 'left', 'right', 'undo']))
  .min(1)
  .max(MAX_MOVES);
const tetrisMoves = z.array(z.enum(TETRIS_ACTIONS)).min(1).max(MAX_MOVES);
const minesMove = z.tuple([z.enum(['open', 'flag']), z.int(), z.int()]);
const minesMoves = z.array(minesMove).min(1).max(MAX_MOVES);
export type MinesMove = z.infer<typeof minesMove>;

export function verifySoloReplay(game: string, input: unknown) {
  const parsed = proof.safeParse(input);
  if (!parsed.success) return null;
  const { seed, moves } = parsed.data;
  const rng = seededRandom(seed);
  switch (game) {
    case 'snake': {
      const replay = readSnakeReplay(moves, MAX_MOVES);
      const score = replay && replaySnake(seed, replay);
      return score === null ? null : { score, replay: { seed, moves: replay } };
    }
    case '2048': {
      const replay = slides.safeParse(moves);
      if (!replay.success) return null;
      let run = start2048(seed);
      for (const action of replay.data) {
        const next = play2048(run, action);
        if (!next) return null;
        run = next;
      }
      return run.over
        ? {
            score: run.score,
            usedUndo: run.usedUndo || undefined,
            replay: { seed, moves: replay.data },
          }
        : null;
    }
    case 'tetris': {
      const replay = tetrisMoves.safeParse(moves);
      if (!replay.success) return null;
      let state = newTetris(rng);
      for (const action of replay.data) {
        if (state.over) return null;
        state = playTetris(state, action, rng);
      }
      if (!state.over) return null;
      return {
        score: state.score,
        meta: `${state.lines} baris · Lv ${state.level}`,
        replay: { seed, moves: replay.data },
      };
    }
    default:
      return null;
  }
}

export function verifyMinesReplay(level: Level, seed: number, input: unknown) {
  const moves = minesMoves.safeParse(input);
  if (!moves.success) return false;
  const rng = seededRandom(seed);
  const { width, height } = LEVELS[level];
  let game = newGame(level);
  for (const [action, x, y] of moves.data) {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    if (game.status === 'won' || game.status === 'lost') return false;
    game =
      action === 'flag'
        ? toggleFlag(game, x, y)
        : game.cells[y * width + x].state === 'open'
          ? chord(game, x, y, rng)
          : reveal(game, x, y, rng);
  }
  return game.status === 'won';
}
