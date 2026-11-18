import {
  advanceRound,
  beginRound,
  DuelInput,
  Presence,
} from '@/lib/snake-duel/room';

const input: DuelInput = {
  player: 'one',
  roundId: 'round',
  seq: 1,
  dir: 'down',
};

it('recovers from a disconnect without stepping the board during the pause', () => {
  const now = 100_000;
  const present = (offset: number): [Presence, Presence] => [
    { id: 'one', seenAt: now + offset },
    { id: 'two', seenAt: now + offset },
  ];
  const round = beginRound('round', 0, now);
  const playing = advanceRound(round, present(3000), [input, null], now + 3000);
  expect(playing.phase).toBe('playing');
  expect(playing.arena.snakes[0].dir).toBe('down');
  const [first, second] = present(3600);
  const paused = advanceRound(
    playing,
    [first, { ...second, closedAt: now + 3500 }],
    [null, null],
    now + 3600,
  );
  expect(paused).toMatchObject({ phase: 'paused', arena: { tick: 1 } });
  const resumed = advanceRound(paused, present(4800), [null, null], now + 4800);
  expect(resumed).toMatchObject({ phase: 'countdown', arena: { tick: 1 } });
  const next = advanceRound(resumed, present(5100), [input, null], now + 5100);
  expect(next.arena.tick).toBe(2);
  expect(next.inputs[0]).toEqual(input);
});

it('ends the round if a reconnect exceeds its grace period', () => {
  const round = beginRound('round', 0, 100_000);
  const first = { id: 'old', seenAt: 105_000, closedAt: 105_000 };
  const second = { id: 'two', seenAt: 115_000 };
  expect(
    advanceRound(round, [first, second], [null, null], 115_000).arena.result,
  ).toEqual({ winner: 1, reason: 'forfeit' });
  expect(
    advanceRound(
      round,
      [first, { ...second, closedAt: 105_000 }],
      [null, null],
      115_000,
    ).arena.result,
  ).toEqual({ winner: null, reason: 'cancelled' });
  expect(
    advanceRound(
      round,
      [{ id: 'new', seenAt: 115_001, expiredRound: round.id }, second],
      [null, null],
      115_001,
    ).arena.result,
  ).toEqual({ winner: 1, reason: 'forfeit' });
});
