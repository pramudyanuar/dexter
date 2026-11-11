/**
 * Sekata's card model and deck. Every card has a unique id, so a submission can
 * always be traced back to exactly the cards that made it.
 *
 * - pink: the syllable cards everyone builds words from (102)
 * - yellow: shared assistance cards, face up in the middle (13): common
 *   Indonesian affixes, usable by anyone
 * - green: personal assistance cards (10): a joker for one syllable of your choice
 * - blank: optional extra special cards (3), configurable
 */

export type CardKind = 'pink' | 'yellow' | 'green' | 'blank';

export interface SCard {
  id: string;
  kind: CardKind;
  /** The syllable on the card; empty for jokers (green, blank) */
  text: string;
}

/** How many of each syllable the pink deck holds (102 in all). */
const PINK: Record<string, number> = {
  // vowels
  a: 3,
  i: 3,
  u: 3,
  e: 2,
  o: 2,
  // k
  ka: 3,
  ki: 2,
  ku: 2,
  ke: 1,
  ko: 1,
  // t
  ta: 3,
  ti: 2,
  tu: 2,
  te: 1,
  to: 1,
  // b
  ba: 3,
  bi: 2,
  bu: 2,
  be: 1,
  bo: 1,
  // m
  ma: 3,
  mi: 2,
  mu: 2,
  me: 1,
  mo: 1,
  // n
  na: 2,
  ni: 1,
  nu: 1,
  ne: 1,
  no: 1,
  // s
  sa: 3,
  si: 2,
  su: 1,
  se: 1,
  so: 1,
  // l
  la: 2,
  li: 1,
  lu: 1,
  le: 1,
  lo: 1,
  // r
  ra: 2,
  ri: 1,
  ru: 1,
  re: 1,
  ro: 1,
  // d
  da: 2,
  di: 1,
  du: 1,
  de: 1,
  // p
  pa: 2,
  pi: 1,
  pu: 1,
  pe: 1,
  // g, j, h, w, c
  ga: 2,
  gu: 1,
  ja: 1,
  ju: 1,
  ha: 1,
  hi: 1,
  wa: 1,
  ca: 1,
  // endings that close a syllable
  ng: 2,
  n: 2,
  k: 1,
  r: 1,
  h: 1,
  l: 1,
};

/** Yellow: shared affixes. */
export const YELLOW = [
  'me',
  'ber',
  'pe',
  'ter',
  'di',
  'ke',
  'se',
  'an',
  'kan',
  'nya',
  'lah',
  'ku',
  'i',
] as const;

export const GREEN_COUNT = 10;
export const BLANK_COUNT = 3;

/** The syllable a joker may stand for: an optional consonant, a vowel, an optional ending. */
export const SYLLABLE =
  /^(ng|ny|sy|kh|[b-df-hj-np-tv-z])?[aiueo](ng|[bdhklmnprst])?$/;

const make = (kind: CardKind, text: string, n: number): SCard => ({
  id: `${kind[0]}${n}`,
  kind,
  text,
});

export function pinkDeck(): SCard[] {
  const out: SCard[] = [];
  for (const [text, count] of Object.entries(PINK)) {
    for (let i = 0; i < count; i++) out.push(make('pink', text, out.length));
  }
  return out;
}

export const pinkCount = () => pinkDeck().length;

export function yellowDeck(): SCard[] {
  return YELLOW.map((text, i) => make('yellow', text, i));
}

export function greenDeck(): SCard[] {
  return Array.from({ length: GREEN_COUNT }, (_, i) => make('green', '', i));
}

export function blankDeck(): SCard[] {
  return Array.from({ length: BLANK_COUNT }, (_, i) => make('blank', '', i));
}
