/** @jest-environment node */

import { newToken } from '@/lib/rooms/codes';
import {
  DUEL_UNAVAILABLE,
  DuelStore,
  getDuelStore,
} from '@/lib/snake-duel/store';

import { GET, POST } from '@/app/api/snake/duel/rooms/route';

jest.mock('@/lib/snake-duel/store', () => ({
  ...jest.requireActual('@/lib/snake-duel/store'),
  getDuelStore: jest.fn(),
}));

const realGetStore = jest.requireActual<
  typeof import('@/lib/snake-duel/store')
>('@/lib/snake-duel/store').getDuelStore;

it('uses shared Redis and the Preview namespace even with obsolete Duel settings', async () => {
  const env = jest.replaceProperty(process, 'env', {
    ...process.env,
    UPSTASH_REDIS_REST_URL: 'https://redis.example.test',
    UPSTASH_REDIS_REST_TOKEN: 'test-token',
    VERCEL_ENV: 'preview',
    SNAKE_DUEL_ENABLED: '0',
    SNAKE_DUEL_MONTHLY_ROUNDS: '0',
    SNAKE_DUEL_NAMESPACE: 'old',
  });
  const redis = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(Response.json({ result: [] }));
  jest.mocked(getDuelStore).mockImplementationOnce(realGetStore);
  try {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ rooms: [] });
    expect(redis).toHaveBeenCalledWith(
      'https://redis.example.test',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('snake:duel:preview:lobby'),
      }),
    );
  } finally {
    redis.mockRestore();
    env.restore();
  }
});

it('returns 503 when shared Redis is missing', async () => {
  const env = jest.replaceProperty(process, 'env', { NODE_ENV: 'test' });
  jest.mocked(getDuelStore).mockImplementationOnce(realGetStore);
  try {
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: DUEL_UNAVAILABLE });
  } finally {
    env.restore();
  }
});

it('creates a public duel and exposes it in the shared lobby format', async () => {
  const token = newToken();
  const session = { code: 'ABCDE', seat: 0, token };
  const createRoom = jest.fn().mockResolvedValue(session);
  const listRooms = jest
    .fn()
    .mockResolvedValue([{ code: session.code, name: 'Satu Dua' }]);
  jest.mocked(getDuelStore).mockReturnValue({
    allowAdmission: jest.fn().mockResolvedValue(true),
    createRoom,
    listRooms,
  } as unknown as DuelStore);

  const created = await POST(
    new Request('http://localhost/api/snake/duel/rooms', {
      method: 'POST',
      body: JSON.stringify({
        action: 'create',
        name: '  Satu   Dua ',
        public: true,
        token,
      }),
    }),
  );
  expect(created.status).toBe(201);
  expect(await created.json()).toEqual({ session });
  expect(createRoom).toHaveBeenCalledWith('Satu Dua', true, token);

  const listing = await GET();
  expect(await listing.json()).toEqual({
    rooms: [
      {
        code: session.code,
        name: 'Satu Dua',
        hostName: 'Satu Dua',
        players: 1,
        capacity: 2,
      },
    ],
  });
});
