/** @jest-environment node */

import { GET, POST } from '@/app/api/snake/duel/rooms/route';
import {
  GET as getSignal,
  POST as sendSignal,
} from '@/app/api/snake/duel/signal/route';
import { newToken } from '@/features/rooms/codes';
import {
  DUEL_UNAVAILABLE,
  DuelStore,
  getDuelStore,
} from '@/features/snake-duel/store';
import {
  fakeSupabaseState,
  supabaseTestEnv,
} from '@/test/fixtures/supabase-state';

jest.mock('@/features/snake-duel/store', () => ({
  ...jest.requireActual('@/features/snake-duel/store'),
  getDuelStore: jest.fn(),
}));

const realGetStore = jest.requireActual<
  typeof import('@/features/snake-duel/store')
>('@/features/snake-duel/store').getDuelStore;

it('uses Supabase and the Preview namespace even with obsolete Duel settings', async () => {
  const env = jest.replaceProperty(process, 'env', {
    ...process.env,
    ...supabaseTestEnv,
    VERCEL_ENV: 'preview',
    SNAKE_DUEL_ENABLED: '0',
    SNAKE_DUEL_MONTHLY_ROUNDS: '0',
    SNAKE_DUEL_NAMESPACE: 'old',
  });
  const database = fakeSupabaseState();
  jest.mocked(getDuelStore).mockImplementationOnce(realGetStore);
  try {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ rooms: [] });
    expect(database.scopes.has('snake-duel:preview')).toBe(true);
  } finally {
    database.request.mockRestore();
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

it('returns 503 when Supabase is missing', async () => {
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

it('matches concurrent queue requests and keeps seat ownership through signaling', async () => {
  const env = jest.replaceProperty(process, 'env', {
    ...process.env,
    ...supabaseTestEnv,
  });
  const database = fakeSupabaseState();
  try {
    const store = realGetStore();
    await Promise.all([
      store.queue('first', 'Satu'),
      store.queue('second', 'Dua'),
    ]);
    const first = await store.ticket('first');
    const second = await store.ticket('second');
    expect(first?.status).toBe('matched');
    expect(second?.status).toBe('matched');
    if (first?.status !== 'matched' || second?.status !== 'matched')
      throw new Error('Match missing');

    const [host, guest] = [first.session, second.session].sort(
      (a, b) => a.seat - b.seat,
    );
    expect(host.code).toBe(guest.code);
    expect(await store.cancel('first')).toEqual(first);
    await expect(
      store.exchangeSignal({ ...host, token: newToken() }),
    ).rejects.toMatchObject({ status: 403 });

    const initial = await store.exchangeSignal(host);
    expect(initial.names).toEqual(
      host.token === first.session.token ? ['Satu', 'Dua'] : ['Dua', 'Satu'],
    );
    const signal = {
      guest: initial.guest!,
      attempt: newToken(),
      sdp: 'v=0\r\n',
    };
    await store.exchangeSignal(guest, signal);
    expect((await store.exchangeSignal(host)).signal).toEqual(signal);
    await expect(
      store.exchangeSignal(host, { paired: newToken() }),
    ).rejects.toMatchObject({ status: 409 });
    await store.exchangeSignal(host, { paired: signal.guest });
    expect((await store.exchangeSignal(host)).guest).toBe(signal.guest);
  } finally {
    database.request.mockRestore();
    env.restore();
  }
});
