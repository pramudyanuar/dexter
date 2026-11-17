import { getPasteStore } from '@/lib/paste/store';
import {
  generatePasteCode,
  normalizePasteCode,
  PASTE_CODE_PATTERN,
} from '@/lib/paste/types';

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
    await store.save(code, [
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

    await store.save(code, []);
    expect(await store.list(code)).toHaveLength(0);
  });
});
