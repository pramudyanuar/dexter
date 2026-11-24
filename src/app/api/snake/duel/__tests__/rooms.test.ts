/** @jest-environment node */

import { newToken } from '@/lib/rooms/codes';
import {
  DUEL_UNAVAILABLE,
  DuelStore,
  getDuelStore,
} from '@/lib/snake-duel/store';

import { GET, POST } from '@/app/api/snake/duel/rooms/route';
import {
  GET as getSignal,
  POST as sendSignal,
} from '@/app/api/snake/duel/signal/route';

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
        body: expect.stringContaining('snake:duel:rtc:preview:lobby'),
      }),
    );
  } finally {
    redis.mockRestore();
    env.restore();
  }
});

it('requires a seat token and passes only WebRTC setup data to the signaling store', async () => {
  const url = 'http://localhost/api/snake/duel/signal?room=ABCDE&seat=0';
  expect((await getSignal(new Request(url))).status).toBe(400);

  const token = newToken();
  const headers = { 'x-player-token': token };
  const guest = newToken();
  const output = { names: ['Satu', 'Dua'], guest, signal: null };
  const exchangeSignal = jest.fn().mockResolvedValue(output);
  jest
    .mocked(getDuelStore)
    .mockReturnValue({ exchangeSignal } as unknown as DuelStore);
  const data = { guest, attempt: newToken(), sdp: 'v=0\r\n' };
  const send = (value: unknown) =>
    sendSignal(
      new Request(url, {
        headers,
        method: 'POST',
        body: JSON.stringify(value),
      }),
    );

  expect((await send({ type: 'turn', dir: 'left' })).status).toBe(400);
  const sent = await send(data);
  expect(sent.status).toBe(200);
  expect(sent.headers.get('Cache-Control')).toBe('no-store');
  expect(await sent.json()).toEqual(output);
  expect(exchangeSignal).toHaveBeenCalledWith(
    { code: 'ABCDE', seat: 0, token },
    data,
  );
  expect((await send({ paired: guest })).status).toBe(200);
  expect(exchangeSignal).toHaveBeenLastCalledWith(
    { code: 'ABCDE', seat: 0, token },
    { paired: guest },
  );
  expect((await getSignal(new Request(url, { headers }))).status).toBe(200);
  expect(exchangeSignal).toHaveBeenLastCalledWith({
    code: 'ABCDE',
    seat: 0,
    token,
  });
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
