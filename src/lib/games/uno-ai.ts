import {
  canPlay,
  Card,
  Color,
  COLORS,
  Move,
  stackable,
  UnoState,
} from '@/lib/games/uno';

const isNumber = (card: Card) => card.c !== 'W' && /^[0-9]$/.test(card.v);

/** How eager the AI is to play each kind of card (higher = sooner). */
function priority(card: Card): number {
  switch (card.v) {
    case 'D':
      return 6; // draw two: attack
    case 'S':
    case 'V':
      return 5; // skip / reverse: disrupt
    case 'F':
      return 1; // wild draw four: keep for when stuck
    case 'W':
      return 2; // wild: keep, it always plays later
    default:
      return 3 + Number(card.v) / 10; // numbers 0..9 -> 3.0..3.9
  }
}

/** The colour the AI should pick for a wild: whatever it holds most of. */
function bestColor(
  hand: Card[],
  exclude: Set<number>,
  rng: () => number,
): Color {
  const tally: Record<Color, number> = { R: 0, Y: 0, G: 0, B: 0 };
  hand.forEach((c, i) => {
    if (!exclude.has(i) && c.c !== 'W') tally[c.c as Color] += 1;
  });
  let best: Color | null = null;
  for (const c of COLORS) if (best === null || tally[c] > tally[best]) best = c;
  // nothing but wilds left: pick at random so it is not predictable
  if (best === null || tally[best] === 0) {
    return COLORS[Math.floor(rng() * COLORS.length)];
  }
  return best;
}

/**
 * Decides one move for an AI-controlled `seat`. Always returns something the
 * engine accepts: it plays a legal card (stacking same numbers and calling UNO
 * when it is down to its last two), or draws when nothing fits. Pure, so it is
 * easy to test and runs the same on every device.
 */
export function aiMove(
  state: UnoState,
  seat: number,
  rng: () => number = Math.random,
): Move {
  const hand = state.hands[seat];

  // after drawing, only the drawn card may be played; take it if it fits
  if (state.pending && state.pending.seat === seat) {
    const index = state.pending.index;
    if (canPlay(state, hand[index], hand)) {
      return { type: 'play', index, ...wild(state, hand, index, [], rng) };
    }
    return { type: 'pass' };
  }

  const playable = hand.flatMap((card, i) =>
    canPlay(state, card, hand) ? [i] : [],
  );
  if (playable.length === 0) return { type: 'draw' };

  // pick the highest-priority playable card, breaking ties at random
  let index = playable[0];
  let bestP = -Infinity;
  for (const i of playable) {
    const p = priority(hand[i]) + rng() * 0.05;
    if (p > bestP) {
      bestP = p;
      index = i;
    }
  }

  // shed every same-number card at once when it helps
  const also = isNumber(hand[index]) ? stackable(hand, index) : [];

  // call UNO before playing the second-to-last card, so it cannot be caught
  const left = hand.length - (1 + also.length);
  if (left === 1 && hand.length === 2 && !state.calledUno?.[seat]) {
    return { type: 'uno' };
  }

  return { type: 'play', index, also, ...wild(state, hand, index, also, rng) };
}

/** Adds a chosen colour when the played card is a wild. */
function wild(
  state: UnoState,
  hand: Card[],
  index: number,
  also: number[],
  rng: () => number,
): { color?: Color } {
  if (hand[index].c !== 'W') return {};
  return { color: bestColor(hand, new Set([index, ...also]), rng) };
}
