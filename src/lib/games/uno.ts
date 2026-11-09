import type { GameDef } from '@/lib/rooms/game';
import { RoomError } from '@/lib/rooms/types';

export type Color = 'R' | 'Y' | 'G' | 'B';
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
  | 'F';

export interface Card {
  c: Color | 'W';
  v: Value;
}

export const COLORS: readonly Color[] = ['R', 'Y', 'G', 'B'];
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
  kind: 'play' | 'draw' | 'pass';
  card?: Card;
  /** Colour chosen with a wild */
  color?: Color;
  /** A draw that could not be played, so the turn moved on */
  passed?: boolean;
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
  /** After drawing a playable card, its owner may play exactly that one */
  pending: { seat: number; index: number } | null;
  last: UnoEvent | null;
}

const isNumber = (card: Card) => card.c !== 'W' && /^[0-9]$/.test(card.v);
const top = (s: UnoState) => s.discard[s.discard.length - 1];
const placesOf = (s: UnoState) => s.places ?? [];
const isOut = (s: UnoState, seat: number) => placesOf(s).includes(seat);
const active = (s: UnoState) => s.players - placesOf(s).length;
/** Over once only one player still holds cards (older states: on the first win). */
const finished = (s: UnoState) =>
  s.places ? s.places.length >= s.players - 1 : s.winner !== null;

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
 * Whether `card` may be played by someone holding `hand`. A wild draw four is
 * only legal with no card of the current colour (there is no challenge rule
 * here, so it is enforced outright).
 */
export function canPlay(s: UnoState, card: Card, hand: Card[]): boolean {
  if (card.v === 'W') return true;
  if (card.v === 'F') return !hand.some((h) => h.c === s.color);
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
  | { type: 'play'; index: number; color?: Color }
  | { type: 'draw' }
  | { type: 'pass' };

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
    throw new RoomError(
      card.v === 'F'
        ? 'Wild +4 hanya boleh jika tidak punya warna yang sedang berlaku'
        : 'Kartu itu tidak bisa dimainkan',
      400,
    );
  }
  if (card.c === 'W' && !COLORS.includes(move.color as Color)) {
    throw new RoomError('Pilih warna dulu', 400);
  }

  hand.splice(index, 1);
  s.discard.push(card);
  s.color = card.c === 'W' ? (move.color as Color) : card.c;
  s.pending = null;
  s.last = {
    seat,
    kind: 'play',
    card,
    color: card.c === 'W' ? s.color : undefined,
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
    case 'D':
      deal(s, nextSeat(s, seat), 2, rng);
      s.turn = nextSeat(s, seat, 2);
      break;
    case 'F':
      deal(s, nextSeat(s, seat), 4, rng);
      s.turn = nextSeat(s, seat, 2);
      break;
    default:
      s.turn = nextSeat(s, seat);
  }
}

function drawCard(s: UnoState, seat: number, rng: () => number) {
  if (s.pending) throw new RoomError('Kamu sudah menarik kartu', 409);

  const before = s.hands[seat].length;
  deal(s, seat, 1, rng);
  const drawn = s.hands[seat].length > before;
  const index = s.hands[seat].length - 1;

  if (drawn && canPlay(s, s.hands[seat][index], s.hands[seat])) {
    // the drawn card fits: its owner decides whether to play it or pass
    s.pending = { seat, index };
    s.last = { seat, kind: 'draw' };
  } else {
    s.last = { seat, kind: 'draw', passed: true };
    s.turn = nextSeat(s, seat);
  }
}

export const unoGame: GameDef<UnoState> = {
  id: 'uno',
  minPlayers: 2,
  maxPlayers: 4,
  autoStart: false,

  start,
  restart: (previous, players, rng) => {
    const next = start(players, rng);
    // the winner opens the next game
    return { ...next, turn: previous.winner ?? 0 };
  },

  move(state, seat, raw, rng = Math.random) {
    if (isOut(state, seat))
      throw new RoomError('Kartumu sudah habis, tunggu yang lain selesai', 409);
    if (state.turn !== seat) throw new RoomError('Bukan giliranmu', 409);
    const move = raw as Move | null;
    if (!move || typeof move !== 'object')
      throw new RoomError('Langkah tidak valid', 400);

    const s = structuredClone(state);
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
    return s;
  },

  view(state, seat): UnoView {
    const myTurn =
      seat !== null &&
      !finished(state) &&
      !isOut(state, seat) &&
      state.turn === seat;
    const hand = seat === null ? [] : state.hands[seat];
    const playable = myTurn
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
    return {
      players: state.players,
      counts: state.hands.map((h) => h.length),
      hand,
      playable,
      stuck: myTurn && !state.pending && playable.length === 0,
      canDraw: myTurn && !state.pending,
      canPass: myTurn && state.pending?.seat === seat,
      top: top(state),
      color: state.color,
      turn: state.turn,
      dir: state.dir,
      drawCount: state.draw.length,
      winner: state.winner,
      places: placesOf(state),
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
  top: Card;
  color: Color;
  turn: number;
  dir: 1 | -1;
  drawCount: number;
  winner: number | null;
  /** Seats in finishing order; complete once the game is over */
  places: number[];
  last: UnoEvent | null;
}
