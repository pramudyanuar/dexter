type Row = {
  key: string;
  value: string;
  revision: string;
  expires_at: number | null;
};

export const supabaseTestEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
};

export function fakeSupabaseState() {
  const scopes = new Map<string, Map<string, Row>>();
  let mutations = 0;
  let revision = 0;
  const request = jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.origin !== supabaseTestEnv.NEXT_PUBLIC_SUPABASE_URL)
        throw new Error(`Unexpected host ${url.origin}`);
      if (
        new Headers(init?.headers).get('apikey') !==
        supabaseTestEnv.SUPABASE_SECRET_KEY
      ) {
        return Response.json({ message: 'Unauthorized' }, { status: 401 });
      }

      const body = init?.body ? JSON.parse(String(init.body)) : null;
      const scope =
        body?.state_scope ?? url.searchParams.get('scope')?.slice(3);
      if (!scope) throw new Error('Missing state scope');
      const rows = scopes.get(scope) ?? new Map<string, Row>();
      scopes.set(scope, rows);
      const active = (row?: Row) =>
        row && (row.expires_at === null || row.expires_at > Date.now());

      if (url.pathname.endsWith('/rpc/dexter_commit_state')) {
        mutations++;
        const changes = body.changes as (Omit<Row, 'revision' | 'value'> & {
          revision: string | null;
          value: string | null;
          write: boolean;
        })[];
        for (const change of changes) {
          const row = rows.get(change.key);
          if ((active(row) ? row!.revision : null) !== change.revision)
            return Response.json(false);
        }
        for (const change of changes) {
          if (!change.write) continue;
          if (change.value === null) rows.delete(change.key);
          else
            rows.set(change.key, {
              key: change.key,
              value: change.value,
              expires_at: change.expires_at,
              revision: String(++revision),
            });
        }
        return Response.json(true);
      }

      if (!url.pathname.endsWith('/dexter_state'))
        throw new Error(`Unexpected URL ${url.pathname}`);
      const filter = url.searchParams.get('key') ?? '';
      let found = [...rows.values()].filter((row) => active(row));
      if (filter.startsWith('in.(')) {
        const keys = filter
          .slice(4, -1)
          .split(',')
          .map((key) => key.replace(/^"|"$/g, ''));
        found = found.filter(({ key }) => keys.includes(key));
      } else if (filter.startsWith('like.')) {
        found = found.filter(({ key }) => key.startsWith(filter.slice(5, -1)));
      }
      const order = url.searchParams.get('order');
      if (order?.startsWith('expires_at')) {
        found.sort(
          (a, b) =>
            (b.expires_at ?? 0) - (a.expires_at ?? 0) ||
            b.key.localeCompare(a.key),
        );
      } else if (order) found.sort((a, b) => a.key.localeCompare(b.key));
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? found.length);
      return Response.json(found.slice(offset, offset + limit));
    });

  return {
    request,
    scopes,
    get mutations() {
      return mutations;
    },
  };
}
