import {
  isJoker,
  label,
  makeDeck,
  penalty,
  shuffle,
} from '@/lib/games/remo-cards';
import {
  DEFAULT_REMO,
  RemoConfig,
  sanitizeRemo,
} from '@/lib/games/remo-config';
import {
  Kind,
  MeldRules,
  Piece,
  Rep,
  resolveAll,
  Resolved,
  validateMeld,
} from '@/lib/games/remo-melds';
import type { GameDef } from '@/lib/rooms/game';
import { RoomError } from '@/lib/rooms/types';

export * from '@/lib/games/remo-config';

/**
 * Remo (rummy) for two to four players. A turn is: draw one card (from the pile
 * or the top of the discard pile), lay down sequences and sets and add to the
 * ones on the table if you like, then discard one card. Emptying your hand wins
 * the round.
 *
 * Everything is decided here, on the server: who holds which card, whether a
 * combination is valid, and what a joker stands for. A client only ever sends
 * card ids, never cards or scores.
 */

export interface Meld {
  id: number;
  /** Who laid it down */
  seat: number;
  kind: Kind;
  /** In order, jokers shown as the card they stand for */
  cards: Resolved[];
}

export interface FeedItem {
  n: number;
  seat: number | null;
  text: string;
}

export interface Stat {
  turns: number;
  melds: number;
  layoffs: number;
  /** Cards put on the table from the hand */
  played: number;
}

export interface RemoState {
  config: RemoConfig;
  players: number;
  hands: string[][];
  draw: string[];
  /** Top of the pile is the last card */
  discard: string[];
  melds: Meld[];
  nextMeld: number;
  turn: number;
  phase: 'draw' | 'play';
  round: number;
  /** Who opened this round */
  starter: number;
  /** Has laid down a combination this round */
  opened: boolean[];
  /** The card just taken from the discard pile, which cannot go straight back */
  took: string | null;
  dropped: number[];
  /** Penalty points over the match */
  totals: number[];
  /** Penalty points this round, once it is over */
  roundPenalty: number[] | null;
  roundOver: boolean;
  roundWinner: number | null;
  roundReason: 'out' | 'stalled' | 'left' | null;
  over: boolean;
  winners: number[];
  stats: Stat[];
  feed: FeedItem[];
  nextFeed: number;
  startedAt: number;
  endedAt: number | null;
}

export interface RemoView {
  config: RemoConfig;
  players: number;
  you: number | null;
  /** Your own cards */
  hand: string[];
  /** What the others hold: how many, until the round ends */
  counts: number[];
  drawCount: number;
  discardTop: string | null;
  discardCount: number;
  melds: Meld[];
  turn: number;
  phase: 'draw' | 'play';
  round: number;
  opened: boolean[];
  /** You took this from the discard pile and may not discard it again */
  took: string | null;
  dropped: number[];
  totals: number[];
  roundPenalty: number[] | null;
  /** Every hand, once the round is over */
  revealed: string[][] | null;
  roundOver: boolean;
  roundWinner: number | null;
  roundReason: RemoState['roundReason'];
  over: boolean;
  winners: number[];
  ranking: number[];
  stats: Stat[];
  feed: FeedItem[];
  /** Seconds the match has run, as the server counts them */
  elapsed: number;
}

const rulesOf = (c: RemoConfig): MeldRules => ({
  aceLow: c.aceLow,
  aceHigh: c.aceHigh,
  jokerLimit: c.jokerLimit,
});

function say(s: RemoState, seat: number | null, text: string) {
  s.feed.push({ n: s.nextFeed++, seat, text });
  if (s.feed.length > 24) s.feed.shift();
}

const isIn = (s: RemoState, seat: number) => !s.dropped.includes(seat);
const live = (s: RemoState) =>
  Array.from({ length: s.players }, (_, i) => i).filter((i) => isIn(s, i));

function nextSeat(s: RemoState, from: number) {
  for (let i = 1; i <= s.players; i++) {
    const seat = (from + i) % s.players;
    if (isIn(s, seat)) return seat;
  }
  return from;
}

// -------------------------------------------------------------------- deal

function deal(s: RemoState, rng: () => number) {
  const deck = shuffle(makeDeck(s.config.jokers), rng);
  s.hands = Array.from({ length: s.players }, () => []);
  for (let i = 0; i < s.config.handSize; i++) {
    for (const p of live(s)) s.hands[p].push(deck.pop()!);
  }
  // the first discard is an ordinary card
  const at = deck.findLastIndex((c) => !isJoker(c));
  s.discard = [deck.splice(at, 1)[0]];
  s.draw = deck;
  s.melds = [];
  s.nextMeld = 1;
  s.phase = 'draw';
  s.opened = Array(s.players).fill(false);
  s.took = null;
  s.roundPenalty = null;
  s.roundOver = false;
  s.roundWinner = null;
  s.roundReason = null;
  s.turn = s.starter;
}

export function start(
  players: number,
  rng: () => number = Math.random,
  options?: unknown,
): RemoState {
  const config = sanitizeRemo(options);
  const s: RemoState = {
    config,
    players,
    hands: [],
    draw: [],
    discard: [],
    melds: [],
    nextMeld: 1,
    turn: 0,
    phase: 'draw',
    round: 1,
    starter: Math.floor(rng() * players),
    opened: [],
    took: null,
    dropped: [],
    totals: Array(players).fill(0),
    roundPenalty: null,
    roundOver: false,
    roundWinner: null,
    roundReason: null,
    over: false,
    winners: [],
    stats: Array.from({ length: players }, () => ({
      turns: 0,
      melds: 0,
      layoffs: 0,
      played: 0,
    })),
    feed: [],
    nextFeed: 1,
    startedAt: Date.now(),
    endedAt: null,
  };
  deal(s, rng);
  return s;
}

// ---------------------------------------------------------------- the round

/** Best to worst: lowest total first. */
export function ranking(s: RemoState): number[] {
  const seats = live(s);
  const order = [...seats].sort(
    (a, b) =>
      s.totals[a] - s.totals[b] ||
      (s.roundWinner === a ? -1 : s.roundWinner === b ? 1 : 0) ||
      s.hands[a].length - s.hands[b].length,
  );
  return [...order, ...s.dropped];
}

function endRound(
  s: RemoState,
  winner: number | null,
  reason: NonNullable<RemoState['roundReason']>,
) {
  const pen = s.hands.map((h, seat) =>
    seat === winner || !isIn(s, seat)
      ? 0
      : h.reduce((a, c) => a + penalty(c), 0),
  );
  s.roundPenalty = pen;
  s.totals = s.totals.map((t, i) => t + pen[i]);
  s.roundOver = true;
  s.roundWinner = winner;
  s.roundReason = reason;
  say(
    s,
    winner,
    winner === null
      ? 'The cards ran out. Nobody went out.'
      : reason === 'left'
        ? 'The other players left.'
        : 'Went out!',
  );
  if (s.round >= s.config.rounds || live(s).length <= 1) {
    s.over = true;
    s.endedAt = Date.now();
    const best = Math.min(...live(s).map((i) => s.totals[i]));
    s.winners = live(s).filter((i) => s.totals[i] === best);
    // one round: whoever went out is the winner, even on a points tie
    if (s.config.rounds === 1 && winner !== null) s.winners = [winner];
  }
}

/** The pile ran out: the discards (but the top) are shuffled into a new one. */
function refill(s: RemoState, rng: () => number): boolean {
  if (s.draw.length > 0) return true;
  if (s.discard.length <= 1) return false;
  const top = s.discard.pop()!;
  s.draw = shuffle(s.discard, rng);
  s.discard = [top];
  say(s, null, 'The discards were shuffled into a new pile.');
  return true;
}

function advance(s: RemoState) {
  s.turn = nextSeat(s, s.turn);
  s.phase = 'draw';
  s.took = null;
}

// ------------------------------------------------------------------- moves

type Group = { cards?: unknown; kind?: unknown; as?: unknown };
type Move =
  | { type: 'draw'; from?: 'pile' | 'discard' }
  | ({ type: 'meld'; groups?: unknown } & Group)
  | { type: 'layoff'; card?: unknown; meld?: unknown; as?: unknown }
  | { type: 'discard'; card?: unknown }
  | { type: 'pass' }
  | { type: 'next' };

const asRep = (v: unknown): Rep | undefined => {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as { rank?: unknown; suit?: unknown };
  const rank = Number(o.rank);
  if (!Number.isInteger(rank) || rank < 1 || rank > 13) return undefined;
  if (o.suit !== 'S' && o.suit !== 'H' && o.suit !== 'D' && o.suit !== 'C')
    return undefined;
  return { rank, suit: o.suit };
};

/** The cards of a group, which must all be in the player's hand, once each. */
function takeFrom(hand: string[], ids: unknown): string[] {
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.some((i) => typeof i !== 'string')
  ) {
    throw new RoomError('Pick the cards first', 400);
  }
  const list = ids as string[];
  if (new Set(list).size !== list.length) {
    throw new RoomError('A card cannot be used twice', 400);
  }
  for (const id of list) {
    if (!hand.includes(id))
      throw new RoomError('That card is not in your hand', 409);
  }
  return list;
}

function requirePlay(s: RemoState, seat: number) {
  if (s.phase !== 'play') throw new RoomError('Draw a card first', 409);
  void seat;
}

function doMeld(
  s: RemoState,
  seat: number,
  move: Extract<Move, { type: 'meld' }>,
) {
  requirePlay(s, seat);
  const raw: Group[] = Array.isArray(move.groups)
    ? (move.groups as Group[])
    : [{ cards: move.cards, kind: move.kind, as: move.as }];
  if (raw.length === 0 || raw.length > 6)
    throw new RoomError('Pick the cards first', 400);

  const hand = s.hands[seat];
  const used = new Set<string>();
  const laid: { cards: Resolved[]; kind: Kind; value: number }[] = [];
  for (const g of raw) {
    const ids = takeFrom(hand, g.cards);
    if (ids.some((i) => used.has(i)))
      throw new RoomError('A card cannot be used twice', 400);
    ids.forEach((i) => used.add(i));
    const asMap = (g.as && typeof g.as === 'object' ? g.as : {}) as Record<
      string,
      unknown
    >;
    const pieces: Piece[] = ids.map((id) => ({
      id,
      as: isJoker(id) ? asRep(asMap[id]) : undefined,
    }));
    const kind: Kind | 'auto' =
      g.kind === 'sequence' || g.kind === 'set' ? g.kind : 'auto';
    const res = validateMeld(pieces, kind, rulesOf(s.config));
    if (!res.ok) throw new RoomError(res.reason, 400);
    laid.push({ cards: res.cards, kind: res.kind, value: res.value });
  }

  if (!s.opened[seat] && s.config.initialMeld > 0) {
    const total = laid.reduce((a, l) => a + l.value, 0);
    if (total < s.config.initialMeld) {
      throw new RoomError(
        `Your first combinations must be worth at least ${s.config.initialMeld} points (these are worth ${total}).`,
        409,
      );
    }
  }

  s.hands[seat] = hand.filter((c) => !used.has(c));
  for (const l of laid) {
    s.melds.push({ id: s.nextMeld++, seat, kind: l.kind, cards: l.cards });
    s.stats[seat].melds += 1;
    say(
      s,
      seat,
      `Laid down a ${l.kind}: ${l.cards.map((c) => (c.joker ? `Joker as ${label(`${c.suit}${c.rank}`)}` : label(c.id))).join(' ')}`,
    );
  }
  s.stats[seat].played += used.size;
  s.opened[seat] = true;
}

function doLayoff(
  s: RemoState,
  seat: number,
  move: Extract<Move, { type: 'layoff' }>,
) {
  requirePlay(s, seat);
  if (!s.config.layoff)
    throw new RoomError('Adding to combinations is off in this game', 409);
  if (!s.opened[seat])
    throw new RoomError('Lay down a combination of your own first', 409);
  const hand = s.hands[seat];
  const [card] = takeFrom(hand, [move.card]);
  const meld = s.melds.find((m) => m.id === Number(move.meld));
  if (!meld) throw new RoomError('There is no such combination', 404);

  const rules = rulesOf(s.config);
  const existing: Piece[] = meld.cards.map((c) => ({
    id: c.id,
    as: c.joker ? { rank: c.rank, suit: c.suit } : undefined,
  }));
  const added: Piece = {
    id: card,
    as: isJoker(card) ? asRep(move.as) : undefined,
  };
  // keep the jokers where they are if the card fits around them; otherwise reread them
  let all = resolveAll([...existing, added], meld.kind, rules);
  if (typeof all === 'string') {
    all = resolveAll(
      [...existing.map((p) => ({ id: p.id })), added],
      meld.kind,
      rules,
    );
  }
  if (typeof all === 'string') throw new RoomError(all, 400);

  meld.cards = all[0];
  s.hands[seat] = hand.filter((c) => c !== card);
  s.stats[seat].layoffs += 1;
  s.stats[seat].played += 1;
  say(s, seat, `Added ${label(card)} to a ${meld.kind}.`);
}

export const remoGame: GameDef<RemoState> = {
  id: 'remo',
  minPlayers: 2,
  maxPlayers: 4,
  autoStart: false,
  defaultOptions: DEFAULT_REMO,
  sanitizeOptions: sanitizeRemo,

  start,
  restart: (previous, players, rng) => start(players, rng, previous.config),

  move(state, seat, raw, rng = Math.random) {
    const move = raw as Move | null;
    if (!move || typeof move !== 'object')
      throw new RoomError('Invalid move', 400);
    if (state.over) throw new RoomError('The match is over', 409);
    const s = structuredClone(state);

    if (move.type === 'next') {
      if (!s.roundOver) throw new RoomError('The round is not over', 409);
      s.round += 1;
      s.starter = nextSeat(s, s.starter);
      deal(s, rng);
      say(s, null, `Round ${s.round} begins.`);
      return s;
    }

    if (s.roundOver) throw new RoomError('The round is over', 409);
    if (s.turn !== seat) throw new RoomError('Not your turn', 409);
    if (!isIn(s, seat)) throw new RoomError('You left the game', 403);

    switch (move.type) {
      case 'draw': {
        if (s.phase !== 'draw')
          throw new RoomError('You already drew this turn', 409);
        const from = move.from === 'discard' ? 'discard' : 'pile';
        let card: string;
        if (from === 'discard') {
          const top = s.discard.pop();
          if (!top) throw new RoomError('The discard pile is empty', 409);
          card = top;
          s.took = top;
        } else {
          if (!refill(s, rng)) {
            // nothing left to draw: the round ends, fewest points left wins
            const pens = s.hands.map((h, i) =>
              isIn(s, i) ? h.reduce((a, c) => a + penalty(c), 0) : Infinity,
            );
            const best = Math.min(...pens);
            const tied = pens.filter((p) => p === best).length > 1;
            endRound(s, tied ? null : pens.indexOf(best), 'stalled');
            return s;
          }
          card = s.draw.pop()!;
          s.took = null;
        }
        s.hands[seat].push(card);
        s.phase = 'play';
        s.stats[seat].turns += 1;
        say(
          s,
          seat,
          from === 'discard'
            ? `Took ${label(card)} from the discard pile.`
            : 'Drew a card.',
        );
        return s;
      }

      case 'meld':
        doMeld(s, seat, move);
        break;
      case 'layoff':
        doLayoff(s, seat, move);
        break;

      case 'discard': {
        requirePlay(s, seat);
        const [card] = takeFrom(s.hands[seat], [move.card]);
        if (s.config.noSameDiscard && s.took === card) {
          throw new RoomError(
            'You cannot discard the card you just took.',
            409,
          );
        }
        if (s.config.finish === 'melded' && s.hands[seat].length === 1) {
          throw new RoomError(
            'Lay your last card down, you cannot go out by discarding it.',
            409,
          );
        }
        s.hands[seat] = s.hands[seat].filter((c) => c !== card);
        s.discard.push(card);
        say(s, seat, `Discarded ${label(card)}.`);
        if (s.hands[seat].length === 0) {
          endRound(s, seat, 'out');
          return s;
        }
        advance(s);
        return s;
      }

      case 'pass': {
        // the one card left cannot be laid down and may not be discarded: just end the turn
        requirePlay(s, seat);
        if (!(s.config.finish === 'melded' && s.hands[seat].length === 1)) {
          throw new RoomError('Discard a card to end your turn', 409);
        }
        say(s, seat, 'Ended the turn.');
        advance(s);
        return s;
      }

      default:
        throw new RoomError('Unknown move', 400);
    }

    // laid down or added: the hand may be empty
    if (s.hands[seat].length === 0) endRound(s, seat, 'out');
    return s;
  },

  waiting: (state) =>
    state.over || state.roundOver || !state.config.turnSeconds
      ? null
      : { seats: [state.turn], seconds: state.config.turnSeconds },

  // out of time: draw from the pile, then throw away the card worth the most
  autoMove(state, seat) {
    if (state.turn !== seat || state.roundOver) return null;
    if (state.phase === 'draw') return { type: 'draw', from: 'pile' };
    const hand = state.hands[seat];
    if (state.config.finish === 'melded' && hand.length === 1)
      return { type: 'pass' };
    const choices = hand
      .filter((c) => !(state.config.noSameDiscard && c === state.took))
      .sort((a, b) => penalty(b) - penalty(a));
    return { type: 'discard', card: choices[0] ?? hand[0] };
  },

  eliminate(state, seat, rng = Math.random) {
    if (!isIn(state, seat) || state.over) return state;
    const s = structuredClone(state);
    // their cards go back into the pile
    s.draw = shuffle([...s.draw, ...s.hands[seat]], rng);
    s.hands[seat] = [];
    s.dropped.push(seat);
    say(s, seat, 'Left the game.');
    const left = live(s);
    if (left.length <= 1) {
      if (!s.roundOver) endRound(s, left[0] ?? null, 'left');
      s.over = true;
      s.endedAt = s.endedAt ?? Date.now();
      s.winners = left;
    } else if (s.turn === seat && !s.roundOver) {
      advance(s);
    }
    return s;
  },

  view(state, seat): RemoView {
    const done = state.roundOver || state.over;
    return {
      config: state.config,
      players: state.players,
      you: seat,
      hand: seat === null ? [] : state.hands[seat],
      counts: state.hands.map((h) => h.length),
      drawCount: state.draw.length,
      discardTop: state.discard.length
        ? state.discard[state.discard.length - 1]
        : null,
      discardCount: state.discard.length,
      melds: state.melds,
      turn: state.turn,
      phase: state.phase,
      round: state.round,
      opened: state.opened,
      took: seat === state.turn ? state.took : null,
      dropped: state.dropped,
      totals: state.totals,
      roundPenalty: state.roundPenalty,
      revealed: done ? state.hands : null,
      roundOver: state.roundOver,
      roundWinner: state.roundWinner,
      roundReason: state.roundReason,
      over: state.over,
      winners: state.winners,
      ranking: done ? ranking(state) : [],
      stats: state.stats,
      feed: state.feed,
      elapsed: Math.max(
        0,
        Math.floor(((state.endedAt ?? Date.now()) - state.startedAt) / 1000),
      ),
    };
  },

  isOver: (state) => state.over,
};
