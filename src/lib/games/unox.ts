import {
  Card,
  Color,
  COLORS,
  DARK_COLORS,
  shuffle,
  UnoEvent,
  UnoView,
} from '@/lib/games/uno';
import type { GameDef } from '@/lib/rooms/game';
import { GameId, RoomError } from '@/lib/rooms/types';

/**
 * The two big Uno variants, on one engine:
 *
 * - Flip: every card has a light and a dark face. A FLIP card turns the whole
 *   game over. The dark side hits much harder (draw five, skip everyone, draw
 *   until your colour comes up).
 * - No Mercy: a bigger, crueller deck. Draw cards stack, you keep drawing until
 *   something fits, a 7 swaps hands, a 0 passes every hand along, and anyone who
 *   reaches 25 cards is out.
 */

export type Variant = 'flip' | 'nomercy';
export type Side = 'light' | 'dark';

/** One physical card: what it shows on each side (the same on both in No Mercy). */
export interface XCard {
  l: Card;
  d: Card;
}

export const HAND_SIZE = 7;
/** At this many cards in hand a No Mercy player is knocked out. */
export const MERCY_LIMIT = 25;

export interface XState {
  variant: Variant;
  players: number;
  hands: XCard[][];
  draw: XCard[];
  discard: XCard[];
  side: Side;
  turn: number;
  dir: 1 | -1;
  /** The colour in play: the top face's, or the one chosen for a wild */
  color: Color;
  winner: number | null;
  places: number[];
  dropped: number[];
  /** After drawing a playable card, its owner may play exactly that one */
  pending: { seat: number; index: number } | null;
  /** No Mercy: stacked draw cards the current player must beat or take */
  penalty: number;
  calledUno: boolean[];
  last: UnoEvent | null;
}

export interface UnoXView extends UnoView {
  variant: Variant;
  side: Side;
  /** Stacked cards you must beat with another draw card, or take (No Mercy) */
  penalty: number;
}

// ------------------------------------------------------------------- decks

const NUMBERS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

const face = (c: Card['c'], v: Card['v']): Card => ({ c, v });

/** The 112 faces of one side of a Flip deck. */
function flipSide(
  colors: readonly Color[],
  extra: Card['v'][],
  wilds: Card['v'][],
) {
  const cards: Card[] = [];
  for (const c of colors) {
    for (const v of [...NUMBERS, ...extra, 'V', 'L'] as Card['v'][]) {
      cards.push(face(c, v), face(c, v));
    }
  }
  for (const v of ['W', ...wilds] as Card['v'][]) {
    for (let i = 0; i < 4; i++) cards.push(face('W', v));
  }
  return cards;
}

export function flipDeck(rng: () => number = Math.random): XCard[] {
  // light: 1-9, draw one, skip; dark: 1-9, draw five, skip everyone
  const light = shuffle(flipSide(COLORS, ['D1', 'S'], ['WD2']), rng);
  const dark = shuffle(flipSide(DARK_COLORS, ['D5', 'SE'], ['WDC']), rng);
  return light.map((l, i) => ({ l, d: dark[i] }));
}

/** 168 cards: 144 coloured and 24 wild. */
export function noMercyDeck(): XCard[] {
  const cards: Card[] = [];
  for (const c of COLORS) {
    for (const v of ['0', ...NUMBERS] as Card['v'][]) {
      cards.push(face(c, v), face(c, v));
    }
    for (const [v, n] of [
      ['D', 2],
      ['D4', 2],
      ['V', 3],
      ['S', 3],
      ['SE', 3],
      ['DA', 3],
    ] as const) {
      for (let i = 0; i < n; i++) cards.push(face(c, v));
    }
  }
  for (const v of ['WR4', 'W6', 'W10', 'WRL'] as const) {
    for (let i = 0; i < 6; i++) cards.push(face('W', v));
  }
  return cards.map((card) => ({ l: card, d: card }));
}

// ----------------------------------------------------------------- helpers

const faceOf = (s: XState, card: XCard) =>
  s.side === 'dark' ? card.d : card.l;
const topFace = (s: XState) => faceOf(s, s.discard[s.discard.length - 1]);
const colorsOf = (s: XState) => (s.side === 'dark' ? DARK_COLORS : COLORS);
const isNumber = (c: Card) => c.c !== 'W' && /^[0-9]$/.test(c.v);

const isOut = (s: XState, seat: number) =>
  s.places.includes(seat) || s.dropped.includes(seat);
const active = (s: XState) => s.players - s.places.length - s.dropped.length;
const finished = (s: XState) =>
  s.places.length + s.dropped.length >= s.players - 1;

/** The seat `steps` turns after `from`, skipping players who are out. */
function nextSeat(s: XState, from: number, steps = 1) {
  let seat = from;
  for (let n = 0; n < steps; n++) {
    for (let guard = 0; guard < s.players; guard++) {
      seat = (((seat + s.dir) % s.players) + s.players) % s.players;
      if (!isOut(s, seat)) break;
    }
  }
  return seat;
}

/** The draw-type cards of No Mercy, and how many cards each adds to the stack. */
const STACK: Record<string, number> = { D: 2, D4: 4, W6: 6, W10: 10, WR4: 4 };

export function canPlay(s: XState, card: Card): boolean {
  // under a stack of penalties only another draw card may answer
  if (s.penalty > 0) return card.v in STACK;
  if (card.c === 'W') return true;
  return card.c === s.color || card.v === topFace(s).v;
}

/** Deals `count` cards to `seat`, reshuffling the discard pile if the deck runs out. */
function deal(s: XState, seat: number, count: number, rng: () => number) {
  let given = 0;
  for (let i = 0; i < count; i++) {
    if (s.draw.length === 0) {
      const keep = s.discard.pop()!;
      s.draw = shuffle(s.discard, rng);
      s.discard = [keep];
    }
    const card = s.draw.pop();
    if (!card) break; // nothing left anywhere
    s.hands[seat].push(card);
    given++;
  }
  return given;
}

/** Deals until a card of `color` (on the side in play) turns up; returns how many. */
function dealUntil(s: XState, seat: number, color: Color, rng: () => number) {
  let given = 0;
  for (let guard = 0; guard < 300; guard++) {
    if (deal(s, seat, 1, rng) === 0) break;
    given++;
    const hand = s.hands[seat];
    if (faceOf(s, hand[hand.length - 1]).c === color) break;
  }
  return given;
}

const unoFlags = (s: XState) => s.calledUno;

function syncUnoFlags(s: XState) {
  for (let i = 0; i < s.players; i++) {
    if (s.hands[i].length !== 1) s.calledUno[i] = false;
  }
}

/** Once everyone but one is out, the one left takes the last place. */
function settle(s: XState) {
  if (!finished(s)) return;
  const last = Array.from({ length: s.players }, (_, i) => i).find(
    (i) => !isOut(s, i),
  );
  if (last !== undefined) {
    s.places = [...s.places, last];
    if (s.winner === null) s.winner = last;
  }
  // those removed from the game rank behind everyone who finished
  s.places = [...s.places, ...s.dropped.filter((d) => !s.places.includes(d))];
}

/** Takes a player out: their cards go back into the pile and play carries on. */
function dropSeat(s: XState, seat: number, rng: () => number) {
  if (isOut(s, seat)) return;
  s.draw = shuffle([...s.draw, ...s.hands[seat]], rng);
  s.hands[seat] = [];
  s.dropped = [...s.dropped, seat];
  if (s.pending?.seat === seat) s.pending = null;
  if (s.turn === seat) {
    s.penalty = 0;
    s.turn = nextSeat(s, seat);
  }
  settle(s);
}

/** No Mercy: anyone at 25 cards or more is out. */
function mercy(s: XState, rng: () => number) {
  if (s.variant !== 'nomercy') return;
  const out = s.hands.flatMap((h, seat) =>
    h.length >= MERCY_LIMIT && !isOut(s, seat) ? [seat] : [],
  );
  if (!out.length) return;
  for (const seat of out) dropSeat(s, seat, rng);
  if (s.last) s.last.mercy = out;
}

// -------------------------------------------------------------------- start

export function makeStart(variant: Variant) {
  return (players: number, rng: () => number = Math.random): XState => {
    const draw =
      variant === 'flip' ? flipDeck(rng) : shuffle(noMercyDeck(), rng);
    const hands: XCard[][] = Array.from({ length: players }, () => []);
    for (let i = 0; i < HAND_SIZE; i++) {
      for (let p = 0; p < players; p++) hands[p].push(draw.pop()!);
    }
    // open with a card that is a plain number on the light side
    const at = draw.findLastIndex((c) => isNumber(c.l));
    const first = draw.splice(at, 1)[0];
    return {
      variant,
      players,
      hands,
      draw,
      discard: [first],
      side: 'light',
      turn: 0,
      dir: 1,
      color: first.l.c as Color,
      winner: null,
      places: [],
      dropped: [],
      pending: null,
      penalty: 0,
      calledUno: Array<boolean>(players).fill(false),
      last: null,
    };
  };
}

// --------------------------------------------------------------------- moves

type Move =
  | { type: 'play'; index: number; color?: Color; target?: number }
  | { type: 'draw' }
  | { type: 'pass' }
  | { type: 'uno' }
  | { type: 'catch'; target: number };

function callUno(s: XState, seat: number) {
  if (isOut(s, seat)) throw new RoomError('You are already out', 409);
  const n = s.hands[seat].length;
  if (n !== 1 && n !== 2) {
    throw new RoomError('You can only call UNO on your last cards', 400);
  }
  unoFlags(s)[seat] = true;
  s.last = { seat, kind: 'uno' };
}

function catchUno(s: XState, seat: number, target: unknown, rng: () => number) {
  if (isOut(s, seat)) throw new RoomError('You are already out', 409);
  if (
    !Number.isInteger(target) ||
    (target as number) < 0 ||
    (target as number) >= s.players ||
    target === seat
  ) {
    throw new RoomError('No such player', 400);
  }
  const t = target as number;
  if (isOut(s, t)) throw new RoomError('That player is already out', 409);
  if (s.hands[t].length !== 1 || s.calledUno[t]) {
    throw new RoomError('Cannot be caught', 409);
  }
  const given = deal(s, t, 2, rng);
  s.calledUno[t] = false;
  s.last = { seat, kind: 'catch', target: t, drew: { seat: t, count: given } };
  mercy(s, rng);
}

function play(
  s: XState,
  seat: number,
  move: Extract<Move, { type: 'play' }>,
  rng: () => number,
) {
  const hand = s.hands[seat];
  const index = move.index;
  if (!Number.isInteger(index) || index < 0 || index >= hand.length) {
    throw new RoomError('No such card', 400);
  }
  if (s.pending && s.pending.index !== index) {
    throw new RoomError('After drawing you can only play that card', 400);
  }
  const card = hand[index];
  const f = faceOf(s, card);
  if (!canPlay(s, f)) {
    throw new RoomError(
      s.penalty > 0
        ? 'Answer with a draw card, or take the cards'
        : 'That card cannot be played',
      400,
    );
  }
  const wild = f.c === 'W';
  if (wild && !colorsOf(s).includes(move.color as Color)) {
    throw new RoomError('Pick a colour first', 400);
  }
  const swap = s.variant === 'nomercy' && f.v === '7';
  let target = -1;
  if (swap) {
    target = Number(move.target);
    if (
      !Number.isInteger(target) ||
      target < 0 ||
      target >= s.players ||
      target === seat ||
      isOut(s, target)
    ) {
      throw new RoomError('Pick a player to swap hands with', 400);
    }
  }

  hand.splice(index, 1);
  s.discard.push(card);
  s.color = wild ? (move.color as Color) : (f.c as Color);
  s.pending = null;
  s.last = {
    seat,
    kind: 'play',
    card: f,
    color: wild ? s.color : undefined,
  };

  // Discard All: every other card of that colour goes too, under the played one
  if (f.v === 'DA') {
    const dumped = hand.filter((h) => faceOf(s, h).c === f.c);
    s.hands[seat] = hand.filter((h) => faceOf(s, h).c !== f.c);
    s.discard.splice(s.discard.length - 1, 0, ...dumped);
    s.last.dumped = dumped.length;
  }

  if (s.hands[seat].length === 0) {
    s.places = [...s.places, seat];
    if (s.winner === null) s.winner = seat;
    if (finished(s)) {
      settle(s);
      return;
    }
  }
  const out = s.hands[seat].length === 0;
  const after = (steps = 1) => nextSeat(s, seat, steps);
  const victim = () => nextSeat(s, seat);
  const hit = (who: number, count: number) => {
    const given = deal(s, who, count, rng);
    s.last!.drew = { seat: who, count: given };
  };

  switch (f.v) {
    case 'S':
      s.turn = after(2);
      break;
    case 'SE':
      s.turn = out ? after() : seat;
      break;
    case 'V':
      s.dir = (s.dir * -1) as 1 | -1;
      s.turn = active(s) === 2 && !out ? seat : after();
      break;
    case 'L': {
      s.side = s.side === 'light' ? 'dark' : 'light';
      const now = topFace(s);
      s.color =
        now.c === 'W' ? colorsOf(s)[Math.floor(rng() * 4)] : (now.c as Color);
      s.last.flipped = s.side;
      s.turn = after();
      break;
    }
    case 'D1':
      hit(victim(), 1);
      s.turn = after(2);
      break;
    case 'D5':
      hit(victim(), 5);
      s.turn = after(2);
      break;
    case 'WD2':
      hit(victim(), 2);
      s.turn = after(2);
      break;
    case 'WDC':
    case 'WRL': {
      const who = victim();
      const given = dealUntil(s, who, s.color, rng);
      s.last.drew = { seat: who, count: given };
      s.turn = after(2);
      break;
    }
    case 'D':
    case 'D4':
    case 'W6':
    case 'W10':
      s.penalty += STACK[f.v];
      s.turn = after();
      break;
    case 'WR4':
      s.dir = (s.dir * -1) as 1 | -1;
      s.penalty += STACK.WR4;
      s.turn = after();
      break;
    case '7':
      if (swap) {
        const mine = s.hands[seat];
        s.hands[seat] = s.hands[target];
        s.hands[target] = mine;
        s.last.swapped = target;
      }
      s.turn = after();
      break;
    case '0':
      if (s.variant === 'nomercy') {
        // everyone hands their cards to the next player in the direction of play
        const seats = Array.from({ length: s.players }, (_, i) => i).filter(
          (i) => !isOut(s, i),
        );
        const moved = s.hands.map((h) => h);
        for (const i of seats) s.hands[nextSeat(s, i)] = moved[i];
        s.last.rotated = true;
      }
      s.turn = after();
      break;
    default:
      s.turn = after();
  }
  mercy(s, rng);
}

/** Takes the stacked penalty cards, and the turn is lost. */
function takePenalty(s: XState, seat: number, rng: () => number) {
  const given = deal(s, seat, s.penalty, rng);
  s.penalty = 0;
  s.last = { seat, kind: 'take', drew: { seat, count: given } };
  s.turn = nextSeat(s, seat);
  mercy(s, rng);
}

function drawCard(s: XState, seat: number, rng: () => number) {
  if (s.pending) throw new RoomError('You already drew a card', 409);
  if (s.penalty > 0) return takePenalty(s, seat, rng);

  let count = 0;
  let playable = false;
  // No Mercy: keep drawing until something fits
  const until = s.variant === 'nomercy';
  for (let guard = 0; guard < 300; guard++) {
    if (deal(s, seat, 1, rng) === 0) break;
    count++;
    const hand = s.hands[seat];
    playable = canPlay(s, faceOf(s, hand[hand.length - 1]));
    if (playable || !until) break;
  }
  const drew = count > 0 ? { seat, count } : undefined;
  if (playable) {
    s.pending = { seat, index: s.hands[seat].length - 1 };
    s.last = { seat, kind: 'draw', drew };
  } else {
    s.last = { seat, kind: 'draw', passed: true, drew };
    s.turn = nextSeat(s, seat);
  }
  mercy(s, rng);
}

// ------------------------------------------------------------------ the game

export function makeGame(variant: Variant, id: GameId): GameDef<XState> {
  const start = makeStart(variant);
  return {
    id,
    minPlayers: 2,
    maxPlayers: 8,
    autoStart: false,

    start,
    restart: (previous, players, rng) => {
      const next = start(players, rng);
      const opener = previous.winner ?? 0;
      return { ...next, turn: opener < players ? opener : 0 };
    },

    move(state, seat, raw, rng = Math.random) {
      if (isOut(state, seat))
        throw new RoomError('You are out, wait for the others to finish', 409);
      const move = raw as Move | null;
      if (!move || typeof move !== 'object')
        throw new RoomError('Invalid move', 400);

      const s = structuredClone(state);
      if (move.type === 'uno') {
        callUno(s, seat);
        return s;
      }
      if (move.type === 'catch') {
        catchUno(s, seat, move.target, rng);
        syncUnoFlags(s);
        return s;
      }
      if (state.turn !== seat) throw new RoomError('Not your turn', 409);
      switch (move.type) {
        case 'play':
          play(s, seat, move, rng);
          break;
        case 'draw':
          drawCard(s, seat, rng);
          break;
        case 'pass':
          if (!s.pending || s.pending.seat !== seat) {
            throw new RoomError('Nothing to pass. Draw a card first.', 409);
          }
          s.pending = null;
          s.last = { seat, kind: 'pass' };
          s.turn = nextSeat(s, seat);
          break;
        default:
          throw new RoomError('Unknown move', 400);
      }
      syncUnoFlags(s);
      return s;
    },

    waiting: (state) =>
      finished(state) ? null : { seats: [state.turn], seconds: 40 },

    autoMove: (state, seat) =>
      state.pending?.seat === seat ? { type: 'pass' } : { type: 'draw' },

    eliminate(state, seat, rng = Math.random) {
      if (isOut(state, seat)) return state;
      const s = structuredClone(state);
      dropSeat(s, seat, rng);
      syncUnoFlags(s);
      return s;
    },

    view(state, seat): UnoXView {
      const over = finished(state);
      const myTurn =
        seat !== null && !over && !isOut(state, seat) && state.turn === seat;
      const mine = seat === null ? [] : state.hands[seat];
      const hand = mine.map((c) => faceOf(state, c));
      const playable = myTurn
        ? hand.flatMap((c, i) =>
            state.pending
              ? i === state.pending.index
                ? [i]
                : []
              : canPlay(state, c)
                ? [i]
                : [],
          )
        : [];
      const counts = state.hands.map((h) => h.length);
      const called = state.calledUno;
      const live = seat !== null && !over && !isOut(state, seat);
      return {
        variant: state.variant,
        side: state.side,
        penalty: state.penalty,
        players: state.players,
        counts,
        hand,
        playable,
        stuck:
          myTurn &&
          !state.pending &&
          state.penalty === 0 &&
          playable.length === 0,
        // with a stack waiting, drawing means taking it
        canDraw: myTurn && !state.pending,
        canPass: myTurn && state.pending?.seat === seat,
        challenge: null,
        canChallenge: false,
        top: topFace(state),
        pile: state.discard.slice(-7).map((c) => faceOf(state, c)),
        color: state.color,
        turn: state.turn,
        dir: state.dir,
        drawCount: state.draw.length,
        winner: state.winner,
        places: state.places,
        calledUno: called,
        canCallUno:
          live &&
          seat !== null &&
          !called[seat] &&
          (counts[seat] === 1 || (counts[seat] === 2 && state.turn === seat)),
        catchable:
          seat === null || !live
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
}

export const unoFlipGame = makeGame('flip', 'unoflip');
export const unoNoMercyGame = makeGame('nomercy', 'unomercy');
