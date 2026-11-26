/** @jest-environment node */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { getBugReportStore } from '@/lib/game-bugs/store';
import { BUG_REPORT_PAGE_SIZE } from '@/lib/game-bugs/types';
import {
  ADMIN_COOKIE_NAME,
  createAdminCookieValue,
} from '@/lib/rooms/admin-auth';
import { getRoomStore } from '@/lib/rooms/store';

import { GET as inbox } from '@/app/api/admin/bug-reports/route';
import { DELETE, GET, PATCH } from '@/app/api/admin/game-bugs/route';
import { GET as exportReports } from '@/app/api/game-bugs/export/route';
import { PATCH as patchPublicReport } from '@/app/api/game-bugs/route';
import { POST as report } from '@/app/api/rooms/[code]/bug-reports/route';
import { POST as create } from '@/app/api/rooms/route';

const env = process.env;
let directory: string;
let ip = 0;
const memory = globalThis as {
  __bugDrafts?: unknown;
  __bugReports?: unknown;
};

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'dexter-room-bugs-'));
  jest.spyOn(process, 'cwd').mockReturnValue(directory);
  process.env = { ...env, ADMIN_PASSWORD: 'test-password' };
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  delete memory.__bugDrafts;
  delete memory.__bugReports;
});

afterEach(async () => {
  process.env = env;
  jest.restoreAllMocks();
  await rm(directory, { recursive: true, force: true });
});

async function createRoom() {
  const response = await create(
    new Request('http://test/api/rooms', {
      method: 'POST',
      headers: { 'x-forwarded-for': `10.11.12.${++ip}` },
      body: JSON.stringify({ game: 'connect4', name: 'Budi' }),
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
    playerName: 'Budi',
    browser: 'test browser',
    room: { code, version: room.version, status: room.status, seat: 0 },
  });
  expect(JSON.stringify(data)).not.toContain(token);

  const url = 'http://test/api/admin/game-bugs';
  const headers = {
    cookie: `${ADMIN_COOKIE_NAME}=${createAdminCookieValue()}`,
  };
  const getPage = async () => (await GET(new Request(url, { headers }))).json();
  const page = await getPage();
  expect(page).toMatchObject({
    hasMore: false,
    reports: [
      { id, done: false, playerName: 'Budi', snapshot: data.reports[0] },
    ],
  });

  const target = `${url}?source=room&id=${id}&at=${page.reports[0].at}`;
  const patch = (done: boolean) =>
    PATCH(
      new Request(target, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ done }),
      }),
    );
  expect((await DELETE(new Request(target, { method: 'DELETE' }))).status).toBe(
    401,
  );
  expect((await patch(true)).status).toBe(204);
  expect((await getPage()).reports[0].done).toBe(true);
  expect((await patch(false)).status).toBe(204);
  expect(await getPage()).toEqual(page);
  expect(
    (await DELETE(new Request(target, { method: 'DELETE', headers }))).status,
  ).toBe(204);
  expect(await getPage()).toEqual({ hasMore: false, reports: [] });
  expect((await send(code, token, submit)).status).toBe(200);
  expect(await (await list()).json()).toEqual({ reports: [] });
});

it('lists reports from both stores in time order across pages', async () => {
  const { code, token } = await createRoom();
  const { id } = await (await send(code, token, { action: 'capture' })).json();
  expect(
    (await send(code, token, { action: 'submit', id, description: 'Room bug' }))
      .status,
  ).toBe(200);
  const [snapshot] = await getRoomStore()!.listBugReports();
  const store = getBugReportStore()!;
  const now = jest.spyOn(Date, 'now');
  const generalIds = [];
  const roomIndex = BUG_REPORT_PAGE_SIZE * 3 + 2;
  for (let index = 0; index < roomIndex + 3; index++) {
    const generalId = index.toString(16).padStart(64, '0');
    generalIds.push(generalId);
    now.mockReturnValue(snapshot.submittedAt + (roomIndex - index) * 2 - 1);
    await store.save({
      id: generalId,
      game: 'pictionary',
      gameTitle: 'Pictionary',
      pathname: '/games/pictionary',
      description: 'General bug',
    });
  }
  now.mockRestore();

  const expected = [...generalIds];
  expected.splice(roomIndex, 0, id);
  const headers = {
    cookie: `${ADMIN_COOKIE_NAME}=${createAdminCookieValue()}`,
  };
  for (
    let offset = 0;
    offset < expected.length;
    offset += BUG_REPORT_PAGE_SIZE
  ) {
    const request = new Request(
      `http://test/api/admin/game-bugs?offset=${offset}`,
      { headers },
    );
    const response = await GET(request);
    expect(response.status).toBe(200);
    const { reports, hasMore } = await response.json();
    const end = offset + BUG_REPORT_PAGE_SIZE;
    expect(reports.map((entry: { id: string }) => entry.id)).toEqual(
      expected.slice(offset, end),
    );
    expect(hasMore).toBe(end < expected.length);
  }
});

it('exports all retained reports and updates their status without credentials', async () => {
  const { code, token } = await createRoom();
  const { id: roomId } = await (
    await send(code, token, { action: 'capture' })
  ).json();
  expect(
    (
      await send(code, token, {
        action: 'submit',
        id: roomId,
        description: 'Room bug',
      })
    ).status,
  ).toBe(200);

  const store = getBugReportStore()!;
  const generalIds = Array.from({ length: BUG_REPORT_PAGE_SIZE + 1 }, (_, i) =>
    i.toString(16).padStart(64, '0'),
  );
  for (const id of generalIds) {
    await store.save({
      id,
      game: 'pictionary',
      gameTitle: 'Pictionary',
      pathname: '/games/pictionary',
      description: 'General bug',
      playerName: 'Private name',
    });
  }

  async function readExport() {
    const response = await exportReports();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/x-ndjson');
    expect(response.headers.get('cache-control')).toBe('no-store');
    return (await response.text())
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
  }

  const reports = await readExport();
  expect(reports.map(({ id }) => id).sort()).toEqual(
    [...generalIds, roomId].sort(),
  );
  const general = reports.find(({ id }) => id === generalIds[0]);
  const roomReport = reports.find(({ id }) => id === roomId);
  expect(general).toEqual({
    id: generalIds[0],
    source: 'game',
    game: 'pictionary',
    gameTitle: 'Pictionary',
    pathname: '/games/pictionary',
    description: 'General bug',
    at: expect.any(Number),
    status: 'open',
  });
  expect(roomReport).toEqual({
    id: roomId,
    source: 'room',
    game: 'connect4',
    gameTitle: expect.any(String),
    pathname: '/games/connect4',
    description: 'Room bug',
    at: expect.any(Number),
    status: 'open',
  });

  function patch(
    { source, id, at }: { source: string; id: string; at: number },
    done: unknown,
  ) {
    return patchPublicReport(
      new Request(
        `http://test/api/game-bugs?source=${source}&id=${id}&at=${at}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ done, description: 'Unexpected change' }),
        },
      ),
    );
  }

  expect((await patch(general, 'true')).status).toBe(400);
  expect((await patch({ ...general, at: general.at + 1 }, true)).status).toBe(
    404,
  );
  expect((await patch(general, true)).status).toBe(204);
  expect((await patch(roomReport, true)).status).toBe(204);
  expect(await readExport()).toEqual(
    reports.map((entry) =>
      [general.id, roomId].includes(entry.id)
        ? { ...entry, status: 'done' }
        : entry,
    ),
  );
  expect((await patch(general, false)).status).toBe(204);
  expect((await patch(roomReport, false)).status).toBe(204);
  expect(await readExport()).toEqual(reports);
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
