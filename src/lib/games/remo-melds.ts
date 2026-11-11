import { isJoker, parse, Suit, SUITS } from '@/lib/games/remo-cards';

/**
 * Checking combinations. This is the single place that decides whether cards
 * make a sequence or a set, so the server and the table agree.
 *
 * A sequence is three or more cards of one suit in a row. The ace may be low
 * (A-2-3) or high (Q-K-A) as the rules allow, never both at once (no K-A-2).
 * A set is three or four cards of one rank, each from a different suit. A
 * joker stands in for a specific missing card, and the checker says which.
 */

export type Kind = 'sequence' | 'set';

export interface MeldRules {
  aceLow: boolean;
  aceHigh: boolean;
  /** Most jokers one combination may hold */
  jokerLimit: number;
}

export const DEFAULT_MELD_RULES: MeldRules = {
  aceLow: true,
  aceHigh: true,
  jokerLimit: 1,
};

/** A card the way a combination reads it: a joker has been given its value. */
export interface Resolved {
  id: string;
  /** 1 (ace) to 13 */
  rank: number;
  suit: Suit;
  joker: boolean;
}

export interface Rep {
  rank: number;
  suit: Suit;
}

/** A card going into a combination; a joker may say what it should be. */
export interface Piece {
  id: string;
  as?: Rep;
}

export type MeldResult =
  | { ok: true; kind: Kind; cards: Resolved[]; value: number }
  | { ok: false; reason: string };

const sig = (cards: Resolved[]) =>
  cards.map((c) => `${c.id}:${c.rank}${c.suit}`).join(',');

/** All the ways the cards can make a sequence (jokers placed as the rules and their hints allow). */
function sequences(pieces: Piece[], rules: MeldRules): Resolved[][] | string {
  const reals = pieces.filter((p) => !isJoker(p.id)).map((p) => parse(p.id));
  const jokers = pieces.filter((p) => isJoker(p.id));
  const n = pieces.length;
  if (n < 3) return 'A sequence needs at least three cards.';
  if (reals.length === 0) return 'A sequence needs a real card.';
  const suit = reals[0].suit as Suit;
  if (reals.some((c) => c.suit !== suit)) {
    return 'A sequence is all one suit.';
  }
  if (new Set(reals.map((c) => c.rank)).size !== reals.length) {
    return 'A sequence cannot hold the same card twice.';
  }
  const lo = rules.aceLow ? 1 : 2;
  const hi = rules.aceHigh ? 14 : 13;
  if (n > hi - lo + 1) return 'That is too long for a sequence.';

  const hasAce = reals.some((c) => c.rank === 1);
  const aceChoices = hasAce ? [1, 14] : [0];
  const out: Resolved[][] = [];
  const seen = new Set<string>();

  for (const ace of aceChoices) {
    const ranks = reals.map((c) => (c.rank === 1 && ace === 14 ? 14 : c.rank));
    if (ranks.some((r) => r < lo || r > hi)) continue;
    for (let start = lo; start + n - 1 <= hi; start++) {
      const end = start + n - 1;
      if (ranks.some((r) => r < start || r > end)) continue;
      const missing: number[] = [];
      for (let r = start; r <= end; r++)
        if (!ranks.includes(r)) missing.push(r);
      if (missing.length !== jokers.length) continue;

      // jokers that say what they are go there; the rest fill what is left, in order
      const assigned = new Map<string, number>();
      const free = [...missing];
      let fits = true;
      for (const j of jokers) {
        if (!j.as) continue;
        if (j.as.suit !== suit) {
          fits = false;
          break;
        }
        const at = free.findIndex(
          (r) => r === j.as!.rank || (r === 14 && j.as!.rank === 1),
        );
        if (at === -1) {
          fits = false;
          break;
        }
        assigned.set(j.id, free.splice(at, 1)[0]);
      }
      if (!fits) continue;
      for (const j of jokers) {
        if (!assigned.has(j.id)) assigned.set(j.id, free.shift()!);
      }

      const jokerAt = new Map([...assigned].map(([id, r]) => [r, id]));
      const realAt = new Map(reals.map((c, i) => [ranks[i], c.id]));
      const cards: Resolved[] = [];
      for (let r = start; r <= end; r++) {
        const id = (realAt.get(r) ?? jokerAt.get(r))!;
        cards.push({
          id,
          rank: r === 14 ? 1 : r,
          suit,
          joker: isJoker(id),
        });
      }
      const key = sig(cards);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(cards);
      }
    }
  }
  if (!out.length) {
    return hasAce && !rules.aceLow && !rules.aceHigh
      ? 'Aces cannot be used in a sequence here.'
      : 'Those cards are not in a row.';
  }
  return out;
}

/** All the ways the cards can make a set (jokers take the suits that are missing). */
function sets(pieces: Piece[]): Resolved[][] | string {
  const reals = pieces.filter((p) => !isJoker(p.id)).map((p) => parse(p.id));
  const jokers = pieces.filter((p) => isJoker(p.id));
  const n = pieces.length;
  if (n < 3) return 'A set needs at least three cards.';
  if (n > 4) return 'A set has at most four cards.';
  if (reals.length === 0) return 'A set needs a real card.';
  const rank = reals[0].rank;
  if (reals.some((c) => c.rank !== rank)) return 'A set is all one rank.';
  if (new Set(reals.map((c) => c.suit)).size !== reals.length) {
    return 'A set cannot hold two cards of the same suit.';
  }
  const left = SUITS.filter((s) => !reals.some((c) => c.suit === s));
  if (jokers.length > left.length) return 'Too many cards for a set.';

  const out: Resolved[][] = [];
  const pick = (i: number, free: Suit[], used: Map<string, Suit>) => {
    if (i === jokers.length) {
      const cards: Resolved[] = [
        ...reals.map((c) => ({
          id: c.id,
          rank,
          suit: c.suit as Suit,
          joker: false,
        })),
        ...jokers.map((j) => ({
          id: j.id,
          rank,
          suit: used.get(j.id)!,
          joker: true,
        })),
      ].sort((a, b) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit));
      out.push(cards);
      return;
    }
    const j = jokers[i];
    for (const s of free) {
      if (j.as && (j.as.suit !== s || j.as.rank !== rank)) continue;
      pick(
        i + 1,
        free.filter((x) => x !== s),
        new Map(used).set(j.id, s),
      );
    }
  };
  pick(0, left, new Map());
  return out.length ? out : 'That joker cannot stand for that card.';
}

/** Every way the cards can be read as this kind of combination. */
export function resolveAll(
  pieces: Piece[],
  kind: Kind,
  rules: MeldRules = DEFAULT_MELD_RULES,
): Resolved[][] | string {
  const ids = pieces.map((p) => p.id);
  if (new Set(ids).size !== ids.length) return 'A card cannot be used twice.';
  const jokers = ids.filter(isJoker).length;
  if (jokers > rules.jokerLimit) {
    return rules.jokerLimit === 0
      ? 'Jokers are not in this game.'
      : `At most ${rules.jokerLimit} joker${rules.jokerLimit > 1 ? 's' : ''} in a combination.`;
  }
  return kind === 'sequence' ? sequences(pieces, rules) : sets(pieces);
}

/** What a combination is worth towards an opening meld: A 11 (1 in A-2-3), face cards 10. */
export function meldValue(cards: Resolved[], kind: Kind): number {
  return cards.reduce((sum, c, i) => {
    if (c.rank === 1) {
      const low = kind === 'sequence' && i === 0;
      return sum + (low ? 1 : 11);
    }
    return sum + (c.rank >= 11 ? 10 : c.rank);
  }, 0);
}

/** Checks cards as a sequence or a set (`auto` tries both) and reads the first fitting arrangement. */
export function validateMeld(
  pieces: Piece[],
  kind: Kind | 'auto',
  rules: MeldRules = DEFAULT_MELD_RULES,
): MeldResult {
  const kinds: Kind[] = kind === 'auto' ? ['sequence', 'set'] : [kind];
  let reason = 'Those cards do not make a combination.';
  for (const k of kinds) {
    const all = resolveAll(pieces, k, rules);
    if (typeof all === 'string') {
      reason = all;
      continue;
    }
    // for a low ace that also fits high, the low reading comes first
    return { ok: true, kind: k, cards: all[0], value: meldValue(all[0], k) };
  }
  return { ok: false, reason };
}

export const validateSequence = (p: Piece[], r?: MeldRules) =>
  validateMeld(p, 'sequence', r);
export const validateSet = (p: Piece[], r?: MeldRules) =>
  validateMeld(p, 'set', r);
