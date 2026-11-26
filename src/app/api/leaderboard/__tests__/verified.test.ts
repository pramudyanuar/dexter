/** @jest-environment node */
import { Action2048, play2048, start2048 } from '@/lib/games/game2048';
import { newGame, reveal } from '@/lib/games/minesweeper';
import { seededRandom } from '@/lib/games/seeded-random';
import type { MinesMove } from '@/lib/leaderboard/replay';

import { POST as mines } from '@/app/api/leaderboard/mines/route';
import { GET, POST } from '@/app/api/leaderboard/route';

const request = (body: object) =>
  new Request('http://localhost/api/leaderboard', {
    method: 'POST',
    body: JSON.stringify(body),
  });

beforeEach(() => {
  const env = { ...process.env };
  delete env.UPSTASH_REDIS_REST_URL;
  delete env.UPSTASH_REDIS_REST_TOKEN;
  delete env.KV_REST_API_URL;
  delete env.KV_REST_API_TOKEN;
  jest.replaceProperty(process, 'env', env);
  (globalThis as { __leaderboard?: unknown }).__leaderboard = undefined;
});
afterEach(() => jest.restoreAllMocks());

it('uses the replay score and keeps retries on the same entry', async () => {
  const body = { game: 'snake', name: 'Test', score: 300 };
  expect((await POST(request(body))).status).toBe(400);
  expect((await POST(request({ ...body, game: 'uno' }))).status).toBe(400);
  const replay = { seed: 6, moves: { ticks: 10, turns: [] } };
  const result = await POST(request({ ...body, replay }));
  expect(result.status).toBe(201);
  expect(await result.json()).toMatchObject({
    rank: 1,
    entries: [{ score: 1, verified: true }],
  });
  expect(await (await POST(request({ ...body, replay }))).json()).toMatchObject(
    {
      entries: [expect.objectContaining({ score: 1 })],
    },
  );
});

it('uses the 2048 replay to determine the Undo tag', async () => {
  const seed = 12;
  const finish = (
    initial: ReturnType<typeof start2048>,
    moves: Action2048[],
  ) => {
    let run = initial;
    for (let i = 0; i < 500 && !run.over; i++) {
      for (const direction of ['up', 'left', 'down', 'right'] as const) {
        const next = play2048(run, direction);
        if (!next) continue;
        moves.push(direction);
        run = next;
        break;
      }
    }
    return { moves, run };
  };
  const originalRun = finish(start2048(seed), []);
  const body = { game: '2048', name: 'Test', usedUndo: true };
  const original = await POST(
    request({ ...body, replay: { seed, moves: originalRun.moves } }),
  );
  expect(original.status).toBe(201);
  expect((await original.json()).entries[0]).not.toHaveProperty('usedUndo');
  const rewound = play2048(originalRun.run, 'undo')!;
  const assisted = finish(rewound, [...originalRun.moves, 'undo']);
  const undone = await POST(
    request({
      ...body,
      usedUndo: false,
      replay: { seed, moves: assisted.moves },
    }),
  );
  expect(undone.status).toBe(201);
  expect((await undone.json()).entries).toContainEqual(
    expect.objectContaining({
      score: assisted.run.score,
      verified: true,
      usedUndo: true,
    }),
  );
});

it('uses a server-timed Minesweeper win and ranks it in its own difficulty', async () => {
  const now = jest.spyOn(Date, 'now').mockReturnValue(1_000);
  const { seed, ticket } = await (
    await mines(request({ action: 'start', level: 'sedang' }))
  ).json();
  const rng = seededRandom(seed);
  let board = reveal(newGame('sedang'), 0, 0, rng);
  const moves: MinesMove[] = [['open', 0, 0]];
  for (const [i, cell] of board.cells.entries()) {
    if (board.status === 'won') break;
    if (cell.mine || board.cells[i].state !== 'hidden') continue;
    const x = i % board.width;
    const y = Math.floor(i / board.width);
    moves.push(['open', x, y]);
    board = reveal(board, x, y, rng);
  }
  expect(board.status).toBe('won');
  now.mockReturnValue(14_000);
  const finish = await mines(request({ action: 'finish', ticket, moves }));
  expect(finish.status).toBe(200);
  const { receipt, score } = await finish.json();
  expect(score).toBe(13);
  const submit = { game: 'minesweeper', name: 'Test', score: 0 };
  expect((await POST(request({ ...submit, replay: ticket }))).status).toBe(400);
  expect((await POST(request({ ...submit, replay: receipt }))).status).toBe(
    201,
  );

  const entries = async (level: string) =>
    (
      await (
        await GET(
          new Request(
            `http://localhost/api/leaderboard?game=minesweeper&level=${level}`,
          ),
        )
      ).json()
    ).entries;
  expect(await entries('mudah')).toEqual([]);
  expect(await entries('sedang')).toMatchObject([{ score: 13 }]);
});
