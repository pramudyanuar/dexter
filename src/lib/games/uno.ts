import type { GameDef } from '@/lib/rooms/game';
import { RoomError } from '@/lib/rooms/types';

/** R red, Y yellow, G green, B blue; P pink, T teal, O orange, U purple (Flip's dark side) */
export type Color = 'R' | 'Y' | 'G' | 'B' | 'P' | 'T' | 'O' | 'U';
/** S skip, V reverse, D draw two, W wild, F wild draw four */
export type Value =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | 'S'
  | 'V'
  | 'D'
  | 'W'
  | 'F'
  // Flip: flip, draw one, draw five, skip everyone, wild draw two / draw colour
  | 'L'
  | 'D1'
  | 'D5'
  | 'SE'
  | 'WD2'
  | 'WDC'
  // No Mercy: coloured draw four, discard all, wild reverse +4 / +6 / +10 / colour roulette
  | 'D4'
  | 'DA'
  | 'WR4'
  | 'W6'
  | 'W10'
  | 'WRL';

export interface Card {
  c: Color | 'W';
  v: Value;
}

export const COLORS: readonly Color[] = ['R', 'Y', 'G', 'B'];
export const DARK_COLORS: readonly Color[] = ['P', 'T', 'O', 'U'];
const NUMBERS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
const ACTIONS = ['S', 'V', 'D'] as const;
export const HAND_SIZE = 7;

/** The standard 108-card deck. */
export function deck(): Card[] {
  const cards: Card[] = [];
  for (const c of COLORS) {
    cards.push({ c, v: '0' });
    for (const v of [...NUMBERS, ...ACTIONS]) cards.push({ c, v }, { c, v });
  }
  for (let i = 0; i < 4; i++)
    cards.push({ c: 'W', v: 'W' }, { c: 'W', v: 'F' });
  return cards;
}

export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface UnoEvent {
  seat: number;
  kind:
    | 'play'
    | 'draw'
    | 'pass'
    | 'uno'
    | 'catch'
    | 'accept'
    | 'challenge'
    // Flip / No Mercy
    | 'take';
  card?: Card;
  /** Colour chosen with a wild */
  color?: Color;
  /** Every card of a stacked play, in order; `card` is the last one */
  cards?: Card[];
  /** A draw that could not be played, so the turn moved on */
  passed?: boolean;
  /** The seat caught not calling UNO (`catch`), or the one challenged (`challenge`) */
  target?: number;
  /** A challenge was right: the +4 had been played with the colour in hand */
  caught?: boolean;
  /** Flip: the side now showing after a FLIP card */
  flipped?: 'light' | 'dark';
  /** No Mercy: cards a Discard All dropped, and the seat a 7 swapped with */
  dumped?: number;
  swapped?: number;
  /** No Mercy: every hand was passed on by a 0 */
  rotated?: boolean;
  /** No Mercy: seats knocked out for reaching 25 cards */
  mercy?: number[];
  /** Cards pulled from the pile this move, so clients can animate them */
  drew?: { seat: number; count: number };
}

export interface UnoState {
  players: number;
  hands: Card[][];
  /** Face-down pile, next card at the end */
  draw: Card[];
  /** Face-up pile, current card at the end */
  discard: Card[];
  turn: number;
  /** 1 clockwise, -1 counter-clockwise */
  dir: 1 | -1;
  /** The colour in play: the top card's, or the one chosen for a wild */
  color: Color;
  /** The first player to empty their hand */
  winner: number | null;
  /**
   * Seats in the order they emptied their hands. Play goes on without them
   * until one player is left, who is added last. Missing in older states.
   */
  places?: number[];
  /**
   * Seats removed from the game (they left, or kept missing turns). Play goes on
   * without them. Missing in older states.
   */
  dropped?: number[];
  /**
   * A wild draw four waits for its victim, who either takes the four cards or
   * challenges: bluffed (the player held `color`), the player draws four
   * instead; honest, the victim draws six. Missing in older states.
   */
  challenge?: { from: number; victim: number; color: Color } | null;
  /** After drawing a playable card, its owner may play exactly that one */
  pending: { seat: number; index: number } | null;
  /** Whether each seat has called "UNO" while down to one card. Missing in older states. */
  calledUno?: boolean[];
  last: UnoEvent | null;
}

const isNumber = (card: Card) => card.c !== 'W' && /^[0-9]$/.test(card.v);
const top = (s: UnoState) => s.discard[s.discard.length - 1];
const placesOf = (s: UnoState) => s.places ?? [];
const droppedOf = (s: UnoState) => s.dropped ?? [];
const isOut = (s: UnoState, seat: number) =>
  placesOf(s).includes(seat) || droppedOf(s).includes(seat);
const active = (s: UnoState) =>
  s.players - placesOf(s).length - droppedOf(s).length;
/** Over once only one player still holds cards (older states: on the first win). */
const finished = (s: UnoState) =>
  s.places
    ? s.places.length + droppedOf(s).length >= s.players - 1
    : s.winner !== null;

const unoFlags = (s: UnoState) =>
  (s.calledUno ??= Array<boolean>(s.players).fill(false));

/** Clear the UNO call of every seat that is no longer sitting on one card. */
function syncUnoFlags(s: UnoState) {
  const flags = unoFlags(s);
  for (let i = 0; i < s.players; i++) {
    if (s.hands[i].length !== 1) flags[i] = false;
  }
}

/** The seat `steps` turns after `from`, skipping players who already finished. */
function nextSeat(s: UnoState, from: number, steps = 1) {
  let seat = from;
  for (let n = 0; n < steps; n++) {
    for (let guard = 0; guard < s.players; guard++) {
      seat = (((seat + s.dir) % s.players) + s.players) % s.players;
      if (!isOut(s, seat)) break;
    }
  }
  return seat;
}

/**
 * Whether `card` may be played. A wild draw four is meant for hands without
 * the current colour, but it can always be played as a bluff: the next player
 * may challenge it.
 */
export function canPlay(s: UnoState, card: Card, _hand?: Card[]): boolean {
  if (card.c === 'W') return true;
  return card.c === s.color || card.v === top(s).v;
}

export function start(
  players: number,
  rng: () => number = Math.random,
): UnoState {
  const draw = shuffle(deck(), rng);
  const hands: Card[][] = Array.from({ length: players }, () => []);
  for (let i = 0; i < HAND_SIZE; i++) {
    for (let p = 0; p < players; p++) hands[p].push(draw.pop()!);
  }

  // open with a plain number card, so no action has to be resolved at the start
  const at = draw.findLastIndex(isNumber);
  const first = draw.splice(at, 1)[0];

  return {
    players,
    hands,
    draw,
    discard: [first],
    turn: 0,
    dir: 1,
    color: first.c as Color,
    winner: null,
    places: [],
    pending: null,
    calledUno: Array<boolean>(players).fill(false),
    last: null,
  };
}

/** Deals `count` cards to `seat`, reshuffling the discard pile if the deck runs out. */
function deal(s: UnoState, seat: number, count: number, rng: () => number) {
  for (let i = 0; i < count; i++) {
    if (s.draw.length === 0) {
      const keep = s.discard.pop()!;
      s.draw = shuffle(s.discard, rng);
      s.discard = [keep];
    }
    const card = s.draw.pop();
    if (!card) return; // nothing left anywhere
    s.hands[seat].push(card);
  }
}

type Move =
  | {
      type: 'play';
      index: number;
      color?: Color;
      /** More cards with the same number, played on top in this order */
      also?: number[];
    }
  | { type: 'draw' }
  | { type: 'pass' }
  | { type: 'accept' }
  | { type: 'challenge' }
  | { type: 'uno' }
  | { type: 'catch'; target: number };

/** Call "UNO" while down to one card (or the two before playing the next). */
function callUno(s: UnoState, seat: number) {
  if (isOut(s, seat)) throw new RoomError('Kamu sudah selesai', 409);
  const n = s.hands[seat].length;
  if (n !== 1 && n !== 2) {
    throw new RoomError('UNO cuma bisa saat sisa satu kartu', 400);
  }
  unoFlags(s)[seat] = true;
  s.last = { seat, kind: 'uno' };
}

/** Catch a player who was left on one card without calling UNO: they draw two. */
function catchUno(
  s: UnoState,
  seat: number,
  target: unknown,
  rng: () => number,
) {
  if (isOut(s, seat)) throw new RoomError('Kamu sudah selesai', 409);
  if (
    !Number.isInteger(target) ||
    (target as number) < 0 ||
    (target as number) >= s.players ||
    target === seat
  ) {
    throw new RoomError('Pemain tidak ada', 400);
  }
  const t = target as number;
  if (isOut(s, t)) throw new RoomError('Pemain itu sudah selesai', 409);
  const flags = unoFlags(s);
  if (s.hands[t].length !== 1 || flags[t]) {
    throw new RoomError('Tidak bisa ditangkap', 409);
  }
  deal(s, t, 2, rng);
  flags[t] = false;
  s.last = { seat, kind: 'catch', target: t, drew: { seat: t, count: 2 } };
}

/**
 * Validates the extra cards of a stacked play: only number cards, all with the
 * same number as the first, each named once. Not allowed right after drawing.
 */
function stackOf(
  s: UnoState,
  hand: Card[],
  index: number,
  raw: unknown,
): number[] {
  if (raw === undefined || (Array.isArray(raw) && raw.length === 0)) return [];
  if (!Array.isArray(raw)) throw new RoomError('Tumpukan tidak valid', 400);
  if (s.pending) {
    throw new RoomError('Setelah menarik, tidak bisa menumpuk kartu', 400);
  }
  const first = hand[index];
  if (!isNumber(first)) {
    throw new RoomError('Hanya kartu angka yang bisa ditumpuk', 400);
  }
  const seen = new Set([index]);
  for (const i of raw) {
    if (!Number.isInteger(i) || i < 0 || i >= hand.length || seen.has(i)) {
      throw new RoomError('Kartu tidak ada', 400);
    }
    seen.add(i);
    if (!isNumber(hand[i]) || hand[i].v !== first.v) {
      throw new RoomError('Yang ditumpuk harus angka yang sama', 400);
    }
  }
  return raw as number[];
}

/** Indexes of other cards that may be stacked on `index` (same number). */
export function stackable(hand: Card[], index: number): number[] {
  const first = hand[index];
  if (!first || !isNumber(first)) return [];
  return hand.flatMap((card, i) =>
    i !== index && isNumber(card) && card.v === first.v ? [i] : [],
  );
}

function play(
  s: UnoState,
  seat: number,
  move: Extract<Move, { type: 'play' }>,
  rng: () => number,
) {
  const hand = s.hands[seat];
  const index = move.index;
  if (!Number.isInteger(index) || index < 0 || index >= hand.length) {
    throw new RoomError('Kartu tidak ada', 400);
  }
  if (s.pending && s.pending.index !== index) {
    throw new RoomError(
      'Setelah menarik, hanya kartu itu yang boleh dimainkan',
      400,
    );
  }
  const card = hand[index];
  if (!canPlay(s, card, hand)) {
    throw new RoomError('Kartu itu tidak bisa dimainkan', 400);
  }
  if (card.c === 'W' && !COLORS.includes(move.color as Color)) {
    throw new RoomError('Pilih warna dulu', 400);
  }

  const also = stackOf(s, hand, index, move.also);
  const before = s.color;
  const played = [card, ...also.map((i) => hand[i])];
  // remove from the back so the earlier indexes stay valid
  for (const i of [index, ...also].sort((a, b) => b - a)) hand.splice(i, 1);
  s.discard.push(...played);
  const lastCard = played[played.length - 1];
  s.color = card.c === 'W' ? (move.color as Color) : (lastCard.c as Color);
  s.pending = null;
  s.last = {
    seat,
    kind: 'play',
    card: lastCard,
    color: card.c === 'W' ? s.color : undefined,
    ...(played.length > 1 ? { cards: played } : {}),
  };

  if (hand.length === 0) {
    // out of cards: this player is done, the others play on for the places
    s.places = [...placesOf(s), seat];
    if (s.winner === null) s.winner = seat;
    if (finished(s)) {
      const last = Array.from({ length: s.players }, (_, i) => i).find(
        (i) => !isOut(s, i),
      );
      if (last !== undefined) s.places.push(last);
      return;
    }
  }

  const out = hand.length === 0;
  switch (card.v) {
    case 'S':
      s.turn = nextSeat(s, seat, 2);
      break;
    case 'V':
      s.dir = (s.dir * -1) as 1 | -1;
      // with two players left a reverse works like a skip
      s.turn = active(s) === 2 && !out ? seat : nextSeat(s, seat);
      break;
    case 'D': {
      const victim = nextSeat(s, seat);
      deal(s, victim, 2, rng);
      if (s.last) s.last.drew = { seat: victim, count: 2 };
      s.turn = nextSeat(s, seat, 2);
      break;
    }
    case 'F': {
      const victim = nextSeat(s, seat);
      if (out) {
        // the last card cannot be challenged: just pay up
        deal(s, victim, 4, rng);
        if (s.last) s.last.drew = { seat: victim, count: 4 };
        s.turn = nextSeat(s, seat, 2);
      } else {
        // the victim decides: take four, or challenge
        s.challenge = { from: seat, victim, color: before };
        s.turn = victim;
      }
      break;
    }
    default:
      s.turn = nextSeat(s, seat);
  }
}

/** The victim of a wild draw four takes the four cards and loses the turn. */
function acceptFour(s: UnoState, seat: number, rng: () => number) {
  const ch = s.challenge!;
  deal(s, seat, 4, rng);
  s.challenge = null;
  s.last = { seat, kind: 'accept', target: ch.from, drew: { seat, count: 4 } };
  s.turn = nextSeat(s, seat);
}

/**
 * The victim bets the +4 was a bluff. Right: the player who played it draws
 * four and the victim plays on. Wrong: the victim draws six and loses the turn.
 */
function challengeFour(s: UnoState, seat: number, rng: () => number) {
  const ch = s.challenge!;
  const caught = s.hands[ch.from].some((c) => c.c === ch.color);
  s.challenge = null;
  if (caught) {
    deal(s, ch.from, 4, rng);
    s.last = {
      seat,
      kind: 'challenge',
      target: ch.from,
      caught,
      drew: { seat: ch.from, count: 4 },
    };
    s.turn = seat;
  } else {
    deal(s, seat, 6, rng);
    s.last = {
      seat,
      kind: 'challenge',
      target: ch.from,
      caught,
      drew: { seat, count: 6 },
    };
    s.turn = nextSeat(s, seat);
  }
}

function drawCard(s: UnoState, seat: number, rng: () => number) {
  if (s.pending) throw new RoomError('Kamu sudah menarik kartu', 409);

  const before = s.hands[seat].length;
  deal(s, seat, 1, rng);
  const drawn = s.hands[seat].length > before;
  const index = s.hands[seat].length - 1;

  const drew = drawn ? { seat, count: 1 } : undefined;
  if (drawn && canPlay(s, s.hands[seat][index], s.hands[seat])) {
    // the drawn card fits: its owner decides whether to play it or pass
    s.pending = { seat, index };
    s.last = { seat, kind: 'draw', drew };
  } else {
    s.last = { seat, kind: 'draw', passed: true, drew };
    s.turn = nextSeat(s, seat);
  }
}

export const unoGame: GameDef<UnoState> = {
  id: 'uno',
  minPlayers: 2,
  maxPlayers: 8,
  autoStart: false,

  start,
  restart: (previous, players, rng) => {
    const next = start(players, rng);
    // the winner opens the next game (if they are still seated)
    const opener = previous.winner ?? 0;
    return { ...next, turn: opener < players ? opener : 0 };
  },

  move(state, seat, raw, rng = Math.random) {
    if (isOut(state, seat))
      throw new RoomError('Kartumu sudah habis, tunggu yang lain selesai', 409);
    const move = raw as Move | null;
    if (!move || typeof move !== 'object')
      throw new RoomError('Langkah tidak valid', 400);

    const s = structuredClone(state);

    // calling UNO and catching happen off-turn, so handle them first
    if (move.type === 'uno') {
      callUno(s, seat);
      return s;
    }
    if (move.type === 'catch') {
      catchUno(s, seat, move.target, rng);
      return s;
    }

    if (state.turn !== seat) throw new RoomError('Bukan giliranmu', 409);
    if (move.type === 'accept' || move.type === 'challenge') {
      if (!s.challenge || s.challenge.victim !== seat) {
        throw new RoomError('Tidak ada +4 yang perlu dijawab', 409);
      }
      if (move.type === 'accept') acceptFour(s, seat, rng);
      else challengeFour(s, seat, rng);
      syncUnoFlags(s);
      return s;
    }
    if (s.challenge) {
      throw new RoomError('Jawab +4 dulu: terima atau tantang', 409);
    }
    switch (move.type) {
      case 'play':
        play(s, seat, move, rng);
        break;
      case 'draw':
        drawCard(s, seat, rng);
        break;
      case 'pass':
        if (!s.pending || s.pending.seat !== seat) {
          throw new RoomError(
            'Tidak ada yang perlu dilewati. Tarik kartu dulu.',
            409,
          );
        }
        s.pending = null;
        s.last = { seat, kind: 'pass' };
        s.turn = nextSeat(s, seat);
        break;
      default:
        throw new RoomError('Langkah tidak dikenal', 400);
    }
    syncUnoFlags(s);
    return s;
  },

  waiting: (state) =>
    finished(state) ? null : { seats: [state.turn], seconds: 40 },

  // an idle player draws a card (and passes if it fits): a penalty, not a play
  autoMove: (state, seat) =>
    state.challenge?.victim === seat
      ? { type: 'accept' }
      : state.pending?.seat === seat
        ? { type: 'pass' }
        : { type: 'draw' },

  eliminate(state, seat, rng = Math.random) {
    if (isOut(state, seat)) return state;
    const s = structuredClone(state);
    // their cards go back into the pile
    s.draw = shuffle([...s.draw, ...s.hands[seat]], rng);
    s.hands[seat] = [];
    s.dropped = [...droppedOf(s), seat];
    if (s.pending?.seat === seat) s.pending = null;
    if (s.challenge) {
      // the +4 is void; its victim (if still here) just plays on
      const victim = s.challenge.victim;
      s.challenge = null;
      if (victim !== seat) s.turn = victim;
    }
    if (s.turn === seat) s.turn = nextSeat(s, seat);
    if (finished(s)) {
      // whoever still holds cards wins; the removed players rank last
      const last = Array.from({ length: s.players }, (_, i) => i).find(
        (i) => !isOut(s, i),
      );
      const places = [...placesOf(s)];
      if (last !== undefined) {
        places.push(last);
        if (s.winner === null) s.winner = last;
      }
      s.places = [
        ...places,
        ...droppedOf(s).filter((d) => !places.includes(d)),
      ];
    }
    syncUnoFlags(s);
    return s;
  },

  view(state, seat): UnoView {
    const myTurn =
      seat !== null &&
      !finished(state) &&
      !isOut(state, seat) &&
      state.turn === seat;
    const hand = seat === null ? [] : state.hands[seat];
    const challenged = state.challenge ?? null;
    const playable =
      myTurn && !challenged
        ? hand.flatMap((card, i) =>
            state.pending
              ? i === state.pending.index
                ? [i]
                : []
              : canPlay(state, card, hand)
                ? [i]
                : [],
          )
        : [];
    const counts = state.hands.map((h) => h.length);
    const called = state.calledUno ?? Array<boolean>(state.players).fill(false);
    const active = seat !== null && !finished(state) && !isOut(state, seat);
    return {
      players: state.players,
      counts,
      hand,
      playable,
      stuck: myTurn && !state.pending && !challenged && playable.length === 0,
      canDraw: myTurn && !state.pending && !challenged,
      // a wild draw four is waiting for you: take it, or challenge it
      challenge: challenged
        ? {
            from: challenged.from,
            victim: challenged.victim,
            color: challenged.color,
          }
        : null,
      canChallenge: myTurn && challenged?.victim === seat,
      canPass: myTurn && state.pending?.seat === seat,
      top: top(state),
      // the last few discards, oldest first, for a messy pile
      pile: state.discard.slice(-7),
      color: state.color,
      turn: state.turn,
      dir: state.dir,
      drawCount: state.draw.length,
      winner: state.winner,
      places: placesOf(state),
      calledUno: called,
      // shout on your turn before playing your next-to-last card, or belatedly
      // while already stuck on one card (before a rival catches you)
      canCallUno:
        active &&
        seat !== null &&
        !called[seat] &&
        (counts[seat] === 1 ||
          (counts[seat] === 2 &&
            state.turn === seat &&
            !finished(state) &&
            // with nothing to play you must draw, so there is nothing to announce
            playable.length > 0)),
      // seats you may catch: one card left, no UNO called, not you
      catchable:
        seat === null || !active
          ? []
          : counts.flatMap((n, j) =>
              j !== seat && n === 1 && !called[j] && !isOut(state, j)
                ? [j]
                : [],
            ),
      last: state.last,
    };
  },

  isOver: (state) => finished(state),
};

/** What one seat sees. Other hands and the draw pile's order never appear. */
export interface UnoView {
  players: number;
  counts: number[];
  hand: Card[];
  /** Indexes into `hand` that may be played right now */
  playable: number[];
  /** Your turn, and nothing in your hand fits: you have to draw */
  stuck: boolean;
  canDraw: boolean;
  canPass: boolean;
  /** A wild draw four waiting for its victim's answer (colour = the one in play before it) */
  challenge: { from: number; victim: number; color: Color } | null;
  /** You are the victim: accept (draw 4) or challenge */
  canChallenge: boolean;
  top: Card;
  /** The last few discards, oldest first, so the pile can look stacked */
  pile: Card[];
  color: Color;
  turn: number;
  dir: 1 | -1;
  drawCount: number;
  winner: number | null;
  /** Seats in finishing order; complete once the game is over */
  places: number[];
  /** Whether each seat has shouted UNO while on one card */
  calledUno: boolean[];
  /** You can shout UNO right now */
  canCallUno: boolean;
  /** Seats you may catch for not calling UNO */
  catchable: number[];
  last: UnoEvent | null;
}
