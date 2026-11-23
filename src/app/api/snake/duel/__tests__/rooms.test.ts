/** @jest-environment node */

import { newToken } from '@/lib/rooms/codes';
import { DuelStore, getDuelStore } from '@/lib/snake-duel/store';

import { GET, POST } from '@/app/api/snake/duel/rooms/route';

jest.mock('@/lib/snake-duel/store', () => ({
  ...jest.requireActual('@/lib/snake-duel/store'),
  getDuelStore: jest.fn(),
}));

it('explains when Duel is disabled without trying to access storage', async () => {
  const env = jest.replaceProperty(process, 'env', {
    ...process.env,
    SNAKE_DUEL_ENABLED: '0',
  });
  jest
    .mocked(getDuelStore)
    .mockImplementationOnce(
      jest.requireActual<typeof import('@/lib/snake-duel/store')>(
        '@/lib/snake-duel/store',
      ).getDuelStore,
    );
  try {
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error:
        'Snake Duel belum diaktifkan. Kamu masih bisa bermain Klasik atau Harian.',
    });
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
