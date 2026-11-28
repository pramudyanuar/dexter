/** @jest-environment node */

import { getLeaderboardStore } from '@/features/leaderboard/store';
import {
  fakeSupabaseState,
  supabaseTestEnv,
} from '@/test/fixtures/supabase-state';

it('retries concurrent submissions without losing scores or duplicating a retry', async () => {
  jest.replaceProperty(process, 'env', { ...process.env, ...supabaseTestEnv });
  const database = fakeSupabaseState();

  try {
    const store = getLeaderboardStore()!;
    const a = { id: 'a', name: 'Ana', score: 8, at: 1 };
    const b = { id: 'b', name: 'Bima', score: 12, at: 2 };
    await Promise.all([store.submit('snake', a), store.submit('snake', b)]);
    await store.submit('snake', a);
    expect(await store.list('snake')).toEqual([b, a]);
    expect(await store.listAll()).toEqual({ snake: [b, a] });
    expect(database.mutations).toBe(3);
  } finally {
    jest.restoreAllMocks();
  }
});
