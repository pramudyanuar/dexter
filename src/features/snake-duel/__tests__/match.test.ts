import { DUEL_TICK_MS } from '@/features/games/logic/snake-duel';
import {
  advanceDuel,
  duelFrame,
  DuelMatch,
  queueDuelTurn,
  readyDuel,
} from '@/features/snake-duel/match';
import { readDuelMessage } from '@/features/snake-duel/messages';

const waiting: DuelMatch = { ready: [false, false], round: null };

function playing() {
  const ready = readyDuel(waiting, 0, true, 0, 0);
  const starting = readyDuel(ready, 1, true, 0, 0);
  return advanceDuel(starting, 3000);
}

it('starts on both ready inputs and preserves the cell speed', () => {
  const match = playing();
  expect(duelFrame(match, 3000)).toMatchObject({
    ready: [false, false],
    round: {
      id: 1,
      phase: 'playing',
      stepInMs: DUEL_TICK_MS,
      arena: { tick: 0 },
    },
  });
  expect(advanceDuel(match, 3000 + DUEL_TICK_MS - 1)).toBe(match);
  expect(advanceDuel(match, 3000 + DUEL_TICK_MS).round?.arena.tick).toBe(1);
});

it('applies two rapid turns on successive ticks while rejecting reversals and stale rematch inputs', () => {
  const start = playing();
  expect(queueDuelTurn(start, 0, 1, 'left')).toBe(start);
  const down = queueDuelTurn(start, 0, 1, 'down');
  const two = queueDuelTurn(down, 0, 1, 'left');
  expect(queueDuelTurn(two, 0, 1, 'down')).toBe(two);
  expect(queueDuelTurn(two, 0, 2, 'up')).toBe(two);
  const first = advanceDuel(two, 3000 + DUEL_TICK_MS);
  expect(first.round?.arena.snakes[0].dir).toBe('down');
  expect(duelFrame(first, 3000 + DUEL_TICK_MS).round?.turns[0]).toBe('left');
  const second = advanceDuel(first, 3000 + DUEL_TICK_MS * 2);
  expect(second.round?.arena.snakes[0].dir).toBe('left');
  expect(second.round?.inputs[0]).toEqual([]);
});

it('transmits public frame data over the data channel and rejects invalid input', () => {
  const message = { type: 'state', frame: duelFrame(playing(), 3033) };
  expect(readDuelMessage(JSON.stringify(message))).toEqual(message);
  expect(JSON.stringify(message)).not.toContain('randomState');
  expect(
    readDuelMessage(JSON.stringify({ type: 'turn', id: 1, dir: 'around' })),
  ).toBeNull();
});
