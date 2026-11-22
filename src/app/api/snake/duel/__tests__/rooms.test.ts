/** @jest-environment node */

import { newToken } from '@/lib/rooms/codes';
import { DuelStore, getDuelStore } from '@/lib/snake-duel/store';

import { GET, POST } from '@/app/api/snake/duel/rooms/route';

jest.mock('@/lib/snake-duel/store', () => ({
  ...jest.requireActual('@/lib/snake-duel/store'),
  getDuelStore: jest.fn(),
}));

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
