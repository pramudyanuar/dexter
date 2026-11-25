import { z } from 'zod';

import { GRID } from '@/lib/games/snake';
import { DUEL_ROUND_MS, DUEL_TICK_MS } from '@/lib/games/snake-duel';
import { DuelFrame } from '@/lib/snake-duel/match';

const dir = z.enum(['up', 'right', 'down', 'left']);
const coord = z
  .int()
  .min(0)
  .max(GRID - 1);
const point = z.object({ x: coord, y: coord });
const snake = z.object({
  snake: z
    .array(point)
    .min(3)
    .max(GRID * GRID),
  dir,
  score: z
    .int()
    .min(0)
    .max(GRID * GRID - 3),
});
const frame = z.object({
  ready: z.tuple([z.boolean(), z.boolean()]),
  round: z
    .object({
      id: z.int().positive(),
      phase: z.enum(['countdown', 'playing', 'over']),
      stepInMs: z.number().min(0).max(3000),
      turns: z.tuple([dir.nullable(), dir.nullable()]),
      arena: z.object({
        snakes: z.tuple([snake, snake]),
        food: point.nullable(),
        tick: z
          .int()
          .min(0)
          .max(DUEL_ROUND_MS / DUEL_TICK_MS),
        result: z
          .object({
            winner: z.union([z.literal(0), z.literal(1), z.null()]),
            reason: z.enum(['collision', 'time', 'full']),
          })
          .nullable(),
      }),
    })
    .nullable(),
}) satisfies z.ZodType<DuelFrame>;

const message = z.discriminatedUnion('type', [
  z.object({ type: z.literal('state'), frame }),
  z.object({ type: z.literal('turn'), id: z.int().positive(), dir }),
  z.object({ type: z.literal('ready'), ready: z.boolean() }),
  z.object({ type: z.literal('ping') }),
  z.object({ type: z.literal('leave') }),
]);

export type DuelMessage = z.infer<typeof message>;

export function readDuelMessage(raw: unknown): DuelMessage | null {
  if (typeof raw !== 'string' || raw.length > 16_384) return null;
  try {
    const parsed = message.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
