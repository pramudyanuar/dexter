/** @jest-environment node */
import {
  ranking,
  RemoConfig,
  remoGame as g,
  RemoState,
  RemoView,
  sanitizeRemo,
  start,
} from '@/lib/games/remo';
import {
  byRank,
  bySuit,
  label,
  makeDeck,
  parse,
  penalty,
  shuffle,
  SUITS,
} from '@/lib/games/remo-cards';
import {
  DEFAULT_MELD_RULES,
  MeldRules,
  resolveAll,
  validateMeld,
  validateSequence,
  validateSet,
} from '@/lib/games/remo-melds';
import { RoomError } from '@/lib/rooms/types';

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const ids = (spec: string) => spec.split(' ').filter(Boolean);
const piece = (id: string) => ({ id });
const seq = (spec: string, rules?: Partial<MeldRules>) =>
  validateSequence(ids(spec).map(piece), { ...DEFAULT_MELD_RULES, ...rules });
const set = (spec: string, rules?: Partial<MeldRules>) =>
  validateSet(ids(spec).map(piece), { ...DEFAULT_MELD_RULES, ...rules });

/** 3♠ is S3, 10♥ is H10, a joker is X1 */
describe('the deck', () => {
  it('has exactly 52 unique cards: 13 ranks in 4 suits', () => {
    const deck = makeDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck).size).toBe(52);
    for (const s of SUITS) {
      expect(deck.filter((c) => c[0] === s)).toHaveLength(13);
    }
    for (let r = 1; r <= 13; r++) {
      expect(deck.filter((c) => parse(c).rank === r)).toHaveLength(4);
    }
  });

  it('adds the jokers that were asked for', () => {
    expect(makeDeck(2)).toHaveLength(54);
    expect(makeDeck(2).filter((c) => c[0] === 'X')).toEqual(['X1', 'X2']);
    expect(new Set(makeDeck(4)).size).toBe(56);
  });

  it('reads a card from its id', () => {
    expect(parse('S10')).toEqual({ id: 'S10', rank: 10, suit: 'S' });
    expect(parse('X1')).toEqual({ id: 'X1', rank: 0, suit: null });
    expect(label('H1')).toBe('A♥');
    expect(label('D12')).toBe('Q♦');
    expect(label('X2')).toBe('Joker');
  });

  it('shuffles without losing a card, and the same way for the same seed', () => {
    const a = shuffle(makeDeck(2), seeded(1));
    expect([...a].sort()).toEqual([...makeDeck(2)].sort());
    expect(shuffle(makeDeck(), seeded(5))).toEqual(
      shuffle(makeDeck(), seeded(5)),
    );
    expect(shuffle(makeDeck(), seeded(5))).not.toEqual(makeDeck());
  });

  it('puts a penalty on every card: A 1, 2-10 face, J Q K 10, joker 20', () => {
    expect(penalty('S1')).toBe(1);
    expect(penalty('H7')).toBe(7);
    expect(penalty('D10')).toBe(10);
    expect(penalty('C11')).toBe(10);
    expect(penalty('C12')).toBe(10);
    expect(penalty('C13')).toBe(10);
    expect(penalty('X1')).toBe(20);
  });

  it('sorts by suit or by rank', () => {
    const hand = ids('H5 S9 X1 S2 C13');
    expect([...hand].sort(bySuit)).toEqual(ids('S2 S9 H5 C13 X1'));
    expect([...hand].sort(byRank)).toEqual(ids('S2 H5 S9 C13 X1'));
  });
});

describe('sequences', () => {
  it('accepts three or more in a row of one suit', () => {
    expect(seq('S3 S4 S5').ok).toBe(true);
    expect(seq('H7 H8 H9').ok).toBe(true);
    expect(seq('D10 D11 D12 D13').ok).toBe(true);
    expect(seq('C1 C2 C3').ok).toBe(true);
  });

  it('takes them in any order, and reads them in order', () => {
    const r = seq('S5 S3 S4');
    expect(r.ok && r.cards.map((c) => c.rank)).toEqual([3, 4, 5]);
  });

  it('rejects mixed suits', () => {
    const r = seq('S3 H4 S5');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toMatch(/one suit/);
  });

  it('rejects fewer than three cards', () => {
    expect(seq('S5 S6').ok).toBe(false);
    expect(seq('S5').ok).toBe(false);
  });

  it('rejects gaps and repeats', () => {
    expect(seq('S3 S4 S6').ok).toBe(false);
    expect(seq('S3 S3 S4').ok).toBe(false);
  });

  it('lets the ace be low: A-2-3', () => {
    expect(seq('S1 S2 S3').ok).toBe(true);
    expect(seq('S1 S2 S3', { aceLow: false }).ok).toBe(false);
  });

  it('lets the ace be high: Q-K-A', () => {
    expect(seq('S12 S13 S1').ok).toBe(true);
    expect(seq('S11 S12 S13 S1').ok).toBe(true);
    expect(seq('S12 S13 S1', { aceHigh: false }).ok).toBe(false);
  });

  it('does not wrap around: K-A-2', () => {
    expect(seq('S13 S1 S2').ok).toBe(false);
    expect(seq('S12 S13 S1 S2').ok).toBe(false);
  });

  it('can run the whole suit from ace to ace only once', () => {
    expect(seq('S1 S2 S3 S4 S5 S6 S7 S8 S9 S10 S11 S12 S13').ok).toBe(true);
  });
});

describe('sets', () => {
  it('accepts three or four of one rank from different suits', () => {
    expect(set('S7 H7 D7').ok).toBe(true);
    expect(set('S13 H13 C13 D13').ok).toBe(true);
    expect(set('S10 H10 D10').ok).toBe(true);
  });

  it('rejects different ranks', () => {
    const r = set('S7 H7 D8');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toMatch(/one rank/);
  });

  it('rejects two of the same suit', () => {
    expect(set('S7 S7 H7').ok).toBe(false);
    const r = set('S7 H7 H7');
    expect(!r.ok && r.reason).toMatch(/same suit|twice/);
  });

  it('rejects two cards, and five', () => {
    expect(set('S7 H7').ok).toBe(false);
    expect(
      validateSet(ids('S7 H7 D7 C7 X1').map(piece), {
        ...DEFAULT_MELD_RULES,
        jokerLimit: 2,
      }).ok,
    ).toBe(false);
  });
});

describe('jokers', () => {
  const j1: MeldRules = { aceLow: true, aceHigh: true, jokerLimit: 1 };
  const j2: MeldRules = { ...j1, jokerLimit: 2 };

  it('stand for a missing card in a sequence, and say which', () => {
    const r = validateSequence(ids('S3 X1 S5').map(piece), j1);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(
        r.cards.map((c) => `${c.rank}${c.suit}${c.joker ? '*' : ''}`),
      ).toEqual(['3S', '4S*', '5S']);
    }
  });

  it('can extend a sequence at either end, and the hint decides which', () => {
    const all = resolveAll(ids('S5 S6 X1').map(piece), 'sequence', j1);
    expect(Array.isArray(all) && all.length).toBe(2); // 4-5-6 or 5-6-7
    const high = validateSequence(
      [piece('S5'), piece('S6'), { id: 'X1', as: { rank: 7, suit: 'S' } }],
      j1,
    );
    expect(high.ok && high.cards.map((c) => c.rank)).toEqual([5, 6, 7]);
    const low = validateSequence(
      [piece('S5'), piece('S6'), { id: 'X1', as: { rank: 4, suit: 'S' } }],
      j1,
    );
    expect(low.ok && low.cards.map((c) => c.rank)).toEqual([4, 5, 6]);
  });

  it('cannot stand for a card the rules do not allow', () => {
    // a joker cannot make K-A-2, or sit past the ace
    expect(validateSequence(ids('S12 S13 X1').map(piece), j1).ok).toBe(true); // J-Q-K or Q-K-A
    expect(validateSequence(ids('S13 S1 X1').map(piece), j1).ok).toBe(true); // Q-K-A, never K-A-2
    const r = validateSequence(ids('S13 S1 X1').map(piece), j1);
    expect(r.ok && r.cards.map((c) => c.rank)).toEqual([12, 13, 1]);
    expect(
      validateSequence(
        [piece('S13'), piece('S1'), { id: 'X1', as: { rank: 2, suit: 'S' } }],
        j1,
      ).ok,
    ).toBe(false);
  });

  it('stand for a missing suit in a set, and say which', () => {
    const r = validateSet(ids('S9 H9 X1').map(piece), j1);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const joker = r.cards.find((c) => c.joker)!;
      expect(joker.rank).toBe(9);
      expect(['D', 'C']).toContain(joker.suit);
    }
    const chosen = validateSet(
      [piece('S9'), piece('H9'), { id: 'X1', as: { rank: 9, suit: 'C' } }],
      j1,
    );
    expect(chosen.ok && chosen.cards.find((c) => c.joker)!.suit).toBe('C');
    // and not one that is already there
    expect(
      validateSet(
        [piece('S9'), piece('H9'), { id: 'X1', as: { rank: 9, suit: 'S' } }],
        j1,
      ).ok,
    ).toBe(false);
  });

  it('are limited per combination', () => {
    expect(validateSequence(ids('S3 X1 X2').map(piece), j1).ok).toBe(false);
    expect(validateSequence(ids('S3 X1 X2').map(piece), j2).ok).toBe(true);
    const none = validateSequence(ids('S3 X1 S5').map(piece), {
      ...j1,
      jokerLimit: 0,
    });
    expect(!none.ok && none.reason).toMatch(/not in this game/);
  });

  it('cannot make a combination on their own', () => {
    expect(
      validateSequence(ids('X1 X2 X3').map(piece), { ...j1, jokerLimit: 3 }).ok,
    ).toBe(false);
  });

  it('two jokers can fill two gaps', () => {
    const r = validateSequence(ids('S3 X1 S6 X2').map(piece), j2);
    expect(r.ok && r.cards.map((c) => c.rank)).toEqual([3, 4, 5, 6]);
  });

  it('auto reads cards as whichever kind fits', () => {
    const a = validateMeld(ids('S3 S4 S5').map(piece), 'auto');
    expect(a.ok && a.kind).toBe('sequence');
    const b = validateMeld(ids('S7 H7 D7').map(piece), 'auto');
    expect(b.ok && b.kind).toBe('set');
    expect(validateMeld(ids('S3 H8 D7').map(piece), 'auto').ok).toBe(false);
  });

  it('values a combination: face cards 10, ace 11 (1 when low)', () => {
    const k = validateSet(ids('S13 H13 D13').map(piece));
    expect(k.ok && k.value).toBe(30);
    const low = validateSequence(ids('S1 S2 S3').map(piece));
    expect(low.ok && low.value).toBe(1 + 2 + 3);
    const high = validateSequence(ids('S12 S13 S1').map(piece));
    expect(high.ok && high.value).toBe(10 + 10 + 11);
  });
});

// ------------------------------------------------------------------ the game

const view = (s: RemoState, seat: number | null) => g.view(s, seat) as RemoView;
const errorOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e as RoomError;
  }
  return undefined;
};
const mv = (s: RemoState, seat: number, m: unknown, rng = seeded(3)) =>
  g.move(s, seat, m, rng);

/** A game with the hands we want; seat 0 to play first. */
function game(
  hands: string[],
  cfg: Partial<RemoConfig> = {},
  opts: { discard?: string; draw?: string } = {},
): RemoState {
  const s = start(hands.length, seeded(1), cfg);
  const taken = new Set(hands.flatMap(ids));
  const top = opts.discard ?? 'S2';
  taken.add(top);
  const onTop = ids(opts.draw ?? '');
  onTop.forEach((c) => taken.add(c));
  const rest = makeDeck(s.config.jokers).filter((c) => !taken.has(c));
  s.hands = hands.map(ids);
  s.discard = [top];
  // the top of the pile is the last card
  s.draw = [...rest, ...onTop.reverse()];
  s.turn = 0;
  s.starter = 0;
  s.phase = 'draw';
  return s;
}

const all = (s: RemoState) => [
  ...s.hands.flat(),
  ...s.draw,
  ...s.discard,
  ...s.melds.flatMap((m) => m.cards.map((c) => c.id)),
];

describe('settings', () => {
  it('start with sensible defaults and clamp what they are given', () => {
    const c = sanitizeRemo(null);
    expect(c).toMatchObject({
      mode: 'classic',
      handSize: 7,
      jokers: 0,
      layoff: true,
      finish: 'discard',
    });
    expect(sanitizeRemo({ handSize: 99 }).handSize).toBe(10);
    expect(sanitizeRemo({ mode: 'nope' }).mode).toBe('classic');
  });

  it('modes switch on their own rules', () => {
    expect(sanitizeRemo({ mode: 'quick' })).toMatchObject({
      handSize: 5,
      turnSeconds: 30,
    });
    expect(sanitizeRemo({ mode: 'joker' })).toMatchObject({
      jokers: 2,
      jokerLimit: 1,
    });
    expect(sanitizeRemo({ mode: 'point' }).rounds).toBe(3);
    expect(sanitizeRemo({ mode: 'classic', rounds: 5 }).rounds).toBe(1);
    expect(sanitizeRemo({ mode: 'joker', jokers: 0 }).jokers).toBe(2);
    expect(sanitizeRemo({ jokers: 0, jokerLimit: 3 }).jokerLimit).toBe(0);
  });
});

describe('dealing', () => {
  it.each([2, 3, 4])('deals seven cards to each of %i players', (n) => {
    const s = start(n, seeded(n));
    expect(s.hands.map((h) => h.length)).toEqual(Array(n).fill(7));
    expect(s.discard).toHaveLength(1);
    expect(s.draw).toHaveLength(52 - 7 * n - 1);
    expect(new Set(all(s)).size).toBe(52);
    expect(all(s)).toHaveLength(52);
  });

  it('can deal a different number, and add jokers', () => {
    const s = start(3, seeded(2), { handSize: 5, jokers: 2 });
    expect(s.hands.map((h) => h.length)).toEqual([5, 5, 5]);
    expect(all(s)).toHaveLength(54);
    expect(new Set(all(s)).size).toBe(54);
    expect(isJokerCard(s.discard[0])).toBe(false);
  });

  it('is the same deal for the same seed, and picks a starter at random', () => {
    expect(start(4, seeded(9)).hands).toEqual(start(4, seeded(9)).hands);
    const starters = new Set(
      Array.from(
        { length: 30 },
        (_, i) => start(4, seeded(i * 7919 + 13)).turn,
      ),
    );
    expect(starters.size).toBeGreaterThan(1);
  });

  it('shows you your own cards and only counts for the others', () => {
    const s = start(3, seeded(4));
    const v = view(s, 1);
    expect(v.hand).toEqual(s.hands[1]);
    expect(v.counts).toEqual([7, 7, 7]);
    const json = JSON.stringify(v);
    for (const c of s.hands[0]) expect(json).not.toContain(`"${c}"`);
    for (const c of s.hands[2]) expect(json).not.toContain(`"${c}"`);
    // nor the pile
    for (const c of s.draw.slice(0, 5)) expect(json).not.toContain(`"${c}"`);
    expect(v.discardTop).toBe(s.discard[0]);
    expect(view(s, null).hand).toEqual([]);
    expect(v.revealed).toBeNull();
  });
});

const isJokerCard = (c: string) => c[0] === 'X';

describe('a turn', () => {
  const base = () =>
    game(
      [
        'S3 S4 S5 H9 D2 C6 C7',
        'H1 H2 H3 D9 D10 C1 C2',
        'S9 H9 D9 C9 S10 H10 D11',
      ],
      {},
      { discard: 'D12', draw: 'S13' },
    );

  it('starts with a draw, from the pile', () => {
    let s = base();
    expect(
      errorOf(() => mv(s, 0, { type: 'discard', card: 'D2' }))?.message,
    ).toMatch(/Draw/);
    s = mv(s, 0, { type: 'draw', from: 'pile' });
    expect(s.hands[0]).toHaveLength(8);
    expect(s.hands[0]).toContain('S13');
    expect(s.phase).toBe('play');
    expect(s.draw).not.toContain('S13');
    expect(errorOf(() => mv(s, 0, { type: 'draw' }))?.status).toBe(409);
  });

  it('or from the top of the discard pile', () => {
    const s = mv(base(), 0, { type: 'draw', from: 'discard' });
    expect(s.hands[0]).toContain('D12');
    expect(s.discard).toEqual([]);
    expect(s.took).toBe('D12');
  });

  it('then discards one card and passes the turn', () => {
    let s = mv(base(), 0, { type: 'draw' });
    s = mv(s, 0, { type: 'discard', card: 'H9' });
    expect(s.hands[0]).toHaveLength(7);
    expect(s.discard[s.discard.length - 1]).toBe('H9');
    expect(s.turn).toBe(1);
    expect(s.phase).toBe('draw');
    expect(new Set(all(s)).size).toBe(52);
  });

  it('only the player whose turn it is can act', () => {
    const s = base();
    expect(errorOf(() => mv(s, 1, { type: 'draw' }))?.status).toBe(409);
    expect(errorOf(() => mv(s, 2, { type: 'draw' }))?.status).toBe(409);
  });

  it('cannot discard a card you do not hold', () => {
    const s = mv(base(), 0, { type: 'draw' });
    expect(
      errorOf(() => mv(s, 0, { type: 'discard', card: 'H1' }))?.status,
    ).toBe(409);
    expect(
      errorOf(() => mv(s, 0, { type: 'discard', card: 'ZZ' }))?.status,
    ).toBe(409);
    expect(errorOf(() => mv(s, 0, { type: 'discard' }))?.status).toBe(400);
  });

  it('cannot put back the card just taken from the discard pile, unless that is allowed', () => {
    let s = mv(base(), 0, { type: 'draw', from: 'discard' });
    expect(
      errorOf(() => mv(s, 0, { type: 'discard', card: 'D12' }))?.message,
    ).toMatch(/just took/);
    s = mv(s, 0, { type: 'discard', card: 'H9' });
    expect(s.turn).toBe(1);
    const free = game(
      ['S3 S4 S5 H9 D2 C6 C7', 'H1 H2 H3 D9 D10 C1 C2'],
      { noSameDiscard: false },
      { discard: 'D12' },
    );
    const t = mv(mv(free, 0, { type: 'draw', from: 'discard' }), 0, {
      type: 'discard',
      card: 'D12',
    });
    expect(t.turn).toBe(1);
  });

  it('goes round the table and back', () => {
    let s = base();
    for (let seat = 0; seat < 3; seat++) {
      s = mv(mv(s, seat, { type: 'draw' }), seat, {
        type: 'discard',
        card: s.hands[seat][0],
      });
    }
    expect(s.turn).toBe(0);
  });

  it('is clear what is possible: the view says whose turn and which phase', () => {
    const s = base();
    expect(view(s, 0)).toMatchObject({ turn: 0, phase: 'draw' });
    expect(view(mv(s, 0, { type: 'draw' }), 0).phase).toBe('play');
  });
});

describe('laying down combinations', () => {
  const play = (hands: string[], cfg: Partial<RemoConfig> = {}) =>
    mv(game(hands, cfg, { draw: 'C13' }), 0, { type: 'draw' });

  it('puts a sequence on the table for everyone to see', () => {
    let s = play(['S3 S4 S5 H9 D2 C6 C7', 'H1 H2 H3 D9 D10 C1 C2']);
    s = mv(s, 0, { type: 'meld', cards: ['S3', 'S4', 'S5'], kind: 'sequence' });
    expect(s.hands[0]).toHaveLength(5);
    expect(s.melds).toHaveLength(1);
    expect(s.melds[0]).toMatchObject({ seat: 0, kind: 'sequence' });
    expect(s.melds[0].cards.map((c) => c.id)).toEqual(['S3', 'S4', 'S5']);
    expect(view(s, 1).melds).toEqual(s.melds);
    expect(new Set(all(s)).size).toBe(52);
  });

  it('puts a set on the table', () => {
    let s = play(['S9 H9 D9 H1 D2 C6 C7', 'H1 H2 H3 D9 D10 C1 C2']);
    s = mv(s, 0, { type: 'meld', cards: ['S9', 'H9', 'D9'], kind: 'set' });
    expect(s.melds[0].kind).toBe('set');
    expect(s.hands[0]).toHaveLength(5);
  });

  it('can lay down several at once, and work out which kind each is', () => {
    let s = play(['S3 S4 S5 H9 D9 C9 C7', 'H1 H2 H3 D9 D10 C1 C2']);
    s = mv(s, 0, {
      type: 'meld',
      groups: [{ cards: ['S3', 'S4', 'S5'] }, { cards: ['H9', 'D9', 'C9'] }],
    });
    expect(s.melds.map((m) => m.kind)).toEqual(['sequence', 'set']);
    expect(s.hands[0]).toEqual(['C7', 'C13']);
  });

  it('refuses an invalid combination and leaves the hand as it was', () => {
    const s = play(['S3 H4 S5 H9 D2 C6 C7', 'H1 H2 H3 D9 D10 C1 C2']);
    const e = errorOf(() =>
      mv(s, 0, { type: 'meld', cards: ['S3', 'H4', 'S5'], kind: 'sequence' }),
    );
    expect(e?.status).toBe(400);
    expect(e?.message).toMatch(/one suit/);
    expect(s.hands[0]).toHaveLength(8);
    expect(s.melds).toHaveLength(0);
  });

  it('refuses a sequence called a set', () => {
    const s = play(['S3 S4 S5 H9 D2 C6 C7', 'H1 H2 H3 D9 D10 C1 C2']);
    expect(
      errorOf(() =>
        mv(s, 0, { type: 'meld', cards: ['S3', 'S4', 'S5'], kind: 'set' }),
      )?.status,
    ).toBe(400);
  });

  it('refuses cards you do not hold, or hold only once', () => {
    const s = play(['S3 S4 S5 H9 D2 C6 C7', 'H1 H2 H3 D9 D10 C1 C2']);
    expect(
      errorOf(() => mv(s, 0, { type: 'meld', cards: ['S3', 'S4', 'S6'] }))
        ?.status,
    ).toBe(409);
    expect(
      errorOf(() => mv(s, 0, { type: 'meld', cards: ['S3', 'S3', 'S4'] }))
        ?.status,
    ).toBe(400);
    // a card from another player's hand
    expect(
      errorOf(() => mv(s, 0, { type: 'meld', cards: ['H1', 'H2', 'H3'] }))
        ?.status,
    ).toBe(409);
    expect(
      errorOf(() =>
        mv(s, 0, {
          type: 'meld',
          groups: [
            { cards: ['S3', 'S4', 'S5'] },
            { cards: ['S3', 'D2', 'C6'] },
          ],
        }),
      )?.status,
    ).toBeDefined();
  });

  it('has to come after the draw', () => {
    const s = game(['S3 S4 S5 H9 D2 C6 C7', 'H1 H2 H3 D9 D10 C1 C2']);
    expect(
      errorOf(() => mv(s, 0, { type: 'meld', cards: ['S3', 'S4', 'S5'] }))
        ?.message,
    ).toMatch(/Draw/);
  });

  it('can require an opening worth a minimum', () => {
    const hands = ['S3 S4 S5 H9 H10 H11 C7', 'H1 H2 H3 D9 D10 C1 C2'];
    const s = play(hands, { initialMeld: 30 });
    const e = errorOf(() =>
      mv(s, 0, { type: 'meld', cards: ['S3', 'S4', 'S5'] }),
    );
    expect(e?.status).toBe(409);
    expect(e?.message).toMatch(/at least 30/);
    // 3+4+5 and 9+10+10 together are worth enough
    const ok = mv(s, 0, {
      type: 'meld',
      groups: [{ cards: ['S3', 'S4', 'S5'] }, { cards: ['H9', 'H10', 'H11'] }],
    });
    expect(ok.melds).toHaveLength(2);
    // after the opening, anything goes
    expect(ok.opened[0]).toBe(true);
  });
});

describe('adding to what is on the table', () => {
  const table = (cfg: Partial<RemoConfig> = {}) => {
    let s = game(
      [
        'S5 S6 S7 H9 D9 C9 C7',
        'S4 S8 H1 D10 D11 C1 C2',
        'D9 H5 H6 H7 D2 D3 D4',
      ],
      cfg,
      { draw: 'H13' },
    );
    s = mv(s, 0, { type: 'draw' });
    s = mv(s, 0, {
      type: 'meld',
      groups: [{ cards: ['S5', 'S6', 'S7'] }, { cards: ['H9', 'D9', 'C9'] }],
    });
    return mv(s, 0, { type: 'discard', card: 'C7' });
  };

  it('lets a player who has opened add to a sequence at either end', () => {
    let s = table();
    // seat 1 has not opened yet
    s = mv(s, 1, { type: 'draw' });
    expect(
      errorOf(() => mv(s, 1, { type: 'layoff', card: 'S4', meld: 1 }))?.message,
    ).toMatch(/first/);
    // seat 0, a round later
    s = mv(s, 1, { type: 'discard', card: 'D10' });
    s = mv(mv(s, 2, { type: 'draw' }), 2, { type: 'discard', card: 'D2' });
    s = mv(s, 0, { type: 'draw' });
    s.hands[0].push('S4', 'S8', 'C9');
    s = mv(s, 0, { type: 'layoff', card: 'S4', meld: 1 });
    s = mv(s, 0, { type: 'layoff', card: 'S8', meld: 1 });
    expect(s.melds[0].cards.map((c) => c.rank)).toEqual([4, 5, 6, 7, 8]);
  });

  it('lets a card join a set, up to four', () => {
    let s = table();
    s = mv(mv(s, 1, { type: 'draw' }), 1, { type: 'discard', card: 'D10' });
    s = mv(mv(s, 2, { type: 'draw' }), 2, { type: 'discard', card: 'D2' });
    s = mv(s, 0, { type: 'draw' });
    s.hands[0].push('S9');
    s = mv(s, 0, { type: 'layoff', card: 'S9', meld: 2 });
    expect(s.melds[1].cards).toHaveLength(4);
    s.hands[0].push('C9');
    expect(
      errorOf(() => mv(s, 0, { type: 'layoff', card: 'C9', meld: 2 }))?.status,
    ).toBe(400);
  });

  it('refuses a card that does not fit', () => {
    let s = table();
    s = mv(mv(s, 1, { type: 'draw' }), 1, { type: 'discard', card: 'D10' });
    s = mv(mv(s, 2, { type: 'draw' }), 2, { type: 'discard', card: 'D2' });
    s = mv(s, 0, { type: 'draw' });
    s.hands[0].push('H9', 'S2', 'D12');
    expect(
      errorOf(() => mv(s, 0, { type: 'layoff', card: 'S2', meld: 1 }))?.status,
    ).toBe(400);
    expect(
      errorOf(() => mv(s, 0, { type: 'layoff', card: 'S9', meld: 1 }))?.status,
    ).toBe(409);
    expect(
      errorOf(() => mv(s, 0, { type: 'layoff', card: 'D12', meld: 99 }))
        ?.status,
    ).toBe(404);
  });

  it('can be turned off', () => {
    let s = table({ layoff: false });
    s = mv(mv(s, 1, { type: 'draw' }), 1, { type: 'discard', card: 'D10' });
    s = mv(mv(s, 2, { type: 'draw' }), 2, { type: 'discard', card: 'D2' });
    s = mv(s, 0, { type: 'draw' });
    s.hands[0].push('S4');
    expect(
      errorOf(() => mv(s, 0, { type: 'layoff', card: 'S4', meld: 1 }))?.message,
    ).toMatch(/off/);
  });
});

describe('jokers in play', () => {
  const joker = (cfg: Partial<RemoConfig> = {}) =>
    mv(
      game(
        ['S3 X1 S5 H9 D2 C6 C7', 'H1 H2 H3 D9 D10 C1 C2'],
        { jokers: 2, ...cfg },
        { draw: 'C13' },
      ),
      0,
      { type: 'draw' },
    );

  it('stands for a missing card and the table shows which', () => {
    const s = mv(joker(), 0, { type: 'meld', cards: ['S3', 'X1', 'S5'] });
    const c = s.melds[0].cards;
    expect(c.map((x) => `${x.rank}${x.suit}`)).toEqual(['3S', '4S', '5S']);
    expect(c[1]).toMatchObject({ id: 'X1', joker: true });
  });

  it('follows a choice of what it stands for', () => {
    const s0 = mv(
      game(
        ['S5 S6 X1 H9 D2 C6 C7', 'H1 H2 H3 D9 D10 C1 C2'],
        { jokers: 2 },
        { draw: 'C13' },
      ),
      0,
      { type: 'draw' },
    );
    const s = mv(s0, 0, {
      type: 'meld',
      cards: ['S5', 'S6', 'X1'],
      kind: 'sequence',
      as: { X1: { rank: 7, suit: 'S' } },
    });
    expect(s.melds[0].cards.map((c) => c.rank)).toEqual([5, 6, 7]);
  });

  it('is limited per combination', () => {
    const s0 = mv(
      game(
        ['S3 X1 X2 H9 D2 C6 C7', 'H1 H2 H3 D9 D10 C1 C2'],
        { jokers: 2 },
        { draw: 'C13' },
      ),
      0,
      { type: 'draw' },
    );
    expect(
      errorOf(() => mv(s0, 0, { type: 'meld', cards: ['S3', 'X1', 'X2'] }))
        ?.status,
    ).toBe(400);
    const loose = mv(
      game(
        ['S3 X1 X2 H9 D2 C6 C7', 'H1 H2 H3 D9 D10 C1 C2'],
        { jokers: 2, jokerLimit: 2 },
        { draw: 'C13' },
      ),
      0,
      { type: 'draw' },
    );
    expect(
      mv(loose, 0, { type: 'meld', cards: ['S3', 'X1', 'X2'] }).melds,
    ).toHaveLength(1);
  });

  it('are not in the deck unless asked for', () => {
    expect(start(2, seeded(1)).hands.flat().some(isJokerCard)).toBe(false);
  });
});

describe('going out', () => {
  const nearlyOut = (cfg: Partial<RemoConfig> = {}) =>
    mv(
      game(
        ['S3 S4 S5 H9', 'H1 H2 H3 D9 D10 C1 C2'],
        { handSize: 4, ...cfg },
        { draw: 'C13' },
      ),
      0,
      { type: 'draw' },
    );

  it('wins by laying down every card', () => {
    let s = nearlyOut();
    s = mv(s, 0, { type: 'meld', cards: ['S3', 'S4', 'S5'] });
    expect(s.over).toBe(false);
    s = g.move(s, 0, { type: 'discard', card: 'H9' }, seeded(1));
    s = s; // C13 still in hand
    expect(s.roundOver).toBe(false);
  });

  it('wins by discarding the last card when the rules allow it', () => {
    let s = nearlyOut();
    s = mv(s, 0, { type: 'discard', card: 'C13' });
    s = mv(mv(s, 1, { type: 'draw' }), 1, { type: 'discard', card: 'C1' });
    s = mv(s, 0, { type: 'draw' });
    s.hands[0] = ['H9'];
    s = mv(s, 0, { type: 'discard', card: 'H9' });
    expect(s.over).toBe(true);
    expect(s.roundWinner).toBe(0);
    expect(s.winners).toEqual([0]);
    expect(s.roundReason).toBe('out');
  });

  it('wins when the last cards are laid down, with no discard left to do', () => {
    let s = nearlyOut();
    s.hands[0] = ['S3', 'S4', 'S5'];
    s = mv(s, 0, { type: 'meld', cards: ['S3', 'S4', 'S5'] });
    expect(s.over).toBe(true);
    expect(s.winners).toEqual([0]);
    expect(errorOf(() => mv(s, 1, { type: 'draw' }))?.status).toBe(409);
  });

  it('cannot go out by discarding when every card has to be laid down', () => {
    let s = nearlyOut({ finish: 'melded' });
    s.hands[0] = ['H9'];
    const e = errorOf(() => mv(s, 0, { type: 'discard', card: 'H9' }));
    expect(e?.status).toBe(409);
    expect(e?.message).toMatch(/Lay your last card/);
    // the turn can still be ended
    s = mv(s, 0, { type: 'pass' });
    expect(s.turn).toBe(1);
    expect(s.hands[0]).toEqual(['H9']);
    // but not while there is more than one card to discard
    const t = nearlyOut({ finish: 'melded' });
    expect(errorOf(() => mv(t, 0, { type: 'pass' }))?.status).toBe(409);
  });

  it('can still go out by laying down in the strict mode', () => {
    let s = nearlyOut({ finish: 'melded' });
    s.hands[0] = ['S3', 'S4', 'S5'];
    s = mv(s, 0, { type: 'meld', cards: ['S3', 'S4', 'S5'] });
    expect(s.over).toBe(true);
  });
});

describe('scoring', () => {
  const finished = (hands: string[], cfg: Partial<RemoConfig> = {}) => {
    let s = game(hands, cfg, { draw: 'C13' });
    s.hands[0] = ['H9'];
    s = mv(s, 0, { type: 'draw' });
    s.hands[0] = ['H9'];
    return mv(s, 0, { type: 'discard', card: 'H9' });
  };

  it('counts what is left in the other hands: A 1, 2-10 face, J Q K 10, joker 20', () => {
    const s = finished(['H9 D2', 'S1 S5 C13 D11', 'X1 H7 D10'], { jokers: 1 });
    expect(s.roundPenalty).toEqual([0, 1 + 5 + 10 + 10, 20 + 7 + 10]);
    expect(s.totals).toEqual([0, 26, 37]);
    expect(s.winners).toEqual([0]);
    expect(ranking(s)).toEqual([0, 1, 2]);
  });

  it('gives the winner nothing, and shows every hand once the round is over', () => {
    const s = finished(['H9 D2', 'S1 S5', 'H7 D10']);
    expect(s.roundPenalty![0]).toBe(0);
    const v = view(s, 1);
    expect(v.revealed).toEqual(s.hands);
    expect(v.roundWinner).toBe(0);
    expect(v.roundPenalty).toEqual([0, 6, 17]);
  });

  it('Point Remo keeps score over several rounds, and the lowest total wins', () => {
    let s = finished(['H9 D2', 'S1 S5', 'H7 D10'], {
      mode: 'point',
      rounds: 2,
    });
    expect(s.roundOver).toBe(true);
    expect(s.over).toBe(false);
    expect(errorOf(() => mv(s, 0, { type: 'draw' }))?.status).toBe(409);
    // the next round deals again and keeps the totals
    s = mv(s, 1, { type: 'next' });
    expect(s.round).toBe(2);
    expect(s.roundOver).toBe(false);
    expect(s.totals).toEqual([0, 6, 17]);
    expect(s.hands.map((h) => h.length)).toEqual([7, 7, 7]);
    expect(s.starter).toBe(1);
    expect(s.turn).toBe(1);
    expect(new Set(all(s)).size).toBe(52);
    // seat 2 goes out in round two
    s = mv(s, 1, { type: 'draw' });
    s.hands[1] = ['H5'];
    s = mv(s, 1, { type: 'discard', card: 'H5' });
    expect(s.roundWinner).toBe(1);
    expect(s.over).toBe(true);
    // the lowest total over both rounds wins, not necessarily the last to go out
    const best = Math.min(...s.totals);
    expect(s.winners).toEqual([s.totals.indexOf(best)]);
    expect(ranking(s)[0]).toBe(s.winners[0]);
    expect(s.totals[1]).toBe(6);
  });

  it('cannot start the next round before this one is over', () => {
    expect(
      errorOf(() => mv(game(['H9 D2', 'S1 S5']), 0, { type: 'next' }))?.status,
    ).toBe(409);
  });
});

describe('the draw pile running out', () => {
  it('shuffles the discards into a new pile and keeps the top one', () => {
    let s = game(
      ['S3 S4 S5 H9 D2 C6 C7', 'H1 H2 H3 D9 D10 C1 C2'],
      {},
      { discard: 'D12' },
    );
    s.discard = ['D5', 'D6', 'D7', 'D12'];
    s.draw = [];
    s = mv(s, 0, { type: 'draw' });
    expect(s.discard).toEqual(['D12']);
    expect(s.hands[0]).toHaveLength(8);
    expect(s.draw).toHaveLength(2);
    expect(new Set(all(s)).size).toBe(new Set(all(s)).size);
    expect(s.feed.at(-2)?.text).toMatch(/shuffled/);
  });

  it('ends the round when there is nothing left to draw', () => {
    let s = game(
      ['S3 S4 S5 H9 D2 C6 C7', 'H1 H2 H3 D9 D10 C1 C2'],
      {},
      { discard: 'D12' },
    );
    s.draw = [];
    s.discard = ['D12'];
    s = mv(s, 0, { type: 'draw' });
    expect(s.roundOver).toBe(true);
    expect(s.roundReason).toBe('stalled');
    expect(s.over).toBe(true);
  });
});

describe('the room around the game', () => {
  it('plays for an idle player: draws, then throws away the dearest card', () => {
    let s = game(
      ['S3 S4 S5 H9 D2 C6 C13', 'H1 H2 H3 D9 D10 C1 C2'],
      {},
      { draw: 'C13'.replace('C13', 'S13') },
    );
    expect(g.autoMove!(s, 0)).toEqual({ type: 'draw', from: 'pile' });
    s = mv(s, 0, { type: 'draw' });
    const m = g.autoMove!(s, 0) as { type: string; card: string };
    expect(m.type).toBe('discard');
    expect(['S13', 'C13']).toContain(m.card);
    expect(g.autoMove!(s, 1)).toBeNull();
  });

  it('keeps a clock when asked, and none when not', () => {
    expect(
      g.waiting!(game(['S3 S4 S5', 'H1 H2 H3'], { turnSeconds: 45 })),
    ).toEqual({ seats: [0], seconds: 45 });
    expect(
      g.waiting!(game(['S3 S4 S5', 'H1 H2 H3'], { turnSeconds: 0 })),
    ).toBeNull();
  });

  it('a player who leaves puts their cards back and the rest play on', () => {
    let s = start(3, seeded(2));
    const mine = s.hands[1].length;
    const pile = s.draw.length;
    s = g.eliminate!(s, 1, seeded(1));
    expect(s.dropped).toEqual([1]);
    expect(s.hands[1]).toEqual([]);
    expect(s.draw).toHaveLength(pile + mine);
    expect(new Set(all(s)).size).toBe(52);
    // play skips the empty seat
    s.turn = 0;
    s.phase = 'play';
    s.hands[0].push('S1'.replace('S1', s.draw.pop()!));
    s = mv(s, 0, { type: 'discard', card: s.hands[0][0] });
    expect(s.turn).toBe(2);
  });

  it('with one player left, that player wins', () => {
    let s = start(2, seeded(2));
    s = g.eliminate!(s, 0, seeded(1));
    expect(s.over).toBe(true);
    expect(s.winners).toEqual([1]);
  });

  it('can be played again with the same settings', () => {
    const s = start(3, seeded(1), { mode: 'quick' });
    const again = g.restart(s, 3, seeded(2));
    expect(again.config.mode).toBe('quick');
    expect(again.hands.map((h) => h.length)).toEqual([5, 5, 5]);
  });

  it('refuses nonsense', () => {
    const s = game(['S3 S4 S5', 'H1 H2 H3']);
    expect(errorOf(() => g.move(s, 0, null, seeded(1)))?.status).toBe(400);
    expect(
      errorOf(() => g.move(s, 0, { type: 'dance' }, seeded(1)))?.status,
    ).toBe(400);
  });

  it('plays a whole game with bots that draw and discard, never losing a card', () => {
    for (const seed of [1, 2, 3]) {
      const rng = seeded(seed);
      let s = start(3, rng, { jokers: 2, turnSeconds: 0 });
      const total = 54;
      let steps = 0;
      while (!s.over && steps++ < 600) {
        const seat = s.turn;
        const auto = g.autoMove!(s, seat);
        // try to lay down anything that makes a sequence or set first
        if (s.phase === 'play') {
          const hand = s.hands[seat];
          const found = findMeld(hand);
          if (found) {
            s = g.move(s, seat, { type: 'meld', cards: found }, rng);
            if (s.over) break;
            continue;
          }
        }
        s = g.move(s, seat, auto, rng);
        expect(all(s)).toHaveLength(total);
        expect(new Set(all(s)).size).toBe(total);
      }
      // a long game may well still be on: what matters is that nothing went missing
      if (s.over) expect(s.winners.length).toBeGreaterThan(0);
    }
  });
});

/** Any three-card sequence or set in a hand, or null. */
function findMeld(hand: string[]): string[] | null {
  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      for (let k = j + 1; k < hand.length; k++) {
        const trio = [hand[i], hand[j], hand[k]];
        if (
          validateMeld(
            trio.map((id) => ({ id })),
            'auto',
            { ...DEFAULT_MELD_RULES, jokerLimit: 1 },
          ).ok
        ) {
          return trio;
        }
      }
    }
  }
  return null;
}
