/** @jest-environment node */
import { newRoom as makeRoom } from '@/features/rooms/engine';
import { getRoomStore } from '@/features/rooms/store';
import {
  fakeSupabaseState,
  supabaseTestEnv,
} from '@/test/fixtures/supabase-state';

const newRoom = (code: string, token: string) =>
  makeRoom('connect4', code, token);

const OLD = { ...process.env };
beforeEach(() => {
  process.env = { ...OLD };
  delete process.env.SUPABASE_SECRET_KEY;
  (globalThis as { __rooms?: unknown }).__rooms = undefined;
});

afterEach(() => {
  process.env = OLD;
  jest.restoreAllMocks();
});

describe('choosing a store', () => {
  it('uses memory in development, nothing in production', () => {
    expect(getRoomStore()).not.toBeNull();
    process.env = { ...process.env, NODE_ENV: 'production' };
    expect(getRoomStore()).toBeNull();
  });

  it('uses Supabase when server credentials are configured', () => {
    process.env = {
      ...process.env,
      ...supabaseTestEnv,
      NODE_ENV: 'production',
    };
    expect(getRoomStore()).not.toBeNull();
  });
});

describe('memory store', () => {
  it('creates once per code, and returns copies', async () => {
    const store = getRoomStore()!;
    const room = newRoom('ABCDE', 'a');
    expect(await store.create(room)).toBe(true);
    expect(await store.create(newRoom('ABCDE', 'other'))).toBe(false);

    const loaded = (await store.get('ABCDE'))!;
    expect(loaded.tokens[0]).toBe('a');
    loaded.version = 99; // editing the copy must not touch what is stored
    expect((await store.get('ABCDE'))!.version).toBe(1);
    expect(await store.get('ZZZZZ')).toBeNull();
  });

  it('saves changes', async () => {
    const store = getRoomStore()!;
    await store.create(newRoom('ABCDE', 'a'));
    await store.save({ ...newRoom('ABCDE', 'a'), version: 5 });
    expect((await store.get('ABCDE'))!.version).toBe(5);
  });

  it('forgets rooms after their lifetime', async () => {
    const store = getRoomStore()!;
    await store.create(newRoom('ABCDE', 'a'));
    const spy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(Date.now() + 3 * 3600 * 1000);
    expect(await store.get('ABCDE')).toBeNull();
    spy.mockRestore();
  });
});

describe('Supabase room store', () => {
  beforeEach(() => {
    process.env = {
      ...process.env,
      ...supabaseTestEnv,
      NODE_ENV: 'production',
    };
  });

  it('stores a room under room:CODE with a two hour expiry', async () => {
    const { scopes, request } = fakeSupabaseState();
    const store = getRoomStore()!;
    const now = Date.now();

    expect(await store.create(newRoom('ABCDE', 'a'))).toBe(true);
    const row = scopes.get('rooms')?.get('room:ABCDE');
    expect(row?.expires_at).toBeGreaterThanOrEqual(now + 7_200_000);
    expect(JSON.parse(row!.value).code).toBe('ABCDE');
    expect(new Headers(request.mock.calls[0][1]?.headers).get('apikey')).toBe(
      supabaseTestEnv.SUPABASE_SECRET_KEY,
    );
    expect(await store.listCodes()).toEqual(['ABCDE']);
  });

  it('never replaces an existing code, and rejects a stale room version', async () => {
    fakeSupabaseState();
    const store = getRoomStore()!;
    const room = newRoom('ABCDE', 'a');
    const created = await Promise.all([store.create(room), store.create(room)]);
    expect(created.sort()).toEqual([false, true]);
    expect(await store.saveIf({ ...room, version: 3 }, 1)).toBe(true);
    expect(await store.saveIf({ ...room, version: 2 }, 1)).toBe(false);
    expect((await store.get('ABCDE'))!.version).toBe(3);
    await store.delete('ABCDE');
    expect(await store.get('ABCDE')).toBeNull();
  });

  it('surfaces a backend error', async () => {
    fakeSupabaseState();
    process.env.SUPABASE_SECRET_KEY = 'wrong';
    await expect(getRoomStore()!.get('ABCDE')).rejects.toMatchObject({
      message: 'Unauthorized',
    });
  });
});
