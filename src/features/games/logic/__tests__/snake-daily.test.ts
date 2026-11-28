import {
  canSubmitDaily,
  dailyChallenge,
  readSnakeReplay,
  replayDaily,
} from '@/features/games/logic/snake-daily';
import {
  getDailyLeaderboardStore,
  getLeaderboardStore,
} from '@/features/leaderboard/store';

describe('Snake Harian', () => {
  const now = Date.parse('2026-11-18T17:04:00Z');
  const { day } = dailyChallenge(now);

  it('uses a shared WIB date and gives the previous day a 15-minute grace window', () => {
    expect(day).toBe('2026-11-19');
    expect(dailyChallenge(now + 15_000)).toEqual(dailyChallenge(now));
    expect(dailyChallenge(now - 86_400_000).seed).not.toBe(
      dailyChallenge(now).seed,
    );
    expect(canSubmitDaily('2026-11-18', now)).toBe(true);
    expect(
      canSubmitDaily('2026-11-18', Date.parse('2026-11-18T17:15:00Z')),
    ).toBe(false);
  });

  it('derives a score from a complete replay and rejects invalid directions or timing', () => {
    const straight = { ticks: 10, turns: [] };
    expect(replayDaily(day, straight)).toEqual(expect.any(Number));
    expect(replayDaily(day, { ticks: 9, turns: [] })).toBeNull();
    expect(replayDaily(day, { ticks: 11, turns: [] })).toBeNull();
    expect(replayDaily(day, { ticks: 10, turns: [[1, 'left']] })).toBeNull();
    expect(readSnakeReplay({ ticks: 2001, turns: [] })).toBeNull();
    expect(
      readSnakeReplay({
        ticks: 10,
        turns: [
          [2, 'up'],
          [2, 'right'],
        ],
      }),
    ).toBeNull();
  });

  it('keeps one best score per day without changing Classic scores', async () => {
    const daily = getDailyLeaderboardStore(day, 1)!;
    const yesterday = getDailyLeaderboardStore('2026-11-18', 1)!;
    const classic = getLeaderboardStore()!;
    const entry = { id: 'device', name: 'Player', score: 4, at: 1 };
    await daily.clear('snake');
    await yesterday.clear('snake');
    await classic.clear('snake');
    await classic.submit('snake', entry);
    await daily.submit('snake', { ...entry, score: 6 });
    await daily.submit('snake', { ...entry, score: 5, at: 2 });
    await daily.submit('snake', { ...entry, score: 8, at: 3 });
    expect(await daily.list('snake')).toEqual([{ ...entry, score: 8, at: 3 }]);
    expect(await yesterday.list('snake')).toEqual([]);
    expect(await classic.list('snake')).toEqual([entry]);
  });
});
