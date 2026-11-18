/** @jest-environment node */

import { GET, POST } from '@/app/api/snake/daily/route';

it('validates a replay and derives the rank from the server score', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-18T17:04:00Z'));
  try {
    const { day, version } = await (await GET()).json();
    const send = (ticks: number) =>
      POST(
        new Request('http://localhost/api/snake/daily', {
          method: 'POST',
          body: JSON.stringify({
            day,
            version,
            name: 'Ayu',
            playerId: '532e0eb8-c252-4c1a-bd63-f56ecad2191d',
            replay: { ticks, turns: [] },
            score: 999,
          }),
        }),
      );
    expect((await send(5)).status).toBe(400);
    const saved = await send(10);
    expect(saved.status).toBe(201);
    const { entries, rank } = await saved.json();
    expect(rank).toBe(1);
    expect(entries).toHaveLength(1);
    expect(entries[0].score).toBeLessThan(10);
    expect((await (await send(10)).json()).entries).toHaveLength(1);
  } finally {
    jest.restoreAllMocks();
  }
});
