/** @jest-environment node */

import { getLeaderboardStore } from '@/lib/leaderboard/store';

const config = {
  UPSTASH_REDIS_REST_URL: 'https://redis.test',
  UPSTASH_REDIS_REST_TOKEN: 'test',
};

it('retries a concurrent update without losing scores or duplicating a retry', async () => {
  jest.replaceProperty(process, 'env', { ...process.env, ...config });
  let value: string | null = null;
  const request = jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (_, init) => {
      const args = JSON.parse(String(init?.body));
      if (args[0] === 'GET') return Response.json({ result: value });
      if (args[0] === 'EVAL') {
        if ((value ?? '') !== args[4]) return Response.json({ result: 0 });
        value = args[5];
        return Response.json({ result: 1 });
      }
      throw new Error('Unexpected Redis command');
    });

  try {
    const store = getLeaderboardStore()!;
    const a = { id: 'a', name: 'Ana', score: 8, at: 1 };
    const b = { id: 'b', name: 'Bima', score: 12, at: 2 };
    await Promise.all([store.submit('snake', a), store.submit('snake', b)]);
    await store.submit('snake', a);
    expect(await store.list('snake')).toEqual([b, a]);
    expect(
      request.mock.calls.filter(
        ([, init]) => JSON.parse(String(init?.body))[0] === 'EVAL',
      ),
    ).toHaveLength(3);
  } finally {
    jest.restoreAllMocks();
  }
});
