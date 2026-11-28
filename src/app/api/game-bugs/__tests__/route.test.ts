/** @jest-environment node */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DELETE, GET, PATCH } from '@/app/api/admin/game-bugs/route';
import { POST } from '@/app/api/game-bugs/route';
import { getBugReportGame } from '@/features/game-bugs/types';
import { createAdminCookieValue } from '@/features/rooms/admin-auth';

const env = process.env;

test('records the player name and lets only admins resolve, reopen, and delete reports', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dexter-game-bugs-'));
  const cwd = jest.spyOn(process, 'cwd').mockReturnValue(dir);
  process.env = {
    ...env,
    ADMIN_PASSWORD: 'test-admin',
    SUPABASE_SECRET_KEY: '',
  };

  const submit = (pathname: string, description: string, playerName?: string) =>
    POST(
      new Request('http://localhost/api/game-bugs', {
        method: 'POST',
        body: JSON.stringify({
          pathname,
          description,
          requestId: '1-2-3-4',
          playerName,
        }),
      }),
    );
  const list = (cookie = '') =>
    GET(
      new Request('http://localhost/api/admin/game-bugs', {
        headers: { cookie },
      }),
    );

  try {
    expect((await submit('/games/leaderboard', 'Bug')).status).toBe(400);
    expect((await submit('/games/snake/daily?room=ABCD', 'Bug')).status).toBe(
      400,
    );
    expect((await submit('/games/snake/daily', '   ')).status).toBe(400);

    const first = await submit(
      '/games/snake/daily',
      '  Arena kosong.  ',
      '  Budi\u0000  ',
    );
    const retry = await submit('/games/snake/daily', 'Arena kosong.', 'Budi');
    expect(first.status).toBe(201);
    expect(retry.status).toBe(201);
    const receipt = await first.json();
    expect(await retry.json()).toEqual(receipt);
    expect((await list()).status).toBe(401);

    const cookie = `dexter_admin=${createAdminCookieValue()}`;
    const signed = await list(cookie);
    expect(signed.headers.get('cache-control')).toBe('no-store');
    const initial = await signed.json();
    expect(initial).toEqual({
      hasMore: false,
      reports: [
        {
          id: receipt.id,
          game: 'snake',
          gameTitle: 'Snake Harian',
          pathname: '/games/snake/daily',
          description: 'Arena kosong.',
          playerName: 'Budi',
          at: expect.any(Number),
          done: false,
        },
      ],
    });

    const url = `http://localhost/api/admin/game-bugs?id=${receipt.id}&at=${initial.reports[0].at}`;
    const patch = (done: unknown, signedCookie = cookie) =>
      PATCH(
        new Request(url, {
          method: 'PATCH',
          headers: { cookie: signedCookie },
          body: JSON.stringify({ done }),
        }),
      );
    const remove = (signedCookie = cookie) =>
      DELETE(
        new Request(url, {
          method: 'DELETE',
          headers: { cookie: signedCookie },
        }),
      );
    const reports = async () => (await (await list(cookie)).json()).reports;

    expect((await patch(true, '')).status).toBe(401);
    expect((await remove('')).status).toBe(401);
    expect((await patch('true')).status).toBe(400);
    expect((await patch(true)).status).toBe(204);
    expect(await reports()).toEqual([{ ...initial.reports[0], done: true }]);
    expect((await patch(false)).status).toBe(204);
    expect(await reports()).toEqual(initial.reports);
    expect((await patch(true)).status).toBe(204);
    expect((await remove()).status).toBe(204);
    expect((await patch(true)).status).toBe(404);
    expect(await reports()).toEqual([]);

    expect((await submit('/games/wordle', 'Keyboard hilang.')).status).toBe(
      201,
    );
    expect(await reports()).toEqual([
      expect.objectContaining({ game: 'wordle', done: false }),
    ]);
    expect((await reports())[0]).not.toHaveProperty('playerName');
  } finally {
    process.env = env;
    cwd.mockRestore();
    await rm(dir, { recursive: true, force: true });
  }
});

test('recognizes hidden variants and excludes non-game pages', () => {
  expect(getBugReportGame('/games/unoflip')?.game).toBe('unoflip');
  expect(getBugReportGame('/games/snake/duel')?.gameTitle).toBe('Snake Duel');
  expect(getBugReportGame('/games')).toBeNull();
});
