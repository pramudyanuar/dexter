/** @jest-environment node */
import {
  ranking,
  sanitizeConfig,
  SekataConfig,
  sekataGame as g,
  SekataState,
  SekataView,
  start,
} from '@/lib/games/sekata';
import {
  blankDeck,
  greenDeck,
  pinkDeck,
  SCard,
  yellowDeck,
} from '@/lib/games/sekata-cards';
import {
  lookup,
  pronounceable,
  syllables,
} from '@/lib/games/sekata-dictionary';
import { RoomError } from '@/lib/rooms/types';

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const card = (
  id: string,
  text: string,
  kind: SCard['kind'] = 'pink',
): SCard => ({
  id,
  kind,
  text,
});
const cards = (prefix: string, texts: string[]) =>
  texts.map((t, i) => card(`${prefix}${i}`, t));

/** A 4-player game with the hands we want. */
function game(
  hands: string[][],
  cfg: Partial<SekataConfig> = {},
  rng = seeded(1),
): SekataState {
  const s = start(hands.length, rng, cfg);
  hands.forEach((h, i) => (s.hands[i] = cards(`h${i}-`, h)));
  s.greens = s.greens.map(() => []);
  return s;
}

const mv = (s: SekataState, seat: number, m: unknown, host = 0) =>
  g.move(s, seat, m, seeded(9), { host });
const errorOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e as RoomError;
  }
  return undefined;
};
const view = (s: SekataState, seat: number | null, host = 0) =>
  g.view(s, seat, { host }) as SekataView;
const word = (s: SekataState, seat: number, ids: string[], extra = {}) =>
  mv(s, seat, { type: 'submit', cards: ids, ...extra });

describe('cards', () => {
  it('has the original component counts', () => {
    expect(pinkDeck()).toHaveLength(102);
    expect(yellowDeck()).toHaveLength(13);
    expect(greenDeck()).toHaveLength(10);
    expect(blankDeck()).toHaveLength(3);
  });

  it('gives every card its own id', () => {
    const all = [
      ...pinkDeck(),
      ...yellowDeck(),
      ...greenDeck(),
      ...blankDeck(),
    ];
    expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
  });
});

describe('the dictionary', () => {
  it('knows ordinary words and words made from a root', () => {
    expect(lookup('mana')?.tag).toBe('standard');
    expect(lookup('makan')?.tag).toBe('standard');
    expect(lookup('dimakan')?.derived).toBe(true);
    expect(lookup('memakan')?.derived).toBe(true);
    expect(lookup('makanan')?.derived).toBe(true);
    expect(lookup('menulis')?.derived).toBe(true);
    expect(lookup('menyapu')?.derived).toBe(true);
  });

  it('does not make up words', () => {
    expect(lookup('mamaba')).toBeNull();
    expect(lookup('xyzkl')).toBeNull();
  });

  it('tags names, slang and the rest', () => {
    expect(lookup('jakarta')?.tag).toBe('place');
    expect(lookup('gak')?.tag).toBe('slang');
  });

  it('can tell what can be said', () => {
    expect(pronounceable('mana')).toBe(true);
    expect(pronounceable('bangun')).toBe(true);
    expect(pronounceable('ngk')).toBe(false);
    expect(pronounceable('kkkka')).toBe(false);
    expect(syllables('makan')).toEqual(['ma', 'kan']);
  });
});

describe('settings', () => {
  it('fills in the defaults and clamps what it is given', () => {
    const c = sanitizeConfig({ handSize: 99, penalty: -4, mode: 'nope' });
    expect(c.mode).toBe('classic');
    expect(c.handSize).toBe(15);
    expect(c.penalty).toBe(0);
    expect(sanitizeConfig(null).handSize).toBe(10);
  });

  it('modes switch on their own rules', () => {
    expect(sanitizeConfig({ mode: 'green' }).greenPerPlayer).toBe(2);
    expect(sanitizeConfig({ mode: 'speed' }).timeLimit).toBe(180);
    expect(sanitizeConfig({ mode: 'vocabulary' }).needMeaning).toBe(true);
    expect(
      sanitizeConfig({ mode: 'norepeat', allowRepeats: true }).allowRepeats,
    ).toBe(false);
  });
});

describe('setup', () => {
  it.each([3, 4, 7, 10])('deals %i players ten cards each', (n) => {
    const s = start(n, seeded(n));
    expect(s.hands.map((h) => h.length)).toEqual(Array(n).fill(10));
    expect(s.center).toHaveLength(1);
    expect(s.center[0].kind).toBe('pink');
    expect(s.yellow).toHaveLength(3);
    expect(s.yellowStock).toHaveLength(10);
    expect(s.draw.length).toBe(102 - n * 10 - 1);
    // no card is dealt twice
    const ids = [...s.hands.flat(), ...s.draw, ...s.center].map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is the same deal for the same seed', () => {
    const a = start(4, seeded(5));
    const b = start(4, seeded(5));
    expect(a.hands).toEqual(b.hands);
  });

  it('deals green cards only when the settings ask for them', () => {
    expect(start(4, seeded(1)).greens.every((x) => x.length === 0)).toBe(true);
    const s = start(4, seeded(1), { mode: 'green' });
    expect(s.greens.map((x) => x.length)).toEqual([2, 2, 2, 2]);
  });

  it('keeps private cards private', () => {
    const s = game([
      ['ma', 'na'],
      ['ka', 'ki'],
      ['ba', 'ju'],
    ]);
    const v = view(s, 0);
    expect(v.hand.map((c) => c.text)).toEqual(['ma', 'na']);
    const json = JSON.stringify(v);
    // other hands' card ids never leave the server
    expect(json).not.toContain('"h1-0"');
    expect(json).not.toContain('"h2-1"');
    expect(v.counts).toEqual([2, 2, 2]);
    expect(view(s, null).hand).toEqual([]);
  });
});

describe('building a word', () => {
  it('accepts MA + NA = MANA and uses up the cards', () => {
    const s = word(game([['ma', 'na', 'ku'], ['ka'], ['ba']]), 0, [
      'h0-0',
      'h0-1',
    ]);
    const w = s.words[0];
    expect(w.word).toBe('mana');
    expect(w.status).toBe('ok');
    expect(s.hands[0].map((c) => c.text)).toEqual(['ku']);
    expect(s.discard.map((c) => c.id)).toEqual(['h0-0', 'h0-1']);
    expect(s.stats[0]).toMatchObject({ words: 1, cards: 2, invalid: 0 });
    expect(s.scores[0]).toBeGreaterThan(0);
  });

  it('spells exactly what the cards say, in the order given', () => {
    const s = game([['na', 'ma', 'x'], ['ka'], ['ba']]);
    expect(word(s, 0, ['h0-1', 'h0-0']).words[0].word).toBe('mana');
    expect(word(s, 0, ['h0-0', 'h0-1']).words[0].word).toBe('nama');
  });

  it('combines vowel cards with syllables', () => {
    const s = word(game([['i', 'bu', 'x'], ['ka'], ['ba']]), 0, [
      'h0-0',
      'h0-1',
    ]);
    expect(s.words[0].word).toBe('ibu');
    expect(s.words[0].status).toBe('ok');
  });

  it('can use the shared syllable in the middle, and it leaves the middle', () => {
    const s0 = game([['ma', 'x'], ['ka'], ['ba']]);
    s0.center = [card('c1', 'na')];
    const s = word(s0, 0, ['h0-0', 'c1']);
    expect(s.words[0].word).toBe('mana');
    expect(s.center).toHaveLength(0);
    // only the player's own card counts toward emptying a hand
    expect(s.stats[0].cards).toBe(1);
  });

  it('needs at least one of your own cards', () => {
    const s0 = game([['ma'], ['ka'], ['ba']]);
    s0.center = [card('c1', 'ma'), card('c2', 'na')];
    expect(errorOf(() => word(s0, 0, ['c1', 'c2']))?.message).toMatch(
      /tanganmu/,
    );
  });

  it('refuses cards you do not own, repeated cards and empty picks', () => {
    const s = game([['ma', 'na'], ['ka', 'ki'], ['ba']]);
    expect(errorOf(() => word(s, 0, ['h1-0', 'h0-0']))?.status).toBe(409);
    expect(errorOf(() => word(s, 0, ['h0-0', 'h0-0']))?.status).toBe(400);
    expect(errorOf(() => word(s, 0, []))?.status).toBe(400);
    expect(errorOf(() => word(s, 0, ['nope', 'h0-0']))?.status).toBe(409);
    expect(errorOf(() => word(s, 0, ['h0-0']))?.status).toBe(400); // too short
  });

  it('cannot reuse a card another player already took from the middle', () => {
    let s = game([['ma', 'x'], ['ka', 'y'], ['ba']]);
    s.center = [card('c1', 'na')];
    s = word(s, 0, ['h0-0', 'c1']);
    // the second player reaches for the same shared card a moment later
    expect(errorOf(() => word(s, 1, ['h1-0', 'c1']))?.status).toBe(409);
  });

  it('blocks repeated words unless the host allows them', () => {
    let s = game([['ma', 'na', 'ma', 'na'], ['ka'], ['ba']]);
    s = word(s, 0, ['h0-0', 'h0-1']);
    expect(errorOf(() => word(s, 0, ['h0-2', 'h0-3']))?.message).toMatch(
      /sudah dipakai/,
    );
    let loose = game([['ma', 'na', 'ma', 'na'], ['ka'], ['ba']], {
      allowRepeats: true,
    });
    loose = word(loose, 0, ['h0-0', 'h0-1']);
    expect(word(loose, 0, ['h0-2', 'h0-3']).words).toHaveLength(2);
  });
});

describe('assistance cards', () => {
  it('shared yellow cards help anyone and stay put by default', () => {
    const s0 = game([['ma', 'kan'], ['ka'], ['ba']]);
    s0.yellow = [card('y1', 'di', 'yellow')];
    const s = word(s0, 0, ['y1', 'h0-0', 'h0-1']);
    expect(s.words[0].word).toBe('dimakan');
    expect(s.words[0].status).toBe('ok');
    expect(s.yellow.map((c) => c.id)).toEqual(['y1']);
  });

  it('a consumed yellow card is replaced from the stock', () => {
    const s0 = game([['ma', 'kan'], ['ka'], ['ba']], { yellowConsumed: true });
    s0.yellow = [card('y1', 'di', 'yellow')];
    s0.yellowStock = [card('y9', 'ber', 'yellow')];
    const s = word(s0, 0, ['y1', 'h0-0', 'h0-1']);
    expect(s.yellow.map((c) => c.id)).toEqual(['y9']);
  });

  it('a green joker stands for a syllable you name, once per word', () => {
    const s0 = game([['ma', 'x'], ['ka'], ['ba']], { mode: 'green' });
    s0.greens[0] = [card('g1', '', 'green'), card('g2', '', 'green')];
    expect(errorOf(() => word(s0, 0, ['h0-0', 'g1']))?.message).toMatch(
      /joker/,
    );
    expect(
      errorOf(() => word(s0, 0, ['h0-0', 'g1'], { fills: { g1: 'zzzz' } }))
        ?.status,
    ).toBe(400);
    expect(
      errorOf(() =>
        word(s0, 0, ['h0-0', 'g1', 'g2'], { fills: { g1: 'na', g2: 'ta' } }),
      )?.message,
    ).toMatch(/satu kartu joker/);
    const s = word(s0, 0, ['h0-0', 'g1'], { fills: { g1: 'na' } });
    expect(s.words[0].word).toBe('mana');
    expect(s.greens[0].map((c) => c.id)).toEqual(['g2']); // spent
    // other players never see whose green is whose
    expect(view(s, 1).greens).toEqual([]);
  });

  it('a green card can be kept when the host says so', () => {
    const s0 = game([['ma', 'x'], ['ka'], ['ba']], {
      mode: 'green',
      greenConsumed: false,
    });
    s0.greens[0] = [card('g1', '', 'green')];
    const s = word(s0, 0, ['h0-0', 'g1'], { fills: { g1: 'na' } });
    expect(s.greens[0]).toHaveLength(1);
  });
});

describe('judging words', () => {
  it('rejects a word that cannot be said, with a penalty card', () => {
    const s = word(game([['ng', 'k', 'x'], ['ka'], ['ba']]), 0, [
      'h0-0',
      'h0-1',
    ]);
    expect(s.words[0].status).toBe('invalid');
    expect(s.words[0].reason).toMatch(/diucapkan/);
    expect(s.hands[0]).toHaveLength(4); // 3 cards + 1 penalty
    expect(s.stats[0].invalid).toBe(1);
  });

  it('can be strict about words the dictionary does not know', () => {
    const s0 = game([['ma', 'ba', 'x'], ['ka'], ['ba']], {
      unknownWords: 'reject',
    });
    const s = word(s0, 0, ['h0-0', 'h0-1']);
    expect(s.words[0].status).toBe('invalid');
    expect(s.words[0].reason).toMatch(/kamus/);
    expect(s.hands[0]).toHaveLength(4);
    expect(s.discard).toHaveLength(0);
  });

  it('refuses a category the host did not allow, and allows it when asked', () => {
    const s0 = game([['ga', 'k', 'x'], ['ka'], ['ba']]);
    expect(word(s0, 0, ['h0-0', 'h0-1']).words[0].status).toBe('invalid');
    const ok = word(
      game([['ga', 'k', 'x'], ['ka'], ['ba']], {
        categories: { slang: true } as never,
      }),
      0,
      ['h0-0', 'h0-1'],
    );
    expect(ok.words[0].status).toBe('ok');
  });

  it('applies the configured penalty size', () => {
    const s = word(
      game([['ng', 'k', 'x'], ['ka'], ['ba']], { penalty: 3 }),
      0,
      ['h0-0', 'h0-1'],
    );
    expect(s.hands[0]).toHaveLength(6);
  });
});

describe('the moderator', () => {
  const unknown = () =>
    word(game([['ma', 'ba', 'x'], ['ka'], ['ba']]), 0, ['h0-0', 'h0-1']);

  it('is asked about words the dictionary does not know', () => {
    const s = unknown();
    expect(s.words[0].status).toBe('review');
    // the cards are set aside while the word waits
    expect(s.hands[0]).toHaveLength(1);
    expect(s.discard).toHaveLength(0);
  });

  it('accepting finalises it and makes the word known from then on', () => {
    const s = mv(unknown(), 0, { type: 'rule', n: 1, verdict: 'accept' });
    expect(s.words[0].status).toBe('ok');
    expect(s.discard).toHaveLength(2);
    expect(s.approved).toContain('maba');
    expect(s.stats[0].words).toBe(1);
  });

  it('rejecting gives the cards back, and a penalty', () => {
    const s = mv(unknown(), 0, { type: 'rule', n: 1, verdict: 'reject' });
    expect(s.words[0].status).toBe('invalid');
    expect(s.hands[0]).toHaveLength(4);
    expect(s.hands[0].map((c) => c.id)).toEqual(
      expect.arrayContaining(['h0-0', 'h0-1']),
    );
  });

  it('only the moderator may decide', () => {
    const s = unknown();
    expect(
      errorOf(() =>
        g.move(s, 1, { type: 'rule', n: 1, verdict: 'accept' }, seeded(1), {
          host: 0,
        }),
      )?.status,
    ).toBe(403);
    expect(view(s, 0, 0).moderator).toBe(true);
    expect(view(s, 1, 0).moderator).toBe(false);
  });

  it('there is nothing to decide about an accepted word', () => {
    const s = word(game([['ma', 'na'], ['ka'], ['ba']]), 0, ['h0-0', 'h0-1']);
    expect(
      errorOf(() => mv(s, 0, { type: 'rule', n: 1, verdict: 'reject' }))
        ?.status,
    ).toBe(409);
  });
});

describe('challenges', () => {
  const played = () =>
    word(game([['ma', 'na', 'ku'], ['ka'], ['ba']]), 0, ['h0-0', 'h0-1']);

  it('lets another player challenge, and the moderator can overturn the word', () => {
    let s = mv(played(), 1, { type: 'challenge', n: 1 });
    expect(s.words[0].status).toBe('review');
    s = mv(s, 0, { type: 'rule', n: 1, verdict: 'reject' });
    expect(s.words[0].status).toBe('void');
    expect(s.stats[0]).toMatchObject({ words: 0, cards: 0 });
    expect(s.scores[0]).toBe(0);
    // the cards come back (plus the penalty card)
    expect(s.hands[0]).toHaveLength(4);
    expect(s.discard).toHaveLength(0);
  });

  it('or keep it', () => {
    let s = mv(played(), 1, { type: 'challenge', n: 1 });
    s = mv(s, 0, { type: 'rule', n: 1, verdict: 'accept' });
    expect(s.words[0].status).toBe('ok');
    expect(s.hands[0]).toHaveLength(1);
  });

  it('is not for your own word, and can be turned off', () => {
    expect(
      errorOf(() => mv(played(), 0, { type: 'challenge', n: 1 }))?.status,
    ).toBe(409);
    const off = word(
      game([['ma', 'na', 'ku'], ['ka'], ['ba']], { challenges: false }),
      0,
      ['h0-0', 'h0-1'],
    );
    expect(errorOf(() => mv(off, 1, { type: 'challenge', n: 1 }))?.status).toBe(
      409,
    );
  });
});

describe('the continuous play rule', () => {
  it('holds a player back until someone else gets a word in', () => {
    let s = game(
      [
        ['ma', 'na', 'ka', 'ki'],
        ['ba', 'ju', 'x'],
        ['bu', 'ku', 'y'],
      ],
      { cooldown: true },
    );
    s = word(s, 0, ['h0-0', 'h0-1']);
    expect(view(s, 0).cooling).toBe(true);
    expect(errorOf(() => word(s, 0, ['h0-2', 'h0-3']))?.status).toBe(409);
    s = word(s, 1, ['h1-0', 'h1-1']);
    expect(view(s, 0).cooling).toBe(false);
    expect(word(s, 0, ['h0-2', 'h0-3']).words).toHaveLength(3);
  });
});

describe('the draw pile', () => {
  it('reveals a card once every active player is stuck', () => {
    let s = game([['ma'], ['ka'], ['ba']]);
    const top = s.draw[s.draw.length - 1];
    const before = s.draw.length;
    s = mv(s, 0, { type: 'stuck' });
    s = mv(s, 1, { type: 'stuck' });
    expect(s.center).toHaveLength(1);
    s = mv(s, 2, { type: 'stuck' });
    expect(s.center).toHaveLength(2);
    expect(s.center[1].id).toBe(top.id);
    expect(s.draw).toHaveLength(before - 1);
    expect(s.reveals).toBe(1);
    expect(s.stuck).toEqual([false, false, false]);
  });

  it('lets a player take their vote back', () => {
    let s = game([['ma'], ['ka'], ['ba']]);
    s = mv(s, 0, { type: 'stuck' });
    s = mv(s, 0, { type: 'stuck' });
    expect(s.stuck[0]).toBe(false);
  });

  it("a word clears everyone's vote", () => {
    let s = game([['ma', 'na'], ['ka'], ['ba']]);
    s = mv(s, 1, { type: 'stuck' });
    s = word(s, 0, ['h0-0', 'h0-1']);
    expect(s.stuck).toEqual([false, false, false]);
  });

  it('shuffles the used cards back in when the pile runs out', () => {
    const s0 = game([['ma'], ['ka'], ['ba']]);
    s0.discard = cards('d', ['ta', 'ti']);
    s0.draw = [];
    let s = mv(s0, 0, { type: 'stuck' });
    s = mv(s, 1, { type: 'stuck' });
    s = mv(s, 2, { type: 'stuck' });
    expect(s.center).toHaveLength(2);
    expect(s.over).toBe(false);
  });
});

describe('card replacement', () => {
  it('is off unless the host turns it on, and limited when it is', () => {
    const s0 = game([['ma', 'na'], ['ka'], ['ba']]);
    expect(
      errorOf(() => mv(s0, 0, { type: 'replace', card: 'h0-0' }))?.status,
    ).toBe(409);
    let s = game([['ma', 'na'], ['ka'], ['ba']], {
      replacement: true,
      replaceLimit: 1,
    });
    const top = s.draw[s.draw.length - 1];
    s = mv(s, 0, { type: 'replace', card: 'h0-0' });
    expect(s.hands[0]).toHaveLength(2);
    expect(s.hands[0].some((c) => c.id === top.id)).toBe(true);
    expect(s.hands[0].some((c) => c.id === 'h0-0')).toBe(false);
    expect(s.draw[0].id).toBe('h0-0');
    expect(
      errorOf(() => mv(s, 0, { type: 'replace', card: 'h0-1' }))?.status,
    ).toBe(409);
    expect(view(s, 0).replacementsLeft).toBe(0);
  });
});

describe('winning', () => {
  it('first to finish: emptying your hand ends the game', () => {
    const s = word(
      game([
        ['ma', 'na'],
        ['ka', 'ki'],
        ['ba', 'ju'],
      ]),
      0,
      ['h0-0', 'h0-1'],
    );
    expect(s.over).toBe(true);
    expect(s.winner).toBe(0);
    expect(s.endReason).toBe('finished');
    expect(ranking(s)[0]).toBe(0);
    expect(errorOf(() => word(s, 1, ['h1-0', 'h1-1']))?.status).toBe(409);
    expect(view(s, 1).ranking).toEqual(ranking(s));
  });

  it('a word waiting for a ruling does not finish the game early', () => {
    let s = word(
      game([
        ['ma', 'ba'],
        ['ka', 'ki'],
        ['ba', 'ju'],
      ]),
      0,
      ['h0-0', 'h0-1'],
    );
    expect(s.over).toBe(false);
    s = mv(s, 0, { type: 'rule', n: 1, verdict: 'accept' });
    expect(s.over).toBe(true);
    expect(s.winner).toBe(0);
  });

  it('elimination: those who finish are safe and the last one left loses', () => {
    let s = game(
      [
        ['ma', 'na'],
        ['ka', 'ki', 'x'],
        ['ba', 'ju', 'y'],
      ],
      { mode: 'elimination' },
    );
    s = word(s, 0, ['h0-0', 'h0-1']);
    expect(s.over).toBe(false);
    expect(s.places).toEqual([0]);
    expect(errorOf(() => word(s, 0, ['h0-0', 'h0-1']))?.status).toBe(409);
  });

  it('elimination ranks by finishing order, the loser last', () => {
    let s = game(
      [
        ['ma', 'na'],
        ['ka', 'ki'],
        ['ba', 'ju', 'y'],
      ],
      { mode: 'elimination' },
    );
    s = word(s, 0, ['h0-0', 'h0-1']);
    s = word(s, 1, ['h1-0', 'h1-1']);
    expect(s.over).toBe(true);
    expect(s.endReason).toBe('last');
    expect(s.loser).toBe(2);
    expect(ranking(s)).toEqual([0, 1, 2]);
  });

  it('point mode: the highest score wins', () => {
    let s = game(
      [
        ['ma', 'na', 'x'],
        ['ka', 'ki', 'bu', 'ku'],
        ['ba', 'ju'],
      ],
      { mode: 'point' },
    );
    s = word(s, 1, ['h1-0', 'h1-1']);
    s = word(s, 0, ['h0-0', 'h0-1']);
    s = word(s, 2, ['h2-0', 'h2-1']);
    expect(s.over).toBe(true);
    expect(ranking(s)[0]).toBe(2); // finished: bonus on top of the word
    expect(s.scores[2]).toBeGreaterThan(s.scores[0]);
  });

  it('speed challenge: when the time is up the fewest cards left wins', () => {
    const s0 = game(
      [
        ['ma', 'na', 'x'],
        ['ka', 'ki', 'x', 'y'],
        ['ba', 'ju', 'x', 'y', 'z'],
      ],
      {
        mode: 'speed',
      },
    );
    expect(s0.deadline).not.toBeNull();
    expect(view(s0, 0).timeLeft).toBeGreaterThan(0);
    expect(errorOf(() => mv(s0, 0, { type: 'tick' }))?.status).toBe(409);
    const late = { ...s0, deadline: Date.now() - 1 };
    const s = mv(late, 1, { type: 'tick' });
    expect(s.over).toBe(true);
    expect(s.endReason).toBe('time');
    expect(ranking(s)).toEqual([0, 1, 2]);
  });
});

describe('vocabulary challenge', () => {
  it('needs the meaning of every word', () => {
    const s0 = game([['ma', 'na', 'x'], ['ka'], ['ba']], {
      mode: 'vocabulary',
    });
    expect(errorOf(() => word(s0, 0, ['h0-0', 'h0-1']))?.message).toMatch(
      /arti/,
    );
    const s = word(s0, 0, ['h0-0', 'h0-1'], { meaning: 'di tempat yang mana' });
    expect(s.words[0].meaning).toBe('di tempat yang mana');
    expect(view(s, 1).words[0].meaning).toBe('di tempat yang mana');
  });
});

describe('leaving', () => {
  it('a player who leaves puts their cards back and the rest play on', () => {
    const s0 = game([['ma'], ['ka'], ['ba'], ['bu']]);
    const before = s0.draw.length;
    const s = g.eliminate!(s0, 1);
    expect(s.dropped).toEqual([1]);
    expect(s.draw.length).toBe(before + 1);
    expect(s.over).toBe(false);
    // everyone still playing being stuck is enough to reveal
    let t = mv(s, 0, { type: 'stuck' });
    t = mv(t, 2, { type: 'stuck' });
    t = mv(t, 3, { type: 'stuck' });
    expect(t.center).toHaveLength(2);
  });

  it('with one player left, that player wins', () => {
    let s = g.eliminate!(game([['ma'], ['ka'], ['ba']]), 1);
    s = g.eliminate!(s, 2);
    expect(s.over).toBe(true);
    expect(s.winner).toBe(0);
    expect(s.endReason).toBe('left');
  });
});

describe('whole games', () => {
  it('plays out with bots that always find a word', () => {
    const rand = seeded(11);
    let s = start(4, rand, { unknownWords: 'reject' });
    const total = 102;
    for (let step = 0; step < 400 && !s.over; step++) {
      // everyone votes "stuck" so the pile keeps opening cards
      for (let seat = 0; seat < 4 && !s.over; seat++) {
        if (!s.stuck[seat]) s = mv(s, seat, { type: 'stuck' });
      }
      const all =
        s.hands.flat().length +
        s.draw.length +
        s.discard.length +
        s.center.length;
      expect(all).toBe(total);
    }
    expect(s.reveals).toBeGreaterThan(10);
  });
});
