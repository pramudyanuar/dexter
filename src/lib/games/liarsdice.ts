import type { GameDef } from '@/lib/rooms/game';
import { RoomError } from '@/lib/rooms/types';

export const START_DICE = 5;

export interface Bid {
  qty: number;
  face: number;
  seat: number;
}

export interface Reveal {
  /** Every player's dice at the moment of the call */
  dice: number[][];
  bid: Bid;
  caller: number;
  /** How many dice matched the bid (ones count as wild) */
  total: number;
  /** Seat that lost a die */
  loser: number;
}

export interface DiceState {
  players: number;
  dice: number[][];
  turn: number;
  bid: Bid | null;
  round: number;
  reveal: Reveal | null;
  winner: number | null;
}

export interface DiceView {
  players: number;
  myDice: number[];
  counts: number[];
  turn: number;
  bid: Bid | null;
  round: number;
  reveal: Reveal | null;
  winner: number | null;
  totalDice: number;
}

const roll = (n: number, rng: () => number) =>
  Array.from({ length: n }, () => 1 + Math.floor(rng() * 6)).sort();

const alive = (s: DiceState, seat: number) => s.dice[seat].length > 0;

const nextAlive = (s: DiceState, from: number) => {
  for (let i = 1; i <= s.players; i++) {
    const seat = (from + i) % s.players;
    if (alive(s, seat)) return seat;
  }
  return from;
};

/** Dice showing `face`, with ones counting as any face (but not for a bid on ones). */
export function countFace(dice: number[][], face: number) {
  return dice.flat().filter((d) => d === face || (face !== 1 && d === 1))
    .length;
}

/** Whether a bid beats the current one. */
export const higher = (bid: Bid | null, qty: number, face: number) =>
  !bid || qty > bid.qty || (qty === bid.qty && face > bid.face);

const fresh = (
  players: number,
  rng: () => number = Math.random,
): DiceState => ({
  players,
  dice: Array.from({ length: players }, () => roll(START_DICE, rng)),
  turn: 0,
  bid: null,
  round: 1,
  reveal: null,
  winner: null,
});

export const diceGame: GameDef<DiceState> = {
  id: 'dice',
  minPlayers: 2,
  maxPlayers: 4,
  autoStart: false,

  start: fresh,
  restart: (_previous, players, rng) => fresh(players, rng),

  move(state, seat, move, rng = Math.random) {
    if (state.turn !== seat) throw new RoomError('Bukan giliranmu', 409);
    const m = move as { type?: string; qty?: unknown; face?: unknown } | null;
    const total = state.dice.flat().length;

    if (m?.type === 'bid') {
      const { qty, face } = m;
      if (
        typeof qty !== 'number' ||
        typeof face !== 'number' ||
        !Number.isInteger(qty) ||
        !Number.isInteger(face) ||
        qty < 1 ||
        qty > total ||
        face < 1 ||
        face > 6
      )
        throw new RoomError('Tawaran tidak valid');
      if (!higher(state.bid, qty, face))
        throw new RoomError('Tawaran harus lebih tinggi dari sebelumnya', 409);
      return {
        ...state,
        bid: { qty, face, seat },
        turn: nextAlive(state, seat),
      };
    }

    if (m?.type === 'call') {
      if (!state.bid)
        throw new RoomError('Belum ada tawaran untuk ditantang', 409);
      const bid = state.bid;
      const counted = countFace(state.dice, bid.face);
      const loser = counted >= bid.qty ? seat : bid.seat;

      const dice = state.dice.map((d) => [...d]);
      dice[loser].pop();
      const reveal: Reveal = {
        dice: state.dice,
        bid,
        caller: seat,
        total: counted,
        loser,
      };

      const left = dice.map((_, i) => i).filter((i) => dice[i].length > 0);
      if (left.length === 1) {
        return { ...state, dice, bid: null, reveal, winner: left[0] };
      }

      // a fresh round: everyone re-rolls, the loser opens (or the next player if out)
      const rolled = dice.map((d) => roll(d.length, rng));
      const opener =
        rolled[loser].length > 0
          ? loser
          : nextAlive({ ...state, dice: rolled }, loser);
      return {
        ...state,
        dice: rolled,
        bid: null,
        turn: opener,
        round: state.round + 1,
        reveal,
      };
    }

    throw new RoomError('Aksi tidak dikenal');
  },

  waiting: (state) =>
    state.winner === null ? { seats: [state.turn], seconds: 45 } : null,

  // the smallest legal raise, or a call when the table cannot hold a bigger bid
  autoMove(state) {
    if (!state.bid) return { type: 'bid', qty: 1, face: 2 };
    const { qty, face } = state.bid;
    const raise =
      face < 6 ? { qty, face: face + 1 } : { qty: qty + 1, face: 1 };
    return raise.qty <= state.dice.flat().length
      ? { type: 'bid', ...raise }
      : { type: 'call' };
  },

  eliminate(state, seat) {
    const dice = state.dice.map((d) => [...d]);
    dice[seat] = [];
    const next = { ...state, dice };
    const left = dice.flatMap((d, i) => (d.length > 0 ? [i] : []));
    if (left.length <= 1) return { ...next, winner: left[0] ?? null };
    return state.turn === seat
      ? { ...next, turn: nextAlive(next, seat) }
      : next;
  },

  view(state, seat): DiceView {
    return {
      players: state.players,
      myDice: seat === null ? [] : state.dice[seat],
      counts: state.dice.map((d) => d.length),
      turn: state.turn,
      bid: state.bid,
      round: state.round,
      // the reveal is public; the live dice are not
      reveal: state.reveal,
      winner: state.winner,
      totalDice: state.dice.flat().length,
    };
  },

  isOver: (state) => state.winner !== null,
};
