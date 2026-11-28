import { seededRandom } from '@/lib/games/seeded-random';

import { type Course, courseAt } from './content';
import {
  assembledCourse,
  BOARD_LIMIT,
  type ItemId,
  itemIds,
  ITEMS,
  type Part,
  partyBase,
  previewPlacement,
  startPositions,
} from './items';
import type { Direction, Point } from './mechanisms';
import {
  type Input,
  type Layout,
  newRun,
  type Player,
  stepRun,
  touchesCoin,
} from './movement';

export type Phase =
  | 'intro'
  | 'draft'
  | 'build'
  | 'countdown'
  | 'race'
  | 'result'
  | 'score'
  | 'victory';
export type Category = 'goal' | 'first' | 'solo' | 'trap' | 'coin' | 'comeback';
type Token = { id: string; item: ItemId };
export const CRATE_OPEN_TICK = 578;

export function isClaimed(picks: Match['picks'], token: string) {
  return picks.some((pick) => pick && pick !== 'pending' && pick.id === token);
}
export type Rules = {
  seats: 2 | 3 | 4;
  rounds: number;
  target: number;
  doubleDraft: boolean;
};
export type Award = { category: Category; points: number; round: number };
export type RunnerResult = {
  finish: number | null;
  killer?: number;
  coins: number;
};
export type Outcome = 'all' | 'none' | 'mixed';
export type Race = {
  tick: number;
  layout: Layout;
  players: Player[];
  active: number[];
  finished: (number | null)[];
  collected: Record<string, number>;
};
export type Match = {
  rules: Rules;
  seed: number;
  round: number;
  box: number;
  phase: Phase;
  serial: number;
  left: number;
  board: Part[];
  course: Course;
  nextPart: number;
  offers: Token[];
  picks: ('pending' | Token | null)[];
  done: boolean[];
  race: Race;
  scores: Award[][];
  streaks: number[];
  awards: Award[][];
  allFailed: number;
  outcome: Outcome;
  winners: number[];
  tieAttempt: number;
};
export type Action =
  | { type: 'claim'; serial: number; seat: number; token: string | null }
  | {
      type: 'place';
      serial: number;
      seat: number;
      position: (Point & { turn: Direction }) | null;
    };

export const SECONDS: Record<Exclude<Phase, 'victory'>, number> = {
  intro: 3,
  draft: 10,
  build: 25,
  countdown: 3,
  race: 45,
  result: 1.5,
  score: 4,
};
export const SCORE = {
  goal: 100,
  first: 20,
  solo: 50,
  trap: 20,
  coin: 30,
  comeback: 40,
} as const;

const seats = (count: number) => Array.from({ length: count }, (_, i) => i);
const timer = (state: Match, phase: Exclude<Phase, 'victory'>): Match => ({
  ...state,
  phase,
  serial: state.serial + 1,
  left: (phase === 'race' && state.tieAttempt ? 60 : SECONDS[phase]) * 60,
});

function resetRace(course: Course, count: number, active = seats(count)): Race {
  return {
    tick: 0,
    layout: courseAt(course, 0),
    active,
    players: startPositions(course, count).map(
      (start) => newRun(course, start).player,
    ),
    finished: seats(count).map(() => null),
    collected: {},
  };
}

export function newMatch(rules: Rules, seed: number): Match {
  const roster = seats(rules.seats);
  return {
    rules,
    seed,
    round: 1,
    box: 1,
    phase: 'intro',
    serial: 0,
    left: SECONDS.intro * 60,
    board: [],
    course: partyBase,
    nextPart: 1,
    offers: [],
    picks: [],
    done: [],
    race: resetRace(partyBase, rules.seats),
    scores: roster.map(() => []),
    streaks: roster.map(() => 0),
    awards: roster.map(() => []),
    allFailed: 0,
    outcome: 'none',
    winners: [],
    tieAttempt: 0,
  };
}

function startDraft(state: Match) {
  const random = seededRandom(
    (state.seed ^
      Math.imul(state.round, 0x9e3779b9) ^
      Math.imul(state.box, 0x85ebca6b)) >>>
      0,
  );
  const count = state.rules.seats + 2;
  const drawn: ItemId[] = [];
  if (
    (state.board.length >= BOARD_LIMIT || state.allFailed >= 2) &&
    state.board.length > 0
  )
    drawn.push('bomb');
  while (drawn.length < count) {
    const candidates = itemIds.filter(
      (id) => !drawn.includes(id) && (id !== 'bomb' || state.board.length > 0),
    );
    const tickets = candidates.flatMap((item) => {
      const group = ITEMS[item].group;
      const weight =
        group === 'path'
          ? state.round === 1
            ? 6
            : state.allFailed >= 2
              ? 5
              : 3
          : group === 'hazard'
            ? 2
            : 1;
      return Array<ItemId>(weight).fill(item);
    });
    drawn.push(tickets[Math.floor(random() * tickets.length)]);
  }
  if (state.round === 1 && !drawn.some((id) => ITEMS[id].group === 'path'))
    drawn[0] = 'plank';
  const offers = drawn.map((item, i) => ({
    id: `${state.round}.${state.box}.${i}`,
    item,
  }));
  return timer(
    { ...state, offers, picks: seats(state.rules.seats).map(() => 'pending') },
    'draft',
  );
}

function startBuild(state: Match) {
  const done = state.picks.map(
    (pick) => typeof pick !== 'object' || pick === null,
  );
  return done.every(Boolean)
    ? afterBuild(state)
    : timer({ ...state, done }, 'build');
}

function afterBuild(state: Match) {
  if (state.rules.seats === 2 && state.rules.doubleDraft && state.box === 1) {
    return startDraft({ ...state, box: 2 });
  }
  return timer(
    { ...state, race: resetRace(state.course, state.rules.seats) },
    'countdown',
  );
}

export function dispatchMatch(state: Match, action: Action): Match {
  const { seat } = action;
  if (
    action.serial !== state.serial ||
    !Number.isInteger(seat) ||
    seat < 0 ||
    seat >= state.rules.seats
  )
    return state;
  if (action.type === 'claim') {
    if (
      state.phase !== 'draft' ||
      state.left > CRATE_OPEN_TICK ||
      state.picks[seat] !== 'pending'
    )
      return state;
    const pick = state.offers.find((token) => token.id === action.token);
    if (action.token !== null && (!pick || isClaimed(state.picks, pick.id)))
      return state;
    const picks = state.picks.map((prev, i) =>
      i === seat ? (pick ?? null) : prev,
    );
    const next = { ...state, picks };
    return picks.includes('pending') ? next : startBuild(next);
  }
  if (state.phase !== 'build' || state.done[seat]) return state;
  const pick = state.picks[seat];
  if (pick === 'pending' || !pick) return state;
  let next = state;
  if (action.position) {
    const preview = previewPlacement(
      state.board,
      pick.item,
      action.position,
      partyBase,
      state.course,
    );
    if (preview.error) return state;
    const board =
      pick.item === 'bomb'
        ? state.board.filter((part) => !preview.targets.includes(part.id))
        : [
            ...state.board,
            {
              ...preview.point,
              id: `part-${state.nextPart}`,
              item: pick.item,
              owner: seat,
              mount: preview.mount,
            },
          ];
    next = {
      ...state,
      board,
      course: assembledCourse(board),
      nextPart: state.nextPart + 1,
    };
  }
  const done = state.done.map((value, i) => value || i === seat);
  next = { ...next, done };
  return done.every(Boolean) ? afterBuild(next) : next;
}

export function scoreRound(
  results: RunnerResult[],
  streaks: number[],
  round: number,
) {
  const finishers = seats(results.length)
    .filter((i) => results[i].finish !== null)
    .sort((a, b) => results[a].finish! - results[b].finish! || a - b);
  const outcome: Outcome =
    finishers.length === results.length
      ? 'all'
      : finishers.length === 0
        ? 'none'
        : 'mixed';
  const awards: Award[][] = results.map(() => []);
  const add = (seat: number, category: Category, count = 1) => {
    awards[seat].push({ category, points: SCORE[category] * count, round });
  };
  if (outcome === 'mixed') {
    for (const i of finishers) {
      add(i, 'goal');
      if (finishers.length === 1) add(i, 'solo');
      else if (i === finishers[0]) add(i, 'first');
      if (results[i].coins) add(i, 'coin', results[i].coins);
      if (streaks[i] >= 2) add(i, 'comeback');
    }
    results.forEach((player, i) => {
      if (
        player.killer !== undefined &&
        player.killer !== i &&
        awards[player.killer]
      )
        add(player.killer, 'trap');
    });
  }
  return {
    awards,
    outcome,
    streaks: results.map((player, i) =>
      player.finish !== null ? 0 : streaks[i] + Number(finishers.length > 0),
    ),
  };
}

const neutral: Input = {
  direction: 0,
  sprint: false,
  jumpPressed: false,
  jumpHeld: false,
};

function stepRace(state: Match, inputs: Input[]) {
  const old = state.race;
  const tick = old.tick + 1;
  const layout = courseAt(state.course, tick, old.layout.bolts);
  const collected = { ...old.collected };
  const finished = [...old.finished];
  const players = old.players.map((player, i) => {
    if (!old.active.includes(i)) return player;
    if (state.tieAttempt && player.pose === 'dead' && player.age >= 75) {
      return newRun(
        state.course,
        startPositions(state.course, state.rules.seats)[i],
      ).player;
    }
    const next = stepRun(
      state.course,
      { tick: old.tick, layout: old.layout, player },
      inputs[i] ?? neutral,
      layout,
    ).player;
    if (player.pose === 'finish' || next.pose === 'dead') return next;
    if (next.pose === 'finish') finished[i] = tick;
    if (!state.tieAttempt) {
      for (const gadget of layout.gadgets) {
        if (
          gadget.kind === 'coin' &&
          collected[gadget.id] === undefined &&
          touchesCoin(player, next, gadget)
        )
          collected[gadget.id] = i;
      }
    }
    return next;
  });
  const race: Race = { ...old, tick, layout, players, collected, finished };
  const next = { ...state, race };
  if (state.tieAttempt) {
    const winner = old.active.find((i) => finished[i] !== null);
    if (winner !== undefined)
      return {
        ...next,
        phase: 'victory',
        serial: state.serial + 1,
        winners: [winner],
        left: 0,
      } as Match;
    if (state.left > 0) return next;
    if (state.tieAttempt < 2) {
      return timer(
        {
          ...next,
          tieAttempt: 2,
          race: resetRace(state.course, state.rules.seats, old.active),
        },
        'countdown',
      );
    }
    return {
      ...next,
      phase: 'victory',
      serial: state.serial + 1,
      winners: old.active,
      left: 0,
    } as Match;
  }
  if (
    state.left > 0 &&
    !players.every((p) => p.pose === 'finish' || p.pose === 'dead')
  )
    return next;
  const scored = scoreRound(
    players.map((p, i) => ({
      finish: finished[i],
      killer: p.killer,
      coins: Object.values(collected).filter((owner) => owner === i).length,
    })),
    state.streaks,
    state.round,
  );
  const scores = state.scores.map((events, i) => [
    ...events,
    ...scored.awards[i],
  ]);
  return timer(
    {
      ...next,
      ...scored,
      scores,
      allFailed: scored.outcome === 'none' ? state.allFailed + 1 : 0,
    },
    'result',
  );
}

export const scoreTotal = (events: Award[]) =>
  events.reduce((sum, award) => sum + award.points, 0);

export function tickParty(state: Match, inputs: Input[] = []): Match {
  if (state.phase === 'victory') return state;
  const next = { ...state, left: state.left - 1 };
  if (next.phase === 'race') return stepRace(next, inputs);
  if (next.left > 0) return next;
  switch (next.phase) {
    case 'intro':
      return startDraft(next);
    case 'draft':
      return startBuild(next);
    case 'build':
      return afterBuild(next);
    case 'countdown':
      return timer(next, 'race');
    case 'result':
      return timer(next, 'score');
    case 'score': {
      const totals = next.scores.map(scoreTotal);
      const max = Math.max(...totals);
      if (next.round < next.rules.rounds && max < next.rules.target)
        return startDraft({ ...next, round: next.round + 1, box: 1 });
      const leaders = seats(next.rules.seats).filter((i) => totals[i] === max);
      if (leaders.length === 1)
        return {
          ...next,
          phase: 'victory',
          serial: state.serial + 1,
          winners: leaders,
          left: 0,
        };
      return timer(
        {
          ...next,
          tieAttempt: 1,
          race: resetRace(next.course, next.rules.seats, leaders),
        },
        'countdown',
      );
    }
  }
  return next;
}
