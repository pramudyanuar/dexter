import {
  DEFAULT_WEREWOLF,
  MAX_PLAYERS,
  MIN_PLAYERS,
  RoleId,
  roleList,
  ROLES,
  sanitizeWerewolf,
  Team,
  WerewolfConfig,
} from '@/lib/games/werewolf-config';
import type { ChatPolicy, GameCtx, GameDef } from '@/lib/rooms/game';
import { RoomError } from '@/lib/rooms/types';

export * from '@/lib/games/werewolf-config';

/**
 * Werewolf with an automated moderator. Everything that matters happens here,
 * on the server: who holds which role, what each night action does, how votes
 * are counted, and when each phase ends. A client never sees more than the
 * `view` below lets through, and a phase moves on by itself when its time is
 * up (`tick`), without any player's browser deciding anything.
 *
 * A night: the werewolves pick a victim, the Seer looks, the Doctor and the
 * Bodyguard protect, the Serial Killer strikes, and last the Witch (who is told
 * the victim) may heal or poison. Then the morning is announced, the village
 * talks, votes, and the cycle repeats until a team has won.
 */

export type Phase =
  | 'roles'
  | 'night'
  | 'morning'
  | 'discussion'
  | 'voting'
  | 'result'
  | 'hunter'
  | 'over';

export type DeathCause =
  'wolves' | 'poison' | 'serialkiller' | 'guard' | 'vote' | 'hunter' | 'left';

export interface Death {
  seat: number;
  cause: DeathCause;
  day: number;
}

/** Seconds the moderator spends on each announcement. */
export const TIMES = {
  roles: 15,
  morning: 8,
  result: 8,
  hunter: 30,
  witch: 20,
  grace: 5,
};

export interface NightState {
  /** Each werewolf's pick */
  wolf: Record<number, number>;
  /** The Alpha's extra target (once per game) */
  second: number | null;
  seer: number | null;
  doctor: number | null;
  guard: number | null;
  sk: number | null;
  /** Seats that have done their night action (or skipped it) */
  acted: Record<number, boolean>;
  /** The Witch's choice, once she has made it */
  witch: { heal: boolean; poison: number | null; decided: boolean };
  /** The werewolves' final victim, fixed when the first stage ends */
  victim: number | null;
}

export interface NightRecord {
  day: number;
  wolfVotes: Record<number, number>;
  victim: number | null;
  second: number | null;
  seer: { seat: number; target: number; wolf: boolean } | null;
  doctor: number | null;
  guard: number | null;
  sk: number | null;
  heal: boolean;
  poison: number | null;
  saved: number[];
  deaths: Death[];
}

export interface VoteRecord {
  day: number;
  round: number;
  tally: Record<number, number>;
  /** Who voted for whom (hidden from players during an anonymous game) */
  votes: Record<number, number | null>;
  eliminated: number | null;
  tie: boolean;
}

export interface Winner {
  team: 'village' | 'wolves' | 'serialkiller' | 'jester';
  seats: number[];
}

export interface WerewolfState {
  config: WerewolfConfig;
  players: number;
  roles: RoleId[];
  alive: boolean[];
  deaths: Death[];
  day: number;
  phase: Phase;
  stage: 'main' | 'witch';
  deadline: number | null;
  startedAt: number;
  endedAt: number | null;
  night: NightState;
  witchHeal: boolean;
  witchPoison: boolean;
  alphaUsed: boolean;
  lastDoctor: number | null;
  lastGuard: number | null;
  /** What each Seer has learnt */
  seen: { seat: number; day: number; target: number; wolf: boolean }[];
  /** Skip the wait: everyone ready during the role reveal or the discussion */
  ready: boolean[];
  votes: Record<number, number | null>;
  /** After a tie that gets a revote: the only people who can be voted for */
  candidates: number[] | null;
  round: number;
  hunter: { seat: number; next: 'discussion' | 'night' } | null;
  /** Deaths announced this morning */
  morning: Death[];
  lastVote: VoteRecord | null;
  nightLog: NightRecord[];
  voteLog: VoteRecord[];
  winner: Winner | null;
}

const isWolf = (r: RoleId) => !!ROLES[r].wolfTeam;
const teamOf = (r: RoleId): Team => ROLES[r].team;
const seatsOf = (s: WerewolfState) =>
  Array.from({ length: s.players }, (_, i) => i);
const living = (s: WerewolfState) => seatsOf(s).filter((i) => s.alive[i]);
const roleSeat = (s: WerewolfState, role: RoleId) =>
  s.roles.findIndex((r, i) => r === role && s.alive[i]);

const freshNight = (): NightState => ({
  wolf: {},
  second: null,
  seer: null,
  doctor: null,
  guard: null,
  sk: null,
  acted: {},
  witch: { heal: false, poison: null, decided: false },
  victim: null,
});

export function start(
  players: number,
  rng: () => number = Math.random,
  options?: unknown,
): WerewolfState {
  if (players < MIN_PLAYERS) {
    throw new RoomError(`Werewolf needs at least ${MIN_PLAYERS} players`, 409);
  }
  const config = sanitizeWerewolf(options);
  const roles = [...roleList(players, config)];
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }
  const now = Date.now();
  return {
    config,
    players,
    roles,
    alive: Array(players).fill(true),
    deaths: [],
    day: 0,
    phase: 'roles',
    stage: 'main',
    deadline: now + TIMES.roles * 1000,
    startedAt: now,
    endedAt: null,
    night: freshNight(),
    witchHeal: true,
    witchPoison: true,
    alphaUsed: false,
    lastDoctor: null,
    lastGuard: null,
    seen: [],
    ready: Array(players).fill(false),
    votes: {},
    candidates: null,
    round: 1,
    hunter: null,
    morning: [],
    lastVote: null,
    nightLog: [],
    voteLog: [],
    winner: null,
  };
}

// --------------------------------------------------------------- the rules

/** Who has won, if anyone. */
export function checkWinner(s: WerewolfState): Winner | null {
  const alive = living(s);
  const wolves = alive.filter((i) => isWolf(s.roles[i]));
  const killers = alive.filter((i) => s.roles[i] === 'serialkiller');
  const others = alive.length - wolves.length;
  const villageSeats = seatsOf(s).filter(
    (i) => teamOf(s.roles[i]) === 'village',
  );
  const wolfSeats = seatsOf(s).filter((i) => isWolf(s.roles[i]));

  if (wolves.length === 0 && killers.length === 0) {
    return { team: 'village', seats: villageSeats };
  }
  if (wolves.length === 0 && killers.length > 0 && alive.length <= 2) {
    return { team: 'serialkiller', seats: killers };
  }
  if (wolves.length > 0 && wolves.length >= others) {
    return { team: 'wolves', seats: wolfSeats };
  }
  return null;
}

function kill(s: WerewolfState, seat: number, cause: DeathCause): Death | null {
  if (!s.alive[seat]) return null;
  s.alive[seat] = false;
  const d: Death = { seat, cause, day: s.day };
  s.deaths.push(d);
  delete s.votes[seat];
  s.ready[seat] = false;
  return d;
}

/** A dead Hunter gets a last shot (unless they were poisoned, and that is switched off). */
function hunterDue(s: WerewolfState, dead: Death[]): number | null {
  const h = dead.find((d) => s.roles[d.seat] === 'hunter');
  if (!h || h.cause === 'left') return null;
  if (h.cause === 'poison' && !s.config.hunterOnPoison) return null;
  return h.seat;
}

function finish(s: WerewolfState, winner: Winner, now: number) {
  s.winner = winner;
  s.phase = 'over';
  s.deadline = null;
  s.endedAt = now;
}

// -------------------------------------------------------------------- phases

function beginNight(s: WerewolfState, now: number) {
  s.day += 1;
  s.phase = 'night';
  s.stage = 'main';
  s.night = freshNight();
  s.candidates = null;
  s.round = 1;
  s.votes = {};
  s.ready.fill(false);
  s.deadline = now + s.config.nightSeconds * 1000;
}

/** Everyone who must act in the first stage of the night. */
function mainActors(s: WerewolfState): number[] {
  return living(s).filter((i) =>
    [
      'werewolf',
      'alpha',
      'seer',
      'doctor',
      'bodyguard',
      'serialkiller',
    ].includes(s.roles[i]),
  );
}

const mainDone = (s: WerewolfState) =>
  mainActors(s).every((i) =>
    isWolf(s.roles[i]) ? s.night.wolf[i] !== undefined : s.night.acted[i],
  );

/** The pack's victim: the most picked, a coin toss between equals. */
function wolfVictim(s: WerewolfState, rng: () => number): number | null {
  const count = new Map<number, number>();
  for (const [wolf, t] of Object.entries(s.night.wolf)) {
    if (!s.alive[Number(wolf)]) continue;
    count.set(t, (count.get(t) ?? 0) + 1);
  }
  if (!count.size) return null;
  const top = Math.max(...count.values());
  const tied = [...count]
    .filter(([, n]) => n === top)
    .map(([t]) => t)
    .sort((a, b) => a - b);
  return tied[Math.floor(rng() * tied.length)];
}

function endMainStage(s: WerewolfState, now: number, rng: () => number) {
  s.night.victim = wolfVictim(s, rng);
  const witch = roleSeat(s, 'witch');
  const canHeal = s.witchHeal && s.night.victim !== null;
  if (witch !== -1 && (canHeal || s.witchPoison)) {
    s.stage = 'witch';
    s.deadline = now + TIMES.witch * 1000;
    return;
  }
  resolveNight(s, now, rng);
}

function resolveNight(s: WerewolfState, now: number, rng: () => number) {
  const n = s.night;
  const victims: number[] = [];
  if (n.victim !== null) victims.push(n.victim);
  // the Alpha's extra bite, once per game
  const alpha = roleSeat(s, 'alpha');
  if (
    alpha !== -1 &&
    n.second !== null &&
    !s.alphaUsed &&
    n.second !== n.victim
  ) {
    victims.push(n.second);
    s.alphaUsed = true;
  }

  const saved: number[] = [];
  const dead: Death[] = [];
  const guardSeat = roleSeat(s, 'bodyguard');
  for (const t of victims) {
    if (!s.alive[t]) continue;
    if (n.doctor === t) {
      saved.push(t);
    } else if (n.guard === t && guardSeat !== -1) {
      saved.push(t);
      if (s.config.bodyguardDies) {
        const d = kill(s, guardSeat, 'guard');
        if (d) dead.push(d);
      }
    } else if (n.witch.heal && t === n.victim) {
      saved.push(t);
    } else {
      const d = kill(s, t, 'wolves');
      if (d) dead.push(d);
    }
  }
  if (n.witch.poison !== null && s.alive[n.witch.poison]) {
    const d = kill(s, n.witch.poison, 'poison');
    if (d) dead.push(d);
  }
  if (n.sk !== null && s.alive[n.sk]) {
    const d = kill(s, n.sk, 'serialkiller');
    if (d) dead.push(d);
  }

  if (n.witch.heal) s.witchHeal = false;
  if (n.witch.poison !== null) s.witchPoison = false;
  s.lastDoctor = n.doctor;
  s.lastGuard = n.guard;

  const seerSeat = roleSeat(s, 'seer');
  const looked = s.seen.filter((x) => x.day === s.day).pop();
  s.nightLog.push({
    day: s.day,
    wolfVotes: { ...n.wolf },
    victim: n.victim,
    second: alpha !== -1 && s.alphaUsed ? n.second : null,
    seer: looked
      ? { seat: looked.seat, target: looked.target, wolf: looked.wolf }
      : null,
    doctor: n.doctor,
    guard: n.guard,
    sk: n.sk,
    heal: n.witch.heal,
    poison: n.witch.poison,
    saved,
    deaths: dead.map((d) => ({ ...d })),
  });
  void seerSeat;
  void rng;

  s.morning = dead;
  s.phase = 'morning';
  s.deadline = now + TIMES.morning * 1000;
  const shooter = hunterDue(s, dead);
  s.hunter = shooter === null ? null : { seat: shooter, next: 'discussion' };
}

function afterAnnouncement(
  s: WerewolfState,
  now: number,
  next: 'discussion' | 'night',
) {
  if (s.hunter) {
    s.phase = 'hunter';
    s.deadline = now + TIMES.hunter * 1000;
    return;
  }
  const won = checkWinner(s);
  if (won) return finish(s, won, now);
  if (next === 'night') return beginNight(s, now);
  s.phase = 'discussion';
  s.ready.fill(false);
  s.deadline = now + s.config.discussionSeconds * 1000;
}

function beginVoting(s: WerewolfState, now: number) {
  s.phase = 'voting';
  s.votes = {};
  s.deadline = now + s.config.votingSeconds * 1000;
}

function resolveVote(s: WerewolfState, now: number, rng: () => number) {
  const tally: Record<number, number> = {};
  for (const [voter, target] of Object.entries(s.votes)) {
    if (target === null || !s.alive[Number(voter)]) continue;
    const weight = s.roles[Number(voter)] === 'mayor' ? 2 : 1;
    tally[target] = (tally[target] ?? 0) + weight;
  }
  const entries = Object.entries(tally).map(
    ([t, n]) => [Number(t), n] as const,
  );
  const top = entries.length ? Math.max(...entries.map(([, n]) => n)) : 0;
  const leaders = entries.filter(([, n]) => n === top).map(([t]) => t);
  const tie = leaders.length > 1;

  if (tie && s.config.tieRule === 'revote' && s.round === 1) {
    // another vote between the people who tied
    s.voteLog.push({
      day: s.day,
      round: s.round,
      tally,
      votes: { ...s.votes },
      eliminated: null,
      tie: true,
    });
    s.round = 2;
    s.candidates = leaders;
    s.votes = {};
    s.deadline = now + s.config.votingSeconds * 1000;
    return;
  }

  let eliminated: number | null = null;
  if (leaders.length === 1) eliminated = leaders[0];
  else if (tie && s.config.tieRule === 'random') {
    const sorted = [...leaders].sort((a, b) => a - b);
    eliminated = sorted[Math.floor(rng() * sorted.length)];
  }

  const record: VoteRecord = {
    day: s.day,
    round: s.round,
    tally,
    votes: { ...s.votes },
    eliminated,
    tie,
  };
  s.voteLog.push(record);
  s.lastVote = record;
  s.candidates = null;

  const dead: Death[] = [];
  if (eliminated !== null) {
    const d = kill(s, eliminated, 'vote');
    if (d) dead.push(d);
  }
  s.morning = [];
  s.phase = 'result';
  s.deadline = now + TIMES.result * 1000;
  // the Jester wins alone by being voted out
  if (eliminated !== null && s.roles[eliminated] === 'jester') {
    s.hunter = null;
    return finish(s, { team: 'jester', seats: [eliminated] }, now);
  }
  const shooter = hunterDue(s, dead);
  s.hunter = shooter === null ? null : { seat: shooter, next: 'night' };
}

function fireHunter(s: WerewolfState, now: number, target: number | null) {
  const h = s.hunter!;
  if (target !== null && s.alive[target]) {
    const d = kill(s, target, 'hunter');
    if (d) {
      s.morning = [...s.morning, d];
      // a second Hunter-type chain is not a thing: roles are unique
    }
  }
  const next = h.next;
  s.hunter = null;
  const won = checkWinner(s);
  if (won) return finish(s, won, now);
  if (next === 'night') return beginNight(s, now);
  s.phase = 'discussion';
  s.ready.fill(false);
  s.deadline = now + s.config.discussionSeconds * 1000;
}

// ------------------------------------------------------------------- moves

type Move =
  | {
      type: 'night';
      target?: unknown;
      second?: unknown;
      heal?: unknown;
      poison?: unknown;
    }
  | { type: 'vote'; target?: unknown }
  | { type: 'ready' }
  | { type: 'hunter'; target?: unknown };

const seatArg = (s: WerewolfState, v: unknown, what = 'target'): number => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n >= s.players) {
    throw new RoomError(`Pick a ${what}`, 400);
  }
  return n;
};

function nightAction(
  s: WerewolfState,
  seat: number,
  move: Extract<Move, { type: 'night' }>,
) {
  if (s.phase !== 'night') throw new RoomError('It is not night', 409);
  if (!s.alive[seat]) throw new RoomError('The dead cannot act', 403);
  const role = s.roles[seat];
  const n = s.night;

  if (role === 'witch') {
    if (s.stage !== 'witch')
      throw new RoomError('Wait until the werewolves have chosen', 409);
    if (n.witch.decided) throw new RoomError('You have already decided', 409);
    const heal = move.heal === true;
    if (heal && !s.witchHeal)
      throw new RoomError('You used your healing potion', 409);
    if (heal && n.victim === null)
      throw new RoomError('Nobody was attacked', 409);
    let poison: number | null = null;
    if (move.poison !== undefined && move.poison !== null) {
      if (!s.witchPoison) throw new RoomError('You used your poison', 409);
      poison = seatArg(s, move.poison);
      if (!s.alive[poison] || poison === seat)
        throw new RoomError('Pick someone else who is alive', 400);
    }
    n.witch = { heal, poison, decided: true };
    n.acted[seat] = true;
    return;
  }

  if (s.stage !== 'main') throw new RoomError('The night is nearly over', 409);

  if (isWolf(role)) {
    const target = seatArg(s, move.target);
    if (!s.alive[target]) throw new RoomError('Pick someone who is alive', 400);
    if (isWolf(s.roles[target]))
      throw new RoomError('Werewolves do not attack their own', 400);
    n.wolf[seat] = target;
    n.acted[seat] = true;
    if (role === 'alpha' && move.second !== undefined && move.second !== null) {
      if (s.alphaUsed)
        throw new RoomError('You already used your second attack', 409);
      const second = seatArg(s, move.second, 'second target');
      if (!s.alive[second] || isWolf(s.roles[second]) || second === target) {
        throw new RoomError(
          'Pick a different player for the second attack',
          400,
        );
      }
      n.second = second;
    } else if (role === 'alpha') {
      n.second = null;
    }
    return;
  }

  if (!['seer', 'doctor', 'bodyguard', 'serialkiller'].includes(role)) {
    throw new RoomError('You have nothing to do at night', 403);
  }
  if (n.acted[seat]) throw new RoomError('You already acted tonight', 409);

  // the Doctor and Bodyguard may also skip a night
  const skip = move.target === null || move.target === undefined;
  if (skip && (role === 'doctor' || role === 'bodyguard')) {
    n.acted[seat] = true;
    return;
  }
  const target = seatArg(s, move.target);
  if (!s.alive[target]) throw new RoomError('Pick someone who is alive', 400);

  if (role === 'seer') {
    if (target === seat) throw new RoomError('Look at someone else', 400);
    const t = s.roles[target];
    const wolf = isWolf(t) && !(t === 'alpha' && s.config.alphaHidden);
    s.seen.push({ seat, day: s.day, target, wolf });
    n.seer = target;
  } else if (role === 'doctor') {
    if (target === seat && !s.config.doctorSelf)
      throw new RoomError('You cannot protect yourself', 400);
    n.doctor = target;
  } else if (role === 'bodyguard') {
    if (target === seat) throw new RoomError('Guard someone else', 400);
    if (!s.config.bodyguardRepeat && s.lastGuard === target) {
      throw new RoomError(
        'You cannot guard the same person two nights in a row',
        400,
      );
    }
    n.guard = target;
  } else {
    if (target === seat) throw new RoomError('Pick someone else', 400);
    n.sk = target;
  }
  n.acted[seat] = true;
}

export const werewolfGame: GameDef<WerewolfState> = {
  id: 'werewolf',
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
  autoStart: false,
  defaultOptions: DEFAULT_WEREWOLF,
  sanitizeOptions: sanitizeWerewolf,
  capacity: (options) => sanitizeWerewolf(options).maxPlayers,

  start,
  restart: (previous, players, rng) => start(players, rng, previous.config),

  move(state, seat, raw, rng = Math.random, ctx?: GameCtx) {
    const move = raw as Move | null;
    if (!move || typeof move !== 'object')
      throw new RoomError('Invalid move', 400);
    if (state.phase === 'over') throw new RoomError('The game is over', 409);
    const now = ctx?.now ?? Date.now();
    const s = structuredClone(state);

    switch (move.type) {
      case 'night':
        nightAction(s, seat, move);
        break;

      case 'vote': {
        if (s.phase !== 'voting')
          throw new RoomError('It is not time to vote', 409);
        if (!s.alive[seat]) throw new RoomError('The dead cannot vote', 403);
        const had = s.votes[seat] !== undefined;
        if (had && !s.config.voteChange)
          throw new RoomError('Votes cannot be changed', 409);
        if (move.target === null || move.target === undefined) {
          s.votes[seat] = null;
        } else {
          const target = seatArg(s, move.target);
          if (!s.alive[target])
            throw new RoomError('Vote for someone who is alive', 400);
          if (target === seat)
            throw new RoomError('You cannot vote for yourself', 400);
          if (s.candidates && !s.candidates.includes(target)) {
            throw new RoomError('Vote for one of the players who tied', 400);
          }
          s.votes[seat] = target;
        }
        // everyone has voted: a moment to change a mind, then it is decided
        if (living(s).every((i) => s.votes[i] !== undefined)) {
          const sooner = now + (s.config.voteChange ? TIMES.grace * 1000 : 0);
          s.deadline = Math.min(s.deadline ?? sooner, sooner);
        }
        break;
      }

      case 'ready':
        if (s.phase !== 'discussion' && s.phase !== 'roles') {
          throw new RoomError('Nothing to skip right now', 409);
        }
        if (s.phase === 'discussion' && !s.alive[seat])
          throw new RoomError('The dead cannot skip', 403);
        s.ready[seat] = true;
        break;

      case 'hunter': {
        if (s.phase !== 'hunter' || !s.hunter)
          throw new RoomError('Nobody is taking a last shot', 409);
        if (s.hunter.seat !== seat)
          throw new RoomError('This is not your shot', 403);
        const target =
          move.target === null || move.target === undefined
            ? null
            : seatArg(s, move.target);
        if (target !== null && (!s.alive[target] || target === seat)) {
          throw new RoomError('Pick someone else who is alive', 400);
        }
        fireHunter(s, now, target);
        return s;
      }

      default:
        throw new RoomError('Unknown move', 400);
    }

    // a move can complete a phase: let the moderator notice now
    return tickOnce(s, now, rng) ?? s;
  },

  /** The moderator: advance whatever is due. */
  tick(state, now, rng = Math.random) {
    return tickOnce(structuredClone(state), now, rng);
  },

  // someone left: their role is gone (and revealed when roles are revealed)
  eliminate(state, seat) {
    if (!state.alive[seat] || state.phase === 'over') return state;
    const s = structuredClone(state);
    kill(s, seat, 'left');
    delete s.night.wolf[seat];
    const won = checkWinner(s);
    if (won) finish(s, won, Date.now());
    return s;
  },

  chat(state, seat): ChatPolicy {
    if (state.phase === 'over') {
      return { send: 'all', read: ['all', 'wolves', 'dead'] };
    }
    if (seat === null) return { send: null, read: ['all'] };
    if (!state.alive[seat]) {
      return {
        send: state.config.deadChat ? 'dead' : null,
        read: ['all', 'dead'],
      };
    }
    const wolf = isWolf(state.roles[seat]);
    const read = wolf ? ['all', 'wolves'] : ['all'];
    if (state.phase === 'night') {
      return { send: wolf ? 'wolves' : null, read };
    }
    if (state.phase === 'roles') return { send: null, read };
    return { send: 'all', read };
  },

  view: (state, seat): WerewolfView => viewOf(state, seat),

  isOver: (state) => state.phase === 'over',
};

/** Advance the clock one step, if something is due. */
function tickOnce(
  s: WerewolfState,
  now: number,
  rng: () => number,
): WerewolfState | null {
  const due = s.deadline !== null && now >= s.deadline;
  const all = (pred: (i: number) => boolean) => living(s).every(pred);

  switch (s.phase) {
    case 'roles':
      if (due || seatsOf(s).every((i) => s.ready[i])) {
        beginNight(s, now);
        return s;
      }
      return null;
    case 'night':
      if (s.stage === 'main') {
        if (due || mainDone(s)) {
          endMainStage(s, now, rng);
          return s;
        }
        return null;
      }
      if (due || s.night.witch.decided) {
        resolveNight(s, now, rng);
        return s;
      }
      return null;
    case 'morning':
      if (due) {
        afterAnnouncement(s, now, 'discussion');
        return s;
      }
      return null;
    case 'discussion':
      if (due || all((i) => s.ready[i])) {
        beginVoting(s, now);
        return s;
      }
      return null;
    case 'voting':
      if (
        due ||
        (!s.config.voteChange && all((i) => s.votes[i] !== undefined))
      ) {
        resolveVote(s, now, rng);
        return s;
      }
      return null;
    case 'result':
      if (due) {
        afterAnnouncement(s, now, 'night');
        return s;
      }
      return null;
    case 'hunter':
      if (due) {
        fireHunter(s, now, null);
        return s;
      }
      return null;
    default:
      return null;
  }
}

// --------------------------------------------------------------------- views

export interface PublicPlayer {
  seat: number;
  alive: boolean;
  /** Known only once they are out (and roles are revealed), or the game is over */
  role: RoleId | null;
}

export interface WerewolfView {
  config: WerewolfConfig;
  players: number;
  you: number | null;
  phase: Phase;
  stage: 'main' | 'witch';
  day: number;
  secondsLeft: number | null;
  roster: PublicPlayer[];
  /** Your own secret: only ever your own */
  me: {
    role: RoleId;
    team: Team;
    alive: boolean;
    /** Fellow werewolves, or the other Mason */
    allies: number[];
    /** The one you may still act on tonight, and what you can do */
    night: {
      kind: 'kill' | 'look' | 'protect' | 'guard' | 'witch' | 'strike' | null;
      targets: number[];
      acted: boolean;
      choice: number | null;
      /** The Alpha's second target and whether it is still available */
      secondAvailable: boolean;
      second: number | null;
      /** Witch: who the werewolves chose, and what is left */
      victim: number | null;
      heal: boolean;
      poison: boolean;
      /** The pack's picks, for werewolves only */
      packVotes: Record<number, number>;
    } | null;
    /** What the Seer has found out */
    seen: { day: number; target: number; wolf: boolean }[];
  } | null;
  morning: { seat: number; role: RoleId | null }[];
  vote: {
    candidates: number[];
    round: number;
    voted: number;
    total: number;
    mine: number | null | undefined;
    /** Who voted for whom: only when voting is public */
    open: Record<number, number | null> | null;
  } | null;
  lastVote: {
    day: number;
    round: number;
    tally: Record<number, number>;
    votes: Record<number, number | null> | null;
    eliminated: number | null;
    role: RoleId | null;
    tie: boolean;
  } | null;
  hunter: { seat: number; isMe: boolean; targets: number[] } | null;
  ready: boolean[];
  /** The public record: who died when, and the votes */
  history: {
    day: number;
    kind: 'night' | 'vote' | 'hunter';
    seat: number | null;
    role: RoleId | null;
    cause: 'unknown' | DeathCause;
  }[];
  voteHistory: {
    day: number;
    round: number;
    tally: Record<number, number>;
    votes: Record<number, number | null> | null;
    eliminated: number | null;
  }[];
  /** Everything, once the game is over */
  reveal: {
    roles: RoleId[];
    deaths: Death[];
    nights: NightRecord[];
    votes: VoteRecord[];
  } | null;
  winner: Winner | null;
  elapsed: number;
  chat: ChatPolicy;
}

function nightFor(
  s: WerewolfState,
  seat: number,
): NonNullable<WerewolfView['me']>['night'] {
  if (s.phase !== 'night' || !s.alive[seat]) return null;
  const role = s.roles[seat];
  const n = s.night;
  const others = living(s).filter((i) => i !== seat);
  const base = {
    acted: !!n.acted[seat],
    choice: null as number | null,
    secondAvailable: false,
    second: null as number | null,
    victim: null as number | null,
    heal: false,
    poison: false,
    packVotes: {} as Record<number, number>,
  };
  if (isWolf(role)) {
    return {
      ...base,
      kind: 'kill',
      targets: others.filter((i) => !isWolf(s.roles[i])),
      choice: n.wolf[seat] ?? null,
      secondAvailable: role === 'alpha' && !s.alphaUsed,
      second: n.second,
      // the pack sees each other's picks
      packVotes: Object.fromEntries(
        Object.entries(n.wolf).filter(([w]) => isWolf(s.roles[Number(w)])),
      ) as Record<number, number>,
    };
  }
  switch (role) {
    case 'seer':
      return { ...base, kind: 'look', targets: others, choice: n.seer };
    case 'doctor':
      return {
        ...base,
        kind: 'protect',
        targets: s.config.doctorSelf ? living(s) : others,
        choice: n.doctor,
      };
    case 'bodyguard':
      return {
        ...base,
        kind: 'guard',
        targets: others.filter(
          (i) => s.config.bodyguardRepeat || s.lastGuard !== i,
        ),
        choice: n.guard,
      };
    case 'serialkiller':
      return { ...base, kind: 'strike', targets: others, choice: n.sk };
    case 'witch':
      return {
        ...base,
        kind: 'witch',
        targets: s.stage === 'witch' ? others : [],
        // she is told who was attacked only once the pack has chosen
        victim: s.stage === 'witch' ? n.victim : null,
        heal: s.witchHeal,
        poison: s.witchPoison,
        choice: n.witch.poison,
      };
    default:
      return null;
  }
}

function viewOf(s: WerewolfState, seat: number | null): WerewolfView {
  const over = s.phase === 'over';
  const revealed = (i: number): RoleId | null =>
    over || (!s.alive[i] && s.config.revealRoles) ? s.roles[i] : null;
  const role = seat === null ? null : s.roles[seat];
  const publicVotes = !s.config.anonymousVoting;
  const now = Date.now();

  const history: WerewolfView['history'] = s.deaths.map((d) => ({
    day: d.day,
    kind:
      d.cause === 'vote' ? 'vote' : d.cause === 'hunter' ? 'hunter' : 'night',
    seat: d.seat,
    role: revealed(d.seat),
    // how someone died is not public until the end
    cause: over
      ? d.cause
      : d.cause === 'vote' || d.cause === 'hunter'
        ? d.cause
        : 'unknown',
  }));

  let me: WerewolfView['me'] = null;
  if (seat !== null && role !== null) {
    let allies: number[] = [];
    if (isWolf(role))
      allies = seatsOf(s).filter((i) => i !== seat && isWolf(s.roles[i]));
    if (role === 'mason')
      allies = seatsOf(s).filter((i) => i !== seat && s.roles[i] === 'mason');
    me = {
      role,
      team: teamOf(role),
      alive: s.alive[seat],
      allies,
      night: nightFor(s, seat),
      seen:
        role === 'seer'
          ? s.seen
              .filter((x) => x.seat === seat)
              .map(({ day, target, wolf }) => ({ day, target, wolf }))
          : [],
    };
  }

  const voting = s.phase === 'voting';
  const lv = s.lastVote;
  return {
    config: s.config,
    players: s.players,
    you: seat,
    phase: s.phase,
    stage: s.stage,
    day: s.day,
    secondsLeft:
      s.deadline === null
        ? null
        : Math.max(0, Math.ceil((s.deadline - now) / 1000)),
    roster: seatsOf(s).map((i) => ({
      seat: i,
      alive: s.alive[i],
      role: revealed(i),
    })),
    me,
    morning:
      s.phase === 'morning' || s.phase === 'discussion' || s.phase === 'hunter'
        ? s.morning.map((d) => ({ seat: d.seat, role: revealed(d.seat) }))
        : [],
    vote: voting
      ? {
          candidates: s.candidates ?? living(s),
          round: s.round,
          voted: living(s).filter((i) => s.votes[i] !== undefined).length,
          total: living(s).length,
          mine: seat === null ? undefined : s.votes[seat],
          open: publicVotes ? { ...s.votes } : null,
        }
      : null,
    lastVote:
      lv &&
      (s.phase === 'result' ||
        s.phase === 'hunter' ||
        s.phase === 'night' ||
        s.phase === 'over')
        ? {
            day: lv.day,
            round: lv.round,
            tally: lv.tally,
            votes: publicVotes || over ? lv.votes : null,
            eliminated: lv.eliminated,
            role: lv.eliminated === null ? null : revealed(lv.eliminated),
            tie: lv.tie,
          }
        : null,
    hunter: s.hunter
      ? {
          seat: s.hunter.seat,
          isMe: seat === s.hunter.seat,
          targets: seat === s.hunter.seat ? living(s) : [],
        }
      : null,
    ready: s.ready,
    history,
    voteHistory: s.voteLog.map((v) => ({
      day: v.day,
      round: v.round,
      tally: v.tally,
      votes: publicVotes || over ? v.votes : null,
      eliminated: v.eliminated,
    })),
    reveal: over
      ? {
          roles: s.roles,
          deaths: s.deaths,
          nights: s.nightLog,
          votes: s.voteLog,
        }
      : null,
    winner: s.winner,
    elapsed: Math.max(0, Math.floor(((s.endedAt ?? now) - s.startedAt) / 1000)),
    chat: werewolfGame.chat!(s, seat),
  };
}
