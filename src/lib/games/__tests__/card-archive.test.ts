import {
  ARCHIVE_TARGETS,
  archiveAward,
  canUpgradeArchive,
  redrawArchive,
  startArchive,
  submitArchive,
  upgradeArchive,
} from '@/lib/games/card-archive';

const flush = ['S1', 'S10', 'S11', 'S12', 'S13'];
const proof = ['H3', 'D3'];

it('keeps the draw and contracts deterministic and exchanges only selected cards', () => {
  const initial = startArchive(2);
  expect(startArchive(2)).toEqual(initial);
  expect(new Set(initial.contracts)).toHaveProperty('size', 5);
  const after = redrawArchive(initial, initial.cards.slice(1, 4));
  expect(after.cards.slice(1, 4)).toEqual(initial.deck.slice(0, 3));
  expect(after.cards[0]).toBe(initial.cards[0]);
  expect(after.cards.slice(4)).toEqual(initial.cards.slice(4));
  expect(after.redraws).toBe(initial.redraws - 1);
  expect(after.attempts).toBe(initial.attempts);
});

it('scores proof separately and rejects duplicate or unavailable cards', () => {
  const initial = { ...startArchive(1), cards: [...flush, ...proof] };
  initial.contracts[0] = 'red';
  expect(archiveAward(initial, flush, proof)).toEqual({
    category: 8,
    base: 64,
    bonus: 8,
  });
  expect(archiveAward(initial, flush, [flush[0], proof[0]])).toBeNull();
  expect(archiveAward(initial, flush, [proof[0], proof[0]])).toBeNull();
  expect(archiveAward(initial, flush, ['H1', 'H2'])).toBeNull();
  expect(archiveAward(initial, flush, [proof[0]])?.bonus).toBe(0);
});

it('applies one upgrade per completed round and wins on the fifth target', () => {
  let run = startArchive(5);
  for (let round = 0; round < ARCHIVE_TARGETS.length; round++) {
    let reached = submitArchive(
      { ...run, cards: [...flush, ...proof] },
      flush,
      proof,
    );
    if (reached.phase === 'playing')
      reached = submitArchive(
        { ...reached, cards: [...flush, ...proof] },
        flush,
        proof,
      );
    expect(reached.points).toBeGreaterThanOrEqual(ARCHIVE_TARGETS[round]);
    if (round === ARCHIVE_TARGETS.length - 1) {
      expect(reached.phase).toBe('won');
      expect(upgradeArchive(reached, 'redraw')).toBe(reached);
      break;
    }
    expect(reached.phase).toBe('upgrade');
    run = upgradeArchive(
      reached,
      canUpgradeArchive(reached, 'space') ? 'space' : 'proof',
    );
    expect(run.round).toBe(round + 1);
    expect(run.points).toBe(0);
    expect(run.cards).toHaveLength(Math.min(11, 10 + round));
    expect(upgradeArchive(run, 'redraw')).toBe(run);
  }
});

it('ends the run when the last attempt falls short', () => {
  const cards = ['S2', 'H5', 'D8', 'C11', 'H13'];
  const initial = { ...startArchive(7), attempts: 1, cards };
  const lost = submitArchive(initial, cards, []);
  expect(lost).toMatchObject({ phase: 'lost', attempts: 0, points: 5 });
  expect(redrawArchive(lost, cards.slice(0, 1))).toBe(lost);
});
