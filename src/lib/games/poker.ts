import { makeDeck, parse, shuffle } from '@/lib/games/remo-cards';
import type { GameDef } from '@/lib/rooms/game';
import { RoomError } from '@/lib/rooms/types';

const STREETS = ['pre-flop', 'flop', 'turn', 'river'] as const;
const STARTING_CHIPS = 100;
const MAX_BETS = 4;
const BIG_BLIND = 2;

export const POKER_HANDS = [
  'High card',
  'One pair',
  'Two pair',
  'Three of a kind',
  'Straight',
  'Flush',
  'Full house',
  'Four of a kind',
  'Straight flush',
] as const;

// All scores are ordered by category and then by the relevant ranks.
function rankFive(cards: string[]) {
  const parsed = cards.map(parse);
  const ranks = parsed
    .map(({ rank }) => (rank === 1 ? 14 : rank))
    .sort((a, b) => b - a);
  const counts = new Map<number, number>();
  for (const rank of ranks) counts.set(rank, (counts.get(rank) ?? 0) + 1);
  const groups = [...counts].sort(([a, ac], [b, bc]) => bc - ac || b - a);
  const [, multiples] = groups[0];
  const flush = parsed.every(({ suit }) => suit === parsed[0].suit);
  const wheel = ranks.join(',') === '14,5,4,3,2';
  const straight = counts.size === 5 && (wheel || ranks[0] - ranks[4] === 4);

  if (straight && flush) return [8, wheel ? 5 : ranks[0]];
  if (multiples === 4) return [7, groups[0][0], groups[1][0]];
  if (multiples === 3 && groups[1][1] === 2)
    return [6, groups[0][0], groups[1][0]];
  if (flush) return [5, ...ranks];
  if (straight) return [4, wheel ? 5 : ranks[0]];
  const category =
    multiples === 3 ? 3 : multiples === 2 ? (groups[1][1] === 2 ? 2 : 1) : 0;
  return [category, ...groups.map(([rank]) => rank)];
}

function compare(a: number[], b: number[]) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const difference = (a[i] ?? 0) - (b[i] ?? 0);
    if (difference) return difference;
  }
  return 0;
}

export function bestPokerHand(cards: string[]) {
  let best: number[] = [];
  // Hold’em supplies seven cards. Try each choice of five.
  for (let a = 0; a < cards.length - 4; a++) {
    for (let b = a + 1; b < cards.length - 3; b++) {
      for (let c = b + 1; c < cards.length - 2; c++) {
        for (let d = c + 1; d < cards.length - 1; d++) {
          for (let e = d + 1; e < cards.length; e++) {
            const score = rankFive([
              cards[a],
              cards[b],
              cards[c],
              cards[d],
              cards[e],
            ]);
            if (compare(score, best) > 0 || best.length === 0) best = score;
          }
        }
      }
    }
  }
  return best;
}

type PokerAction = 'check' | 'call' | 'raise' | 'fold';
type PokerStreet = (typeof STREETS)[number];
type Player = { cards: string[]; chips: number; bet: number; folded: boolean };

interface PokerState {
  players: Player[];
  deck: string[];
  board: string[];
  button: number;
  hand: number;
  turnNumber: number;
  street: PokerStreet;
  turn: number | null;
  pending: number[];
  betCount: number;
  pot: number;
  result: {
    winners: { seat: number; chips: number }[];
    category: number | null;
  } | null;
}

export interface PokerView {
  players: Player[];
  board: string[];
  button: number;
  hand: number;
  turnNumber: number;
  street: PokerStreet;
  turn: number | null;
  pot: number;
  toCall: number;
  raiseCost: number;
  actions: PokerAction[];
  result: PokerState['result'];
}

const highestBet = (state: PokerState) =>
  Math.max(...state.players.map(({ bet }) => bet));
const betSize = (state: PokerState) =>
  state.street === 'turn' || state.street === 'river'
    ? BIG_BLIND * 2
    : BIG_BLIND;
const liveSeats = (state: PokerState) =>
  state.players.flatMap(({ folded }, seat) => (folded ? [] : [seat]));

function clockwise(state: PokerState, from: number, seats: number[]) {
  const n = state.players.length;
  return [...seats].sort(
    (a, b) => ((a - from + n - 1) % n) - ((b - from + n - 1) % n),
  );
}

function start(
  players: number,
  rng: () => number,
  button: number,
  hand: number,
): PokerState {
  const deck = shuffle(makeDeck(), rng);
  const small = players === 2 ? button : (button + 1) % players;
  const big = (small + 1) % players;
  const table = Array.from({ length: players }, (_, seat) => {
    const bet = seat === small ? 1 : seat === big ? BIG_BLIND : 0;
    return {
      cards: [deck.pop()!, deck.pop()!],
      chips: STARTING_CHIPS - bet,
      bet,
      folded: false,
    };
  });
  return {
    players: table,
    deck,
    board: [],
    button,
    hand,
    turnNumber: 0,
    street: 'pre-flop',
    turn: (big + 1) % players,
    pending: table.map((_, seat) => seat),
    betCount: 1,
    pot: 1 + BIG_BLIND,
    result: null,
  };
}

function actionsFor(state: PokerState, seat: number): PokerAction[] {
  if (state.turn !== seat) return [];
  return [
    state.players[seat].bet === highestBet(state) ? 'check' : 'call',
    ...(state.betCount < MAX_BETS ? ['raise' as const] : []),
    'fold',
  ];
}

function finish(state: PokerState, live: number[]): PokerState {
  let best: number[] = [];
  let winners: number[] = [];
  for (const seat of live) {
    const score =
      live.length === 1
        ? []
        : bestPokerHand([...state.board, ...state.players[seat].cards]);
    const value = compare(score, best);
    if (value > 0) {
      best = score;
      winners = [seat];
    } else if (value === 0) {
      winners.push(seat);
    }
  }
  const winner = live[0];
  const otherBets = state.players
    .filter((_, seat) => seat !== winner)
    .map(({ bet }) => bet);
  const refund =
    live.length === 1
      ? Math.max(0, state.players[winner].bet - Math.max(...otherBets))
      : 0;
  const pot = state.pot - refund;
  const share = Math.floor(pot / winners.length);
  const odd = pot % winners.length;
  const payouts = clockwise(state, state.button, winners).map((seat, i) => ({
    seat,
    chips: share + Number(i < odd),
  }));
  const players = state.players.map((player, seat) => ({
    ...player,
    chips:
      player.chips +
      (payouts.find((w) => w.seat === seat)?.chips ?? 0) +
      (seat === winner ? refund : 0),
  }));
  return {
    ...state,
    players,
    pot,
    turn: null,
    pending: [],
    result: { winners: payouts, category: best[0] ?? null },
  };
}

function advance(previous: PokerState, after: number): PokerState {
  const state = { ...previous, turnNumber: previous.turnNumber + 1 };
  const live = liveSeats(state);
  if (live.length === 1) return finish(state, live);
  const pending = state.pending.filter((seat) => live.includes(seat));
  if (pending.length)
    return { ...state, pending, turn: clockwise(state, after, pending)[0] };
  if (state.street === 'river') return finish(state, live);

  const street = STREETS[STREETS.indexOf(state.street) + 1];
  const deck = [...state.deck];
  deck.pop(); // burn before each community deal
  const cards = deck.splice(-(street === 'flop' ? 3 : 1));
  return {
    ...state,
    deck,
    board: [...state.board, ...cards],
    street,
    players: state.players.map((p) => ({ ...p, bet: 0 })),
    pending: live,
    turn: clockwise(state, state.button, live)[0],
    betCount: 0,
  };
}

function fold(state: PokerState, seat: number) {
  if (
    state.turn === null ||
    state.players[seat]?.folded ||
    !state.players[seat]
  )
    return state;
  const players = state.players.map((p, s) =>
    s === seat ? { ...p, folded: true } : p,
  );
  const pending = state.pending.filter((s) => s !== seat);
  const after =
    seat === state.turn
      ? seat
      : (state.turn + players.length - 1) % players.length;
  return advance({ ...state, players, pending }, after);
}

export const pokerGame: GameDef<PokerState> = {
  id: 'poker',
  minPlayers: 2,
  maxPlayers: 6,
  autoStart: false,
  start: (players, rng = Math.random) => start(players, rng, 0, 1),
  restart: (previous, players, rng = Math.random) =>
    start(players, rng, (previous.button + 1) % players, previous.hand + 1),
  move(state, seat, move) {
    const m = move as {
      type?: PokerAction;
      hand?: number;
      turnNumber?: number;
    } | null;
    if (state.turn !== seat) throw new RoomError('Bukan giliranmu', 409);
    if (m?.hand !== state.hand || m.turnNumber !== state.turnNumber)
      throw new RoomError('Giliran poker sudah berubah', 409);
    if (!m.type || !actionsFor(state, seat).includes(m.type))
      throw new RoomError('Aksi poker tidak tersedia', 409);
    if (m.type === 'fold') return fold(state, seat);

    const raising = m.type === 'raise';
    const target = highestBet(state) + (raising ? betSize(state) : 0);
    const cost = target - state.players[seat].bet;
    const players = state.players.map((p, s) =>
      s === seat ? { ...p, chips: p.chips - cost, bet: target } : p,
    );
    const pending = (raising ? liveSeats(state) : state.pending).filter(
      (s) => s !== seat,
    );
    return advance(
      {
        ...state,
        players,
        pending,
        pot: state.pot + cost,
        betCount: state.betCount + Number(raising),
      },
      seat,
    );
  },
  waiting: (state) =>
    state.turn === null ? null : { seats: [state.turn], seconds: 35 },
  autoMove: (state, seat) => ({
    type: actionsFor(state, seat).includes('check') ? 'check' : 'fold',
    hand: state.hand,
    turnNumber: state.turnNumber,
  }),
  eliminate: fold,
  isOver: (state) => state.result !== null,
  view(state, seat): PokerView {
    const showdown = state.result?.category != null;
    const canAct = seat !== null && state.turn === seat;
    const toCall = canAct ? highestBet(state) - state.players[seat].bet : 0;
    return {
      players: state.players.map((p, i) => ({
        ...p,
        cards: i === seat || (showdown && !p.folded) ? p.cards : [],
      })),
      board: state.board,
      button: state.button,
      hand: state.hand,
      turnNumber: state.turnNumber,
      street: state.street,
      turn: state.turn,
      pot: state.pot,
      toCall,
      raiseCost: toCall + betSize(state),
      actions: seat === null ? [] : actionsFor(state, seat),
      result: state.result,
    };
  },
};
