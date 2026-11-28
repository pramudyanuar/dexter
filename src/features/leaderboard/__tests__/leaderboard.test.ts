/**
 * @jest-environment node
 */
import { getLeaderboardStore } from '@/features/leaderboard/store';

describe('leaderboard store', () => {
  it('sorts higher-is-better games descending and caps at 20', async () => {
    const store = getLeaderboardStore();
    expect(store).not.toBeNull();
    if (!store) return;

    await store.clear('2048');
    await store.submit('2048', { id: 'a', name: 'Andi', score: 512, at: 1 });
    const res = await store.submit('2048', {
      id: 'b',
      name: 'Budi',
      score: 2048,
      at: 2,
    });

    expect(res.rank).toBe(1);
    expect(res.entries[0].name).toBe('Budi');
    expect(res.entries[1].name).toBe('Andi');
  });

  it('sorts minesweeper ascending (faster seconds first)', async () => {
    const store = getLeaderboardStore();
    if (!store) return;

    await store.clear('minesweeper');
    await store.submit('minesweeper', {
      id: 'slow',
      name: 'Andi',
      score: 45,
      at: 1,
    });
    const res = await store.submit('minesweeper', {
      id: 'fast',
      name: 'Citra',
      score: 18,
      at: 2,
    });

    expect(res.rank).toBe(1);
    expect(res.entries[0].name).toBe('Citra');
  });
});
