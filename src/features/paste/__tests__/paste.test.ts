/** @jest-environment node */
import { getPasteStore } from '@/features/paste/store';
import {
  generatePasteCode,
  normalizePasteCode,
  PASTE_CODE_PATTERN,
} from '@/features/paste/types';
import {
  fakeSupabaseState,
  supabaseTestEnv,
} from '@/test/fixtures/supabase-state';

describe('paste helpers and store', () => {
  it('normalizes and validates 6-digit codes', () => {
    expect(normalizePasteCode('123 456')).toBe('123456');
    expect(normalizePasteCode('123-456')).toBe('123456');
    expect(PASTE_CODE_PATTERN.test('123456')).toBe(true);
    expect(PASTE_CODE_PATTERN.test('12345')).toBe(false);
    expect(PASTE_CODE_PATTERN.test('abcdef')).toBe(false);
  });

  it('generates valid 6-digit codes', () => {
    for (let i = 0; i < 10; i++) {
      const code = generatePasteCode();
      expect(PASTE_CODE_PATTERN.test(code)).toBe(true);
    }
  });

  it('stores, lists, and prunes expired memos in memory', async () => {
    const store = getPasteStore();
    expect(store).not.toBeNull();
    if (!store) return;

    const code = '987654';
    const now = Date.now();
    await store.update(code, () => [
      {
        id: 'active',
        subject: 'Aktif',
        content: 'Halo dunia',
        createdAt: now,
        expiresAt: now + 60_000,
      },
      {
        id: 'expired',
        subject: 'Kedaluwarsa',
        content: 'Lama',
        createdAt: now - 120_000,
        expiresAt: now - 1_000,
      },
    ]);

    const list = await store.list(code);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('active');

    await store.update(code, () => []);
    expect(await store.list(code)).toHaveLength(0);
  });
});

it('keeps concurrent memo changes in Supabase', async () => {
  const env = jest.replaceProperty(process, 'env', {
    ...process.env,
    ...supabaseTestEnv,
  });
  const database = fakeSupabaseState();
  try {
    const store = getPasteStore()!;
    const code = '123456';
    const now = Date.now();
    const memo = (id: string) => ({
      id,
      subject: id,
      content: id,
      createdAt: now,
      expiresAt: now + 60_000,
    });
    await Promise.all([
      store.update(code, (memos) => [memo('one'), ...memos]),
      store.update(code, (memos) => [memo('two'), ...memos]),
    ]);
    expect((await store.list(code)).map(({ id }) => id).sort()).toEqual([
      'one',
      'two',
    ]);
    expect(
      await store.update(code, (memos) =>
        memos.filter(({ id }) => id !== 'one'),
      ),
    ).toEqual([memo('two')]);
  } finally {
    database.request.mockRestore();
    env.restore();
  }
});
