/** @jest-environment node */

import { DUEL_TICK_MS } from '@/lib/games/snake-duel';
import { newToken } from '@/lib/rooms/codes';
import type { DuelSession } from '@/lib/snake-duel/protocol';

import {
  GET as getTicket,
  POST as findMatch,
} from '@/app/api/snake/duel/matchmaking/route';
import {
  GET as getRoom,
  POST as act,
} from '@/app/api/snake/duel/rooms/[code]/route';
import {
  GET as listRooms,
  POST as enterRoom,
} from '@/app/api/snake/duel/rooms/route';

const base = 'http://localhost/api/snake/duel';

function ticketRequest(ticket: string, name?: string) {
  return new Request(`${base}/matchmaking`, {
    method: name ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${ticket}` },
    body: name ? JSON.stringify({ name }) : undefined,
  });
}

function roomClient({ code, token }: DuelSession) {
  const context = { params: Promise.resolve({ code }) };
  const url = `${base}/rooms/${code}`;
  const headers = { 'x-player-token': token };
  return {
    poll: (version = 0) =>
      getRoom(new Request(`${url}?v=${version}`, { headers }), context),
    act: (body: object) =>
      act(
        new Request(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        }),
        context,
      ),
  };
}

beforeEach(() => {
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'development' };
  delete env.UPSTASH_REDIS_REST_URL;
  delete env.UPSTASH_REDIS_REST_TOKEN;
  delete env.KV_REST_API_URL;
  delete env.KV_REST_API_TOKEN;
  delete env.SNAKE_DUEL_ENABLED;
  delete env.SNAKE_DUEL_MONTHLY_ROUNDS;
  jest.replaceProperty(process, 'env', env);
});

afterEach(() => jest.restoreAllMocks());

it('lists an open public duel in the shared lobby format', async () => {
  const enter = (body: object) =>
    enterRoom(
      new Request(`${base}/rooms`, {
        method: 'POST',
        body: JSON.stringify({ token: newToken(), ...body }),
      }),
    );
  const created = await enter({
    action: 'create',
    name: '  Satu   Dua ',
    isPublic: true,
  });
  const { session }: { session: DuelSession } = await created.json();
  const readList = async () => (await listRooms()).json();
  expect((await readList()).rooms).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ code: session.code })]),
  );
  await roomClient(session).poll();
  expect((await readList()).rooms).toContainEqual({
    code: session.code,
    name: 'Satu Dua',
    hostName: 'Satu Dua',
    players: 1,
    capacity: 2,
  });
  const joined = await enter({
    action: 'join',
    code: session.code,
    name: 'Tiga',
  });
  expect(joined.status).toBe(201);
  expect((await readList()).rooms).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ code: session.code })]),
  );
});

it('matches two local players and advances their shared room through HTTP', async () => {
  let now = Date.now();
  jest.spyOn(Date, 'now').mockImplementation(() => now);

  const ticket = newToken();
  const queued = await findMatch(ticketRequest(ticket, 'Satu'));
  expect(queued.status).toBe(200);
  expect(await queued.json()).toMatchObject({ status: 'queued' });

  const matched = await findMatch(ticketRequest(newToken(), 'Dua'));
  const { session: secondSeat } = await matched.json();
  const { session: firstSeat } = await (
    await getTicket(ticketRequest(ticket))
  ).json();
  expect(secondSeat).toMatchObject({ code: firstSeat.code, seat: 1 });
  expect(firstSeat.seat).toBe(0);
  const first = roomClient(firstSeat);
  const second = roomClient(secondSeat);

  const unknown = roomClient({ ...firstSeat, token: newToken() });
  expect((await unknown.poll()).status).toBe(403);
  await Promise.all([first.poll(), second.poll()]);
  const ready = await Promise.all([
    first.act({ action: 'ready', ready: true }),
    second.act({ action: 'ready', ready: true }),
  ]);
  expect(ready.map((response) => response.status)).toEqual([204, 204]);

  const { room } = await (await first.poll()).json();
  expect(room.round.phase).toBe('countdown');
  now = room.round.nextAt;
  const { room: playing } = await (await first.poll(room.version)).json();
  expect(playing.round).toMatchObject({ phase: 'playing', arena: { tick: 1 } });
  expect(await (await second.poll(playing.version)).json()).toEqual({
    changed: false,
    version: playing.version,
  });

  const move = { roundId: playing.round.id, dir: 'up', seq: 1 };
  const invalid = await first.act({
    action: 'move',
    move: { ...move, dir: 'north' },
  });
  expect(invalid.status).toBe(400);
  expect((await first.act({ action: 'move', move })).status).toBe(200);
  now += DUEL_TICK_MS;
  const [left, right] = await Promise.all(
    [first, second].map(async (client) => (await client.poll()).json()),
  );
  expect(left.room.round).toEqual(right.room.round);
  expect(left.room.round.arena.tick).toBe(2);
  expect(left.room.round.arena.snakes[0].dir).toBe('up');

  expect((await first.act({ action: 'leave' })).status).toBe(204);
  expect((await first.poll()).status).toBe(403);
});
