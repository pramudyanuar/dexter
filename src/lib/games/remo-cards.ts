/**
 * Playing cards for Remo. A card is an id like `S10` (ten of spades) or `X1`
 * (a joker); the id is all that is stored, and everything else is read from it.
 * There is one physical deck, so an id appears once in the whole game.
 */

export type Suit = 'S' | 'H' | 'D' | 'C';

export const SUITS: readonly Suit[] = ['S', 'H', 'D', 'C'];

export const SUIT_GLYPH: Record<Suit, string> = {
  S: '♠',
  H: '♥',
  D: '♦',
  C: '♣',
};

export const SUIT_NAME: Record<Suit, string> = {
  S: 'Spades',
  H: 'Hearts',
  D: 'Diamonds',
  C: 'Clubs',
};

export const RANK_LABEL = [
  '',
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
];

export interface Card {
  id: string;
  /** 1 (ace) to 13 (king); 0 for a joker */
  rank: number;
  suit: Suit | null;
}

export const isJoker = (id: string) => id[0] === 'X';

export function parse(id: string): Card {
  if (isJoker(id)) return { id, rank: 0, suit: null };
  return { id, rank: Number(id.slice(1)), suit: id[0] as Suit };
}

/** "A♠", "10♥", "Joker" */
export function label(id: string): string {
  const c = parse(id);
  return c.suit ? `${RANK_LABEL[c.rank]}${SUIT_GLYPH[c.suit]}` : 'Joker';
}

export const cardId = (suit: Suit, rank: number) => `${suit}${rank}`;

/** The 52 cards, plus `jokers` jokers. */
export function makeDeck(jokers = 0): string[] {
  const out: string[] = [];
  for (const s of SUITS) {
    for (let r = 1; r <= 13; r++) out.push(cardId(s, r));
  }
  for (let j = 1; j <= jokers; j++) out.push(`X${j}`);
  return out;
}

/** Penalty points for a card left in hand: A 1, 2-10 face value, J Q K 10, joker 20. */
export function penalty(id: string): number {
  const c = parse(id);
  if (c.suit === null) return 20;
  return c.rank >= 11 ? 10 : c.rank;
}

/** Display order: by suit, then rank. */
export function bySuit(a: string, b: string) {
  const x = parse(a);
  const y = parse(b);
  const sa = x.suit ? SUITS.indexOf(x.suit) : 9;
  const sb = y.suit ? SUITS.indexOf(y.suit) : 9;
  return sa - sb || x.rank - y.rank;
}

/** Display order: by rank, then suit. */
export function byRank(a: string, b: string) {
  const x = parse(a);
  const y = parse(b);
  const ra = x.suit ? x.rank : 99;
  const rb = y.suit ? y.rank : 99;
  return ra - rb || bySuit(a, b);
}

export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
