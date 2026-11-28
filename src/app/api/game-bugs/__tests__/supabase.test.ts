/** @jest-environment node */
import { getBugReportStore } from '@/features/game-bugs/store';

test('uses Supabase for report storage and keeps duplicate submissions immutable', async () => {
  const env = process.env;
  process.env = {
    ...env,
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SECRET_KEY: 'sb_secret_test',
  };

  const report = {
    id: 'a'.repeat(64),
    game: 'snake',
    gameTitle: 'Snake Classic',
    pathname: '/games/snake/classic',
    description: 'Arena kosong.',
  };
  const { gameTitle, ...fields } = report;
  const row = { ...fields, game_title: gameTitle, player_name: null };
  const at = 123;
  const fetchMock = jest
    .spyOn(global, 'fetch')
    .mockResolvedValueOnce(new Response(null, { status: 201 }))
    .mockResolvedValueOnce(Response.json([{ ...row, at, done: false }]))
    .mockResolvedValueOnce(Response.json([{ id: report.id }]))
    .mockResolvedValueOnce(Response.json([]))
    .mockResolvedValueOnce(Response.json([{ id: report.id }]));

  try {
    const store = getBugReportStore()!;
    await store.save(report);
    expect(await store.list(10, 5)).toEqual([{ ...report, at, done: false }]);
    expect(await store.change({ id: report.id, at }, 'done')).toBe(true);
    expect(await store.change({ id: report.id, at: at + 1 }, 'reopen')).toBe(
      false,
    );
    expect(await store.change({ id: report.id, at }, 'delete')).toBe(true);

    const requests = fetchMock.mock.calls.map(([input, init]) => ({
      url: new URL(String(input)),
      method: init?.method,
      headers: new Headers(init?.headers),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    }));
    const [save, list, done, reopen, remove] = requests;

    for (const { url, headers } of requests) {
      expect(url.origin).toBe('https://test.supabase.co');
      expect(url.pathname).toBe('/rest/v1/game_bug_reports');
      expect(headers.get('apikey')).toBe('sb_secret_test');
    }
    expect(save.method).toBe('POST');
    expect(save.body).toEqual(row);
    expect(save.url.searchParams.get('on_conflict')).toBe('id');
    expect(save.headers.get('prefer')).toContain(
      'resolution=ignore-duplicates',
    );
    expect(list.url.searchParams.get('order')).toBe('at.desc,id.desc');
    expect(list.url.searchParams.get('offset')).toBe('10');
    expect(list.url.searchParams.get('limit')).toBe('5');
    expect(done.body).toEqual({ done: true });
    expect(reopen.body).toEqual({ done: false });
    expect(remove.method).toBe('DELETE');
    for (const [request, timestamp] of [
      [done, at],
      [reopen, at + 1],
      [remove, at],
    ] as const) {
      expect(request.url.searchParams.get('id')).toBe(`eq.${report.id}`);
      expect(request.url.searchParams.get('at')).toBe(`eq.${timestamp}`);
    }
  } finally {
    fetchMock.mockRestore();
    process.env = env;
  }
});
