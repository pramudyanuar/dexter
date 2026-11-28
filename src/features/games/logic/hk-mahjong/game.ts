import {
  DECISION_LIMITS,
  DECISION_SECONDS,
} from '@/features/games/logic/hk-mahjong/rules';
import {
  type Meld,
  meldTiles,
  type Score,
  scoreHand,
  type ScoringContext,
  TILE_CODES,
  type WinSource,
} from '@/features/games/logic/hk-mahjong/score';
import { shuffled } from '@/features/games/logic/mahjong-tiles';
import type { GameDef } from '@/features/rooms/game';
import { cryptoRng } from '@/features/rooms/rng';
import { RoomError } from '@/features/rooms/types';

export type Play =
  | { type: 'discard' | 'chow' | 'kong' | 'add'; tile: number }
  | { type: 'win' | 'pass' | 'pong' | 'next' };
type Player = {
  hand: number[];
  melds: Meld[];
  flowers: number[];
  river: number[];
};
type Offer = {
  tile: number;
  from: number;
  rob: boolean;
  until: number;
  replies: (Play | null)[];
};
type Result = {
  kind: 'win' | 'draw' | 'left';
  seat: number | null;
  payer: number | null;
  score: Score | null;
  deltas: number[];
};
export interface TableState {
  players: Player[];
  wall: number[];
  wallHead: number;
  dealer: number;
  rotation: number;
  number: number;
  scores: number[];
  turn: number;
  drawn: number | null;
  replacement: boolean;
  discards: number;
  offer: Offer | null;
  result: Result | null;
  ready?: number[];
  revision: number;
  decisionSeconds?: number;
  lastDiscard: { seat: number; tile: number } | null;
}
const seats = [0, 1, 2, 3];
const zeros = () => [0, 0, 0, 0];
const seatDistance = (seat: number, from: number) => (seat - from + 4) % 4;
const sorted = (hand: number[]) => [...hand].sort((a, b) => a - b);
const emptyResult = (
  kind: 'draw' | 'left',
  seat: number | null = null,
): Result => ({ kind, seat, payer: null, score: null, deltas: zeros() });

function replaceBonus(s: TableState, seat: number, tile: number | undefined) {
  const p = s.players[seat];
  while (tile !== undefined && tile >= 34) {
    p.flowers.push(tile);
    tile = s.wall.pop();
  }
  if (tile === undefined) s.result = emptyResult('draw');
  else p.hand.push(tile);
  return tile ?? null;
}

function draw(s: TableState, seat: number, replacement = false) {
  s.turn = seat;
  s.replacement = replacement;
  if (!replacement && s.wall.length) s.wallHead = (s.wallHead + 1) % 144;
  s.drawn = replaceBonus(s, seat, replacement ? s.wall.pop() : s.wall.shift());
}

function deal(
  rng: () => number,
  dealer: number,
  decisionSeconds = DECISION_SECONDS,
  rotation = 0,
  number = 1,
  scores = zeros(),
  revision = 1,
): TableState {
  const roll = () => 1 + Math.floor(rng() * 6);
  const firstRoll = roll() + roll();
  const breakSeat = (dealer + firstRoll - 1) % 4;
  // Walls run clockwise, opposite the seats. The deal takes 53 tiles
  // from the front, while flower replacements come from the far end.
  const cut = (4 - breakSeat) * 36 + (firstRoll + roll() + roll()) * 2;
  const s: TableState = {
    players: seats.map(() => ({ hand: [], flowers: [], river: [], melds: [] })),
    wall: shuffled(
      TILE_CODES.flatMap((_, t) => Array<number>(t < 34 ? 4 : 1).fill(t)),
      rng,
    ),
    dealer,
    wallHead: (cut + 53) % 144,
    rotation,
    number,
    scores,
    turn: dealer,
    drawn: null,
    replacement: false,
    discards: 0,
    offer: null,
    result: null,
    revision,
    decisionSeconds,
    lastDiscard: null,
  };
  const order = seats.map((i) => (i + dealer) % 4);
  for (const batch of [4, 4, 4, 1]) {
    for (const seat of order)
      s.players[seat].hand.push(...s.wall.splice(0, batch));
  }
  s.players[dealer].hand.push(s.wall.shift()!);
  for (const seat of order) {
    const p = s.players[seat];
    const original = p.hand;
    p.hand = [];
    for (const t of original) {
      const actual = replaceBonus(s, seat, t);
      if (seat === dealer) s.drawn = actual;
    }
  }
  return s;
}

function openingHand(
  s: TableState,
  seat: number,
  source: WinSource,
): ScoringContext['opening'] {
  if (s.players.some((p) => p.melds.length)) return;
  if (s.discards === 0 && seat === s.dealer && source === 'draw')
    return 'Langit';
  if (s.discards === 1 && s.offer?.from === s.dealer && source === 'discard')
    return 'Bumi';
  if (seat !== s.dealer && !s.players[seat].river.length && source === 'draw')
    return 'Manusia';
}

function winningScore(s: TableState, seat: number) {
  const p = s.players[seat];
  const tile = s.offer?.tile ?? s.drawn;
  if (tile === null) return null;
  const source: WinSource = s.offer
    ? s.offer.rob
      ? 'rob'
      : 'discard'
    : s.replacement
      ? 'replacement'
      : 'draw';
  return scoreHand(s.offer ? [...p.hand, tile] : p.hand, p.melds, {
    wind: seatDistance(seat, s.dealer),
    flowers: p.flowers,
    source,
    winningTile: tile,
    last: s.wall.length === 0,
    opening: openingHand(s, seat, source),
  });
}

function settle(s: TableState, seat: number) {
  const score = winningScore(s, seat)!;
  const payer = s.offer?.from ?? null;
  if (s.offer) {
    s.players[seat].hand.push(s.offer.tile);
    if (!s.offer.rob) s.players[s.offer.from].river.pop();
  }
  const deltas = seats.map((i) =>
    i === seat ? 0 : payer === null || payer === i ? -score.units : 0,
  );
  deltas[seat] = -deltas.reduce((a, b) => a + b, 0);
  s.scores = s.scores.map((v, i) => v + deltas[i]);
  s.result = { kind: 'win', seat, payer, score, deltas };
  s.offer = null;
}
function finished(s: TableState) {
  return (
    s.result?.kind === 'left' ||
    (s.rotation === 3 && s.result?.kind === 'win' && s.result.seat !== s.dealer)
  );
}

function voteToContinue(state: TableState, seat: number) {
  const ready = state.ready ?? [];
  const next = ready.includes(seat)
    ? state
    : { ...state, ready: [...ready, seat] };
  return {
    state: next,
    unanimous: seats.every((seat) => next.ready?.includes(seat)),
  };
}

function options(s: TableState, seat: number): Play[] {
  if (s.result)
    return finished(s) || s.ready?.includes(seat) ? [] : [{ type: 'next' }];
  const p = s.players[seat];
  const moves: Play[] = [];
  if (s.offer) {
    const { from, tile, rob, replies } = s.offer;
    if (seat === from || replies[seat]) return [];
    if (winningScore(s, seat)) moves.push({ type: 'win' });
    if (!rob && s.wall.length) {
      const copies = p.hand.filter((t) => t === tile).length;
      if (copies >= 2) moves.push({ type: 'pong' });
      if (copies === 3) moves.push({ type: 'kong', tile });
      if (seatDistance(seat, from) === 1 && tile < 27) {
        for (let start = tile - 2; start <= tile; start++) {
          if (
            start < 0 ||
            Math.floor(start / 9) !== Math.floor(tile / 9) ||
            start % 9 > 6
          )
            continue;
          if (
            [start, start + 1, start + 2].every(
              (t) => t === tile || p.hand.includes(t),
            )
          )
            moves.push({ type: 'chow', tile: start });
        }
      }
    }
    if (moves.length) moves.push({ type: 'pass' });
  } else if (seat === s.turn) {
    if (winningScore(s, seat)) moves.push({ type: 'win' });
    for (const t of new Set(p.hand)) {
      moves.push({ type: 'discard', tile: t });
      if (s.drawn === null || !s.wall.length) continue;
      if (p.hand.filter((k) => k === t).length === 4)
        moves.push({ type: 'kong', tile: t });
      if (p.melds.some((m) => m.kind === 'pong' && m.tile === t))
        moves.push({ type: 'add', tile: t });
    }
  }
  return moves;
}

const priority = (move: Play | null) =>
  move?.type === 'win'
    ? 3
    : move?.type === 'kong' || move?.type === 'pong'
      ? 2
      : move?.type === 'chow'
        ? 1
        : 0;
function resolveOffer(s: TableState) {
  const offer = s.offer!;
  const order = [1, 2, 3].map((offset) => (offer.from + offset) % 4);
  // Only the priority and distance to the discarder matter, never arrival order.
  const winner = order.reduce(
    (best, i) =>
      priority(offer.replies[i]) > priority(offer.replies[best]) ? i : best,
    order[0],
  );
  const claim = offer.replies[winner];
  if (claim?.type === 'win') {
    settle(s, winner);
    return;
  }
  s.offer = null;
  if (offer.rob) {
    s.players[offer.from].melds.find(
      (m) => m.kind === 'pong' && m.tile === offer.tile,
    )!.kind = 'kong';
    draw(s, offer.from, true);
  } else if (
    claim &&
    (claim.type === 'chow' || claim.type === 'pong' || claim.type === 'kong')
  ) {
    const p = s.players[winner];
    const meld: Meld = {
      kind: claim.type,
      tile: claim.type === 'chow' ? claim.tile : offer.tile,
    };
    const taken = meldTiles(meld);
    taken.splice(taken.indexOf(offer.tile), 1);
    for (const t of taken) p.hand.splice(p.hand.indexOf(t), 1);
    p.melds.push(meld);
    s.players[offer.from].river.pop();
    s.lastDiscard = null;
    s.turn = winner;
    s.drawn = null;
    s.replacement = false;
    if (claim.type === 'kong') draw(s, winner, true);
  } else draw(s, order[0]);
}
function openOffer(s: TableState, tile: number, rob: boolean, now: number) {
  s.drawn = null;
  s.offer = {
    tile,
    from: s.turn,
    rob,
    until: now + (s.decisionSeconds ?? DECISION_SECONDS) * 1000,
    replies: [null, null, null, null],
  };
  if (!seats.some((i) => options(s, i).length)) resolveOffer(s);
}

function move(
  state: TableState,
  seat: number,
  raw: unknown,
  rng = cryptoRng(),
  now = Date.now(),
) {
  const input = raw as (Play & { revision: number }) | null;
  const action =
    input &&
    input.revision === state.revision &&
    options(state, seat).find(
      (m) =>
        m.type === input.type &&
        (!('tile' in m) || ('tile' in input && m.tile === input.tile)),
    );
  if (!action)
    throw new RoomError('Aksi tidak tersedia pada giliran ini.', 409);
  if (action.type === 'next') {
    const vote = voteToContinue(state, seat);
    if (!vote.unanimous) return vote.state;
    const rotate =
      state.result?.kind === 'win' && state.result.seat !== state.dealer
        ? 1
        : 0;
    return deal(
      rng,
      (state.dealer + rotate) % 4,
      state.decisionSeconds,
      state.rotation + rotate,
      state.number + 1,
      state.scores,
      state.revision + 1,
    );
  }
  const s = structuredClone(state);
  const p = s.players[seat];
  if (s.offer) {
    s.offer.replies[seat] = action;
    if (seats.some((i) => options(s, i).length)) return s;
    resolveOffer(s);
  } else if (action.type === 'win') settle(s, seat);
  else if (action.type === 'discard' || action.type === 'add') {
    p.hand.splice(p.hand.indexOf(action.tile), 1);
    if (action.type === 'discard') {
      p.river.push(action.tile);
      s.discards++;
      s.lastDiscard = { seat, tile: action.tile };
    }
    openOffer(s, action.tile, action.type === 'add', now);
  } else if (action.type === 'kong') {
    p.hand = p.hand.filter((t) => t !== action.tile);
    p.melds.push({ kind: 'kong', tile: action.tile, concealed: true });
    draw(s, seat, true);
  }
  s.revision++;
  return s;
}

export function tableView(s: TableState, seat: number | null) {
  return {
    dealer: s.dealer,
    rotation: s.rotation,
    number: s.number,
    turn: s.turn,
    wall: s.wall.length,
    wallHead: s.wallHead,
    scores: s.scores,
    lastDiscard: s.result ? null : s.lastDiscard,
    revision: s.revision,
    decisionSeconds: s.decisionSeconds ?? DECISION_SECONDS,
    result: s.result,
    ready: s.result ? (s.ready ?? []) : [],
    finished: finished(s),
    drawn: seat === s.turn && !s.result ? s.drawn : null,
    offer: s.offer && {
      tile: s.offer.tile,
      from: s.offer.from,
      rob: s.offer.rob,
      until: s.offer.until,
    },
    actions: seat === null ? [] : options(s, seat),
    hand: seat === null ? [] : sorted(s.players[seat].hand),
    players: s.players.map((p) => ({
      melds: p.melds,
      flowers: p.flowers,
      river: p.river,
      count: p.hand.length,
      revealed: s.result ? sorted(p.hand) : null,
    })),
  };
}
export type TableView = ReturnType<typeof tableView>;

function newMatch(players: number, rng = cryptoRng(), options?: unknown) {
  if (players !== 4)
    throw new RoomError('Meja Mahjong membutuhkan empat pemain.');
  const seconds = (options as { decisionSeconds?: unknown } | null)
    ?.decisionSeconds;
  const decisionSeconds =
    typeof seconds === 'number' && Number.isFinite(seconds)
      ? Math.min(
          DECISION_LIMITS.max,
          Math.max(DECISION_LIMITS.min, Math.round(seconds)),
        )
      : DECISION_SECONDS;
  return deal(rng, Math.floor(rng() * 4), decisionSeconds);
}

export const hkMahjongGame: GameDef<TableState> = {
  id: 'mahjong-hk',
  minPlayers: 4,
  maxPlayers: 4,
  autoStart: true,
  start: newMatch,
  restart: (s, n, rng, options) => ({
    ...newMatch(n, rng, options),
    revision: s.revision + 1,
  }),
  move: (s, seat, input, rng, ctx) => move(s, seat, input, rng, ctx?.now),
  view: tableView,
  isOver: finished,
  rematchVote: voteToContinue,
  fixedTurnClock: true,
  waiting: (s) =>
    s.offer || s.result
      ? null
      : { seats: [s.turn], seconds: s.decisionSeconds ?? DECISION_SECONDS },
  autoMove: (s, seat) =>
    seat === s.turn && !s.offer && !s.result
      ? {
          type: 'discard',
          tile: s.drawn ?? s.players[seat].hand[0],
          revision: s.revision,
        }
      : null,
  tick: (state, now) => {
    if (!state.offer || state.offer.until > now) return null;
    const s = structuredClone(state);
    resolveOffer(s);
    s.revision++;
    return s;
  },
  eliminate: (s, seat) => ({
    ...s,
    offer: null,
    result: emptyResult('left', seat),
    ready: [],
    revision: s.revision + 1,
  }),
};
