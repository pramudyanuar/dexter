/**
 * The 144 tiles of a Mahjong set, and which of them match.
 *
 * Codes: b1-b9 bamboo, c1-c9 characters, d1-d9 dots (circles), we/ws/ww/wn
 * the winds, dr/dg/dw the dragons (red, green, white), f1-f4 the flowers (plum,
 * orchid, chrysanthemum, bamboo) and s1-s4 the seasons (spring to winter).
 */

export type Suit =
  'bamboo' | 'character' | 'dot' | 'wind' | 'dragon' | 'flower' | 'season';

const nine = (p: string) => Array.from({ length: 9 }, (_, i) => `${p}${i + 1}`);

export const BAMBOO = nine('b');
export const CHARACTERS = nine('c');
export const DOTS = nine('d');
export const WINDS = ['we', 'ws', 'ww', 'wn'];
export const DRAGONS = ['dr', 'dg', 'dw'];
export const FLOWERS = ['f1', 'f2', 'f3', 'f4'];
export const SEASONS = ['s1', 's2', 's3', 's4'];

/** The 34 kinds that come four to a set. */
export const STANDARD_KINDS = [
  ...BAMBOO,
  ...CHARACTERS,
  ...DOTS,
  ...WINDS,
  ...DRAGONS,
];

export const NAMES: Record<string, string> = {
  we: 'East wind',
  ws: 'South wind',
  ww: 'West wind',
  wn: 'North wind',
  dr: 'Red dragon',
  dg: 'Green dragon',
  dw: 'White dragon',
  f1: 'Plum',
  f2: 'Orchid',
  f3: 'Chrysanthemum',
  f4: 'Bamboo flower',
  s1: 'Spring',
  s2: 'Summer',
  s3: 'Autumn',
  s4: 'Winter',
};

export function suitOf(kind: string): Suit {
  switch (kind[0]) {
    case 'b':
      return 'bamboo';
    case 'c':
      return 'character';
    case 'd':
      return kind === 'dr' || kind === 'dg' || kind === 'dw' ? 'dragon' : 'dot';
    case 'w':
      return 'wind';
    case 'f':
      return 'flower';
    default:
      return 'season';
  }
}

export function nameOf(kind: string): string {
  if (NAMES[kind]) return NAMES[kind];
  const suit = suitOf(kind);
  const label = { bamboo: 'Bamboo', character: 'Character', dot: 'Dot' }[
    suit as 'bamboo'
  ];
  return `${label} ${kind.slice(1)}`;
}

/** Which tiles may be paired with which. All of this is a setting. */
export interface MatchRules {
  /** Any flower matches any other flower */
  flowersAny: boolean;
  /** Any season matches any other season */
  seasonsAny: boolean;
}

export const DEFAULT_MATCH: MatchRules = { flowersAny: true, seasonsAny: true };

/** Tiles with the same class can be matched. */
export function matchClass(kind: string, rules: MatchRules): string {
  const suit = suitOf(kind);
  if (suit === 'flower' && rules.flowersAny) return 'flower';
  if (suit === 'season' && rules.seasonsAny) return 'season';
  return kind;
}

export const canMatch = (a: string, b: string, rules: MatchRules) =>
  matchClass(a, rules) === matchClass(b, rules);

export function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Every pair a full set can make (72), as kinds that match each other. Flowers
 * and seasons only pair among themselves when the rules say any of them match;
 * when they must match exactly they are left out and replaced by spare copies
 * of ordinary tiles, so the board still holds 144.
 */
export function allPairs(
  rules: MatchRules,
  rng: () => number,
): [string, string][] {
  const pairs: [string, string][] = [];
  for (const kind of STANDARD_KINDS) {
    pairs.push([kind, kind], [kind, kind]);
  }
  const group = (kinds: string[], any: boolean) => {
    if (any) {
      const s = shuffled(kinds, rng);
      pairs.push([s[0], s[1]], [s[2], s[3]]);
    } else {
      // spare copies stand in for the two pairs this group would have made
      const spare = shuffled(STANDARD_KINDS, rng).slice(0, 2);
      for (const k of spare) pairs.push([k, k]);
    }
  };
  group(FLOWERS, rules.flowersAny);
  group(SEASONS, rules.seasonsAny);
  return pairs;
}
