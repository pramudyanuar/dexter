/** @jest-environment node */
import {
  ADMIN_COOKIE_NAME,
  createAdminCookieValue,
} from '@/lib/rooms/admin-auth';
import { getRoomStore } from '@/lib/rooms/store';

import { GET as inbox } from '@/app/api/admin/bug-reports/route';
import { POST as report } from '@/app/api/rooms/[code]/bug-reports/route';
import { POST as create } from '@/app/api/rooms/route';

const env = process.env;
let ip = 0;
const memory = globalThis as {
  __bugDrafts?: unknown;
  __bugReports?: unknown;
};

beforeEach(() => {
  process.env = { ...env, ADMIN_PASSWORD: 'test-password' };
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  delete memory.__bugDrafts;
  delete memory.__bugReports;
});

afterEach(() => {
  process.env = env;
});

async function createRoom() {
  const response = await create(
    new Request('http://test/api/rooms', {
      method: 'POST',
      headers: { 'x-forwarded-for': `10.11.12.${++ip}` },
      body: JSON.stringify({ game: 'connect4' }),
    }),
  );
  expect(response.status).toBe(200);
  return response.json();
}

function send(code: string, token: string, body: unknown) {
  return report(
    new Request(`http://test/api/rooms/${code}/bug-reports`, {
      method: 'POST',
      headers: { 'x-player-token': token, 'user-agent': 'test browser' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ code }) },
  );
}

function list(authed = true) {
  return inbox(
    new Request('http://test/api/admin/bug-reports', {
      headers: authed
        ? { cookie: `${ADMIN_COOKIE_NAME}=${createAdminCookieValue()}` }
        : {},
    }),
  );
}

it('keeps the captured room version after the game changes and the room is deleted', async () => {
  const { code, token, room } = await createRoom();
  const captured = await send(code, token, { action: 'capture' });
  expect(captured.status).toBe(200);
  const { id } = await captured.json();
  expect(await (await list()).json()).toEqual({ reports: [] });

  const store = getRoomStore()!;
  const current = (await store.get(code))!;
  await store.save({ ...current, version: current.version + 1 });
  await store.delete(code);

  const submit = {
    action: 'submit',
    id,
    description: '  Papan tidak merespons.  ',
  };
  const replies = await Promise.all([
    send(code, token, submit),
    send(code, token, submit),
  ]);
  expect(replies.map((reply) => reply.status)).toEqual([200, 200]);

  expect((await list(false)).status).toBe(401);
  const data = await (await list()).json();
  expect(data.reports).toHaveLength(1);
  expect(data.reports[0]).toMatchObject({
    id,
    description: 'Papan tidak merespons.',
    browser: 'test browser',
    room: { code, version: room.version, status: room.status, seat: 0 },
  });
  expect(JSON.stringify(data)).not.toContain(token);
});

it('restricts capture and submission to the player who opened the report', async () => {
  const { code, token } = await createRoom();
  expect((await send(code, 'wrong', { action: 'capture' })).status).toBe(403);
  const capture = await send(code, token, { action: 'capture' });
  const { id } = await capture.json();
  const submit = { action: 'submit', id, description: 'Kartu tidak muncul.' };
  expect((await send(code, 'wrong', submit)).status).toBe(404);
  expect(
    (await send(code, token, { ...submit, description: ' ' })).status,
  ).toBe(400);
  expect(await (await list()).json()).toEqual({ reports: [] });
  expect((await send(code, token, submit)).status).toBe(200);
});
