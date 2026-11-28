import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--apply') || args.length > 1) {
  throw new Error(
    'Usage: node --env-file=.env.local supabase/scripts/import-legacy-storage.mjs [--apply]',
  );
}

const apply = args.includes('--apply');
const redisUrl =
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;
if (!redisUrl || !redisToken)
  throw new Error('Set the legacy Upstash REST URL and token for this import');
if (apply && (!supabaseUrl || !supabaseKey))
  throw new Error('Set the target Supabase URL and secret key');
const source = new URL(redisUrl);
if (source.protocol !== 'https:')
  throw new Error('The Upstash REST URL must use HTTPS');

const destination = apply
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

async function redis(...args) {
  const response = await fetch(source, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${redisToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(15_000),
    redirect: 'error',
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body || body.error || !Object.hasOwn(body, 'result')) {
    throw new Error(`Legacy ${args[0]} failed (HTTP ${response.status})`);
  }
  return body.result;
}

async function* keys(pattern) {
  let cursor = '0';
  const seen = new Set();
  do {
    const [next, page] = await redis(
      'SCAN',
      cursor,
      'MATCH',
      pattern,
      'COUNT',
      200,
    );
    for (const key of page) {
      if (seen.has(key)) continue;
      seen.add(key);
      yield key;
    }
    cursor = String(next);
  } while (cursor !== '0');
}

async function readKey(key, read = () => redis('GET', key)) {
  const now = Date.now();
  const ttl = await redis('PTTL', key);
  if (ttl === -2 || ttl === 0) return null;
  const value = await read();
  const expiresAt = ttl < 0 ? null : now + ttl;
  if (value === null || (expiresAt !== null && expiresAt <= Date.now()))
    return null;
  return { value, expiresAt };
}

function row(scope, key, value, expiresAt = null) {
  return { scope, key, value: JSON.stringify(value), expires_at: expiresAt };
}

async function* stateRows() {
  const config = await readKey('admin:game-config');
  if (config) yield row('admin', 'game-config', JSON.parse(config.value));

  for await (const key of keys('lb:*')) {
    // The leaderboard keys include legacy classic, mines levels, and daily Snake.
    if (!/^lb:(?:2048|tetris|snake|minesweeper)(?::[\w:-]+)?$/.test(key))
      continue;
    const board = await readKey(key);
    if (board)
      yield row('leaderboard', key, JSON.parse(board.value), board.expiresAt);
  }

  for await (const key of keys('paste:*')) {
    if (!/^paste:[a-f0-9]{64}$/.test(key)) continue;
    const paste = await readKey(key);
    if (paste)
      yield row(
        'paste',
        key.slice(6),
        JSON.parse(paste.value),
        paste.expiresAt,
      );
  }

  for await (const key of keys('room:*')) {
    const match =
      /^room:([ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5})(?::(chat|rtc))?$/.exec(
        key,
      );
    if (!match) continue;
    const [, code, type] = match;
    if (!type) {
      const room = await readKey(key);
      if (room) yield row('rooms', key, JSON.parse(room.value), room.expiresAt);
    } else {
      const lines = await readKey(key, () => redis('LRANGE', key, 0, -1));
      if (lines?.value.length)
        yield row(
          'rooms',
          `${type === 'rtc' ? 'signal' : type}:${code}`,
          lines.value.map((line) => JSON.parse(line)),
          lines.expiresAt,
        );
    }
  }

  for await (const key of keys('bug-reports:draft:*')) {
    const draft = await readKey(key);
    if (draft)
      yield row(
        'rooms',
        `draft:${key.slice('bug-reports:draft:'.length)}`,
        draft.value === 'submitted' ? 'submitted' : JSON.parse(draft.value),
        draft.expiresAt,
      );
  }
  const inbox = (await redis('LRANGE', 'bug-reports:inbox', 0, 49)).map(
    (value) => JSON.parse(value),
  );
  if (inbox.length) {
    const done = await redis(
      'HMGET',
      'bug-reports:inbox:done',
      ...inbox.map(({ id }) => id),
    );
    yield row(
      'rooms',
      'reports',
      inbox.map((report, i) =>
        done[i] === '1' ? { ...report, done: true } : report,
      ),
    );
  }
}

const cleanText = (value) => value.replaceAll('\0', '\uFFFD').toWellFormed();

async function* reportRows() {
  const key = 'game-bug-reports';
  for (let start = 0; ; start += 100) {
    const page = await redis('ZREVRANGE', key, start, start + 99, 'WITHSCORES');
    if (page.length === 0) return;
    const reports = [];
    for (let i = 0; i < page.length; i += 2) {
      const report = JSON.parse(page[i]);
      reports.push({
        id: report.id,
        game: report.game,
        game_title: report.gameTitle,
        pathname: report.pathname,
        description: cleanText(report.description),
        player_name: report.playerName ? cleanText(report.playerName) : null,
        at: Number(page[i + 1]),
      });
    }
    const done = await redis(
      'HMGET',
      `${key}:done`,
      ...reports.map(({ id }) => id),
    );
    for (let i = 0; i < reports.length; i++)
      yield { ...reports[i], done: done[i] === '1' };
    if (page.length < 200) return;
  }
}

async function copy(table, conflict, sourceRows) {
  let batch = [];
  let count = 0;
  const save = async () => {
    if (!batch.length || !destination) return;
    const { error } = await destination
      .from(table)
      .upsert(batch, {
        onConflict: conflict,
        ignoreDuplicates: true,
      })
      .abortSignal(AbortSignal.timeout(15_000));
    if (error)
      throw new Error(
        `Unable to import ${table} (${error.code ?? 'request failed'})`,
      );
  };
  for await (const entry of sourceRows) {
    count++;
    batch.push(entry);
    if (batch.length < 20) continue;
    await save();
    batch = [];
  }
  await save();
  console.log(
    `${table}: ${count} source records ${apply ? 'processed' : 'found'}`,
  );
}

await copy('dexter_state', 'scope,key', stateRows());
await copy('game_bug_reports', 'id', reportRows());
if (!apply) console.log('Preview only. Pass --apply to copy the records.');
