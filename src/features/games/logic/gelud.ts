import type { GameDef } from '@/features/rooms/game';
import { RoomError } from '@/features/rooms/types';

export const ARENA_W = 800;
export const ARENA_H = 420;
export const GROUND_Y = 355;
export const GRAVITY = 2100;
export const JUMP_VEL = -760;
export const MOVE_SPEED = 310;

export type FighterAction =
  | 'idle'
  | 'walk'
  | 'jump'
  | 'block'
  | 'punch'
  | 'kick'
  | 'special'
  | 'hit'
  | 'ko';

export interface Fighter {
  id: 0 | 1;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  hp: number;
  maxHp: number;
  superMeter: number;
  action: FighterAction;
  actionTimer: number;
  hasHit: boolean;
  roundsWon: number;
}

export interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export interface FighterInput {
  left: boolean;
  right: boolean;
  jump: boolean;
  block: boolean;
  punch: boolean;
  kick: boolean;
  special: boolean;
}

export interface GeludState {
  mode: 'ai' | '2p';
  fighters: [Fighter, Fighter];
  round: number;
  timer: number;
  phase: 'fight' | 'round-over' | 'match-over';
  phaseTimer: number;
  winner: 0 | 1 | null;
  sparks: Spark[];
  shake: number;
  banner: string;
}

export interface GeludEvents {
  hit: boolean;
  blocked: boolean;
  special: boolean;
  ko: boolean;
}

function makeFighter(id: 0 | 1, name: string, roundsWon = 0): Fighter {
  return {
    id,
    name,
    x: id === 0 ? 220 : 580,
    y: GROUND_Y,
    vx: 0,
    vy: 0,
    facing: id === 0 ? 1 : -1,
    hp: 100,
    maxHp: 100,
    superMeter: 0,
    action: 'idle',
    actionTimer: 0,
    hasHit: false,
    roundsWon,
  };
}

export function createGeludState(mode: 'ai' | '2p' = 'ai'): GeludState {
  return {
    mode,
    fighters: [
      makeFighter(0, 'Raka'),
      makeFighter(1, mode === 'ai' ? 'Bot Bima' : 'Bima'),
    ],
    round: 1,
    timer: 60,
    phase: 'fight',
    phaseTimer: 0,
    winner: null,
    sparks: [],
    shake: 0,
    banner: 'RONDE 1 · GELUD!',
  };
}

function nextRoundState(prev: GeludState): GeludState {
  return {
    ...prev,
    fighters: [
      makeFighter(0, prev.fighters[0].name, prev.fighters[0].roundsWon),
      makeFighter(1, prev.fighters[1].name, prev.fighters[1].roundsWon),
    ],
    round: prev.round + 1,
    timer: 60,
    phase: 'fight',
    phaseTimer: 0,
    sparks: [],
    shake: 0,
    banner: `RONDE ${prev.round + 1} · GELUD!`,
  };
}

export function computeAiInput(
  ai: Fighter,
  opp: Fighter,
  clock: number,
): FighterInput {
  const dist = Math.abs(ai.x - opp.x);
  const oppAttacking =
    opp.action === 'punch' || opp.action === 'kick' || opp.action === 'special';

  const block = oppAttacking && dist < 120 && Math.sin(clock * 7) > -0.2;
  const moveToward = dist > 86 && !block;
  const moveAway = dist < 55 && Math.cos(clock * 3) > 0.5;

  const left = (moveToward && opp.x < ai.x) || (moveAway && opp.x > ai.x);
  const right = (moveToward && opp.x > ai.x) || (moveAway && opp.x < ai.x);

  const inRange = dist < 105;
  const special = inRange && ai.superMeter >= 50 && Math.sin(clock * 5) > 0.65;
  const kick = inRange && !special && Math.sin(clock * 9) > 0.55;
  const punch = inRange && !special && !kick && Math.cos(clock * 11) > 0.35;
  const jump = opp.action === 'special' && dist < 160 && ai.y >= GROUND_Y;

  return { left, right, jump, block, punch, kick, special };
}

function attackSpec(action: FighterAction) {
  if (action === 'punch') {
    return {
      dur: 0.24,
      activeStart: 0.17,
      activeEnd: 0.08,
      reach: 78,
      dmg: 8,
      kb: 160,
      meter: 14,
    };
  }
  if (action === 'kick') {
    return {
      dur: 0.34,
      activeStart: 0.24,
      activeEnd: 0.1,
      reach: 96,
      dmg: 13,
      kb: 240,
      meter: 18,
    };
  }
  if (action === 'special') {
    return {
      dur: 0.44,
      activeStart: 0.3,
      activeEnd: 0.1,
      reach: 132,
      dmg: 24,
      kb: 360,
      meter: 0,
    };
  }
  return null;
}

export function stepGelud(
  state: GeludState,
  inputs: [FighterInput, FighterInput],
  dt: number,
  clock = 0,
): { state: GeludState; events: GeludEvents } {
  const events: GeludEvents = {
    hit: false,
    blocked: false,
    special: false,
    ko: false,
  };
  const sparks = state.sparks
    .map((s) => ({
      ...s,
      x: s.x + s.vx * dt,
      y: s.y + s.vy * dt,
      vy: s.vy + 500 * dt,
      life: s.life - dt,
    }))
    .filter((s) => s.life > 0);
  const shake = Math.max(0, state.shake - dt * 28);

  if (state.phase === 'match-over') {
    return { state: { ...state, sparks, shake }, events };
  }

  if (state.phase === 'round-over') {
    const nextTimer = state.phaseTimer - dt;
    if (nextTimer <= 0) {
      return { state: nextRoundState(state), events };
    }
    return {
      state: { ...state, phaseTimer: nextTimer, sparks, shake },
      events,
    };
  }

  const fighters: [Fighter, Fighter] = [
    { ...state.fighters[0] },
    { ...state.fighters[1] },
  ];

  // Update facing when idle/walking
  for (let i = 0; i < 2; i++) {
    const f = fighters[i];
    const opp = fighters[1 - i];
    if (f.action === 'idle' || f.action === 'walk' || f.action === 'block') {
      f.facing = opp.x >= f.x ? 1 : -1;
    }
  }

  // Handle inputs & movement
  for (let i = 0; i < 2; i++) {
    const f = fighters[i];
    const inp = inputs[i];

    if (f.actionTimer > 0) {
      f.actionTimer = Math.max(0, f.actionTimer - dt);
      if (f.actionTimer === 0 && f.action !== 'ko') {
        f.action = f.y < GROUND_Y ? 'jump' : 'idle';
        f.hasHit = false;
      }
    }

    const locked =
      f.action === 'punch' ||
      f.action === 'kick' ||
      f.action === 'special' ||
      f.action === 'hit' ||
      f.action === 'ko';
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);

    if (!locked) {
      f.vx = dir * MOVE_SPEED;
      if (inp.special && f.superMeter >= 50) {
        const spec = attackSpec('special')!;
        f.action = 'special';
        f.actionTimer = spec.dur;
        f.hasHit = false;
        f.superMeter -= 50;
        f.vx = f.facing * 260;
        events.special = true;
      } else if (inp.kick) {
        const spec = attackSpec('kick')!;
        f.action = 'kick';
        f.actionTimer = spec.dur;
        f.hasHit = false;
      } else if (inp.punch) {
        const spec = attackSpec('punch')!;
        f.action = 'punch';
        f.actionTimer = spec.dur;
        f.hasHit = false;
      } else if (inp.block && f.y >= GROUND_Y) {
        f.action = 'block';
        f.vx = 0;
      } else {
        if (inp.jump && f.y >= GROUND_Y) {
          f.vy = JUMP_VEL;
          f.action = 'jump';
        } else if (f.y >= GROUND_Y) {
          f.action = dir !== 0 ? 'walk' : 'idle';
        }
      }
    } else if (f.action === 'punch' || f.action === 'kick') {
      f.vx = dir * MOVE_SPEED;
    } else if (f.action !== 'special') {
      f.vx *= Math.pow(0.05, dt);
    }

    f.x += f.vx * dt;
    f.vy += GRAVITY * dt;
    f.y += f.vy * dt;
    if (f.y >= GROUND_Y) {
      f.y = GROUND_Y;
      f.vy = 0;
      if (f.action === 'jump') f.action = 'idle';
    }
    f.x = Math.max(46, Math.min(ARENA_W - 46, f.x));
  }

  // Prevent body overlap
  const overlap = 48 - Math.abs(fighters[0].x - fighters[1].x);
  if (overlap > 0 && Math.abs(fighters[0].y - fighters[1].y) < 70) {
    const push = overlap / 2;
    if (fighters[0].x <= fighters[1].x) {
      fighters[0].x = Math.max(46, fighters[0].x - push);
      fighters[1].x = Math.min(ARENA_W - 46, fighters[1].x + push);
    } else {
      fighters[0].x = Math.min(ARENA_W - 46, fighters[0].x + push);
      fighters[1].x = Math.max(46, fighters[1].x - push);
    }
  }

  // Hit detection
  let nextShake = shake;
  for (let i = 0; i < 2; i++) {
    const att = fighters[i];
    const def = fighters[1 - i];
    const spec = attackSpec(att.action);
    if (!spec || att.hasHit) continue;
    if (
      att.actionTimer > spec.activeStart ||
      att.actionTimer < spec.activeEnd
    ) {
      continue;
    }

    const dx = (def.x - att.x) * att.facing;
    const dy = Math.abs(def.y - att.y);
    if (dx >= -10 && dx <= spec.reach && dy <= 76) {
      att.hasHit = true;
      const blocked = def.action === 'block' && def.facing !== att.facing;
      const dmg = blocked ? Math.max(2, Math.round(spec.dmg * 0.25)) : spec.dmg;
      def.hp = Math.max(0, def.hp - dmg);
      def.vx = att.facing * (blocked ? spec.kb * 0.45 : spec.kb);
      att.superMeter = Math.min(100, att.superMeter + spec.meter);
      def.superMeter = Math.min(100, def.superMeter + 8);

      if (blocked) {
        events.blocked = true;
      } else {
        events.hit = true;
        def.action = def.hp <= 0 ? 'ko' : 'hit';
        def.actionTimer = def.hp <= 0 ? 1.5 : 0.22;
        nextShake = att.action === 'special' ? 10 : 5;
      }

      const hitX = (att.x + def.x) / 2;
      const hitY = def.y - 54;
      for (let s = 0; s < (blocked ? 4 : 9); s++) {
        const angle = (s / 9) * Math.PI * 2 + clock;
        const spd = 120 + (s % 3) * 70;
        sparks.push({
          x: hitX,
          y: hitY,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd - 60,
          life: 0.26,
          color: blocked
            ? '#60a5fa'
            : att.action === 'special'
              ? '#f43f5e'
              : '#fbbf24',
        });
      }
    }
  }

  // Round timer & KO check
  const nextTimer = Math.max(0, state.timer - dt);
  const p0Down = fighters[0].hp <= 0;
  const p1Down = fighters[1].hp <= 0;

  if (p0Down || p1Down || nextTimer <= 0) {
    events.ko = p0Down || p1Down;
    let roundWinner: 0 | 1 | null = null;
    if (p0Down && !p1Down) roundWinner = 1;
    else if (p1Down && !p0Down) roundWinner = 0;
    else if (fighters[0].hp !== fighters[1].hp) {
      roundWinner = fighters[0].hp > fighters[1].hp ? 0 : 1;
    }

    if (roundWinner !== null) {
      fighters[roundWinner].roundsWon += 1;
    }

    const matchWinner =
      fighters[0].roundsWon >= 2 ? 0 : fighters[1].roundsWon >= 2 ? 1 : null;

    if (matchWinner !== null) {
      return {
        state: {
          ...state,
          fighters,
          timer: nextTimer,
          phase: 'match-over',
          winner: matchWinner,
          sparks,
          shake: nextShake,
          banner: `${fighters[matchWinner].name.toUpperCase()} MENANG!`,
        },
        events,
      };
    }

    return {
      state: {
        ...state,
        fighters,
        timer: nextTimer,
        phase: 'round-over',
        phaseTimer: 2.0,
        sparks,
        shake: nextShake,
        banner:
          roundWinner === null
            ? 'SERI!'
            : `${fighters[roundWinner].name.toUpperCase()} MENANG RONDE ${state.round}!`,
      },
      events,
    };
  }

  const banner = state.timer > 58.2 ? `RONDE ${state.round} · GELUD!` : '';

  return {
    state: {
      ...state,
      fighters,
      timer: nextTimer,
      sparks,
      shake: nextShake,
      banner,
    },
    events,
  };
}

export interface GeludRoomState {
  winner: 0 | 1 | null;
  match?: number;
  reports?: [0 | 1 | null, 0 | 1 | null];
  hostRun?: string;
  hostReloaded?: true;
}

const geludIsOver = (state: GeludRoomState) =>
  state.winner !== null || state.hostReloaded === true;

export const geludGame: GameDef<GeludRoomState> = {
  id: 'gelud',
  minPlayers: 2,
  maxPlayers: 2,
  autoStart: true,
  start: () => ({ winner: null, match: 0 }),
  restart: (previous) => ({ winner: null, match: (previous.match ?? 0) + 1 }),
  move: (state, seat, raw) => {
    if (geludIsOver(state)) return state;
    const report = raw as {
      winner?: unknown;
      match?: unknown;
      hostRun?: unknown;
    } | null;
    if (report?.match !== (state.match ?? 0))
      throw new RoomError('Pertandingan sudah berganti', 409);
    if (report.hostRun !== undefined) {
      if (seat !== 0)
        throw new RoomError('Hanya host yang menjalankan pertandingan', 403);
      if (
        typeof report.hostRun !== 'string' ||
        !/^[a-f0-9]{32}$/.test(report.hostRun)
      )
        throw new RoomError('Sesi host tidak valid', 400);
      if (!state.hostRun) return { ...state, hostRun: report.hostRun };
      if (state.hostRun === report.hostRun) return state;
      return { ...state, hostReloaded: true, reports: undefined };
    }
    const w = report.winner;
    if (w !== 0 && w !== 1)
      throw new RoomError('Hasil pertandingan tidak valid', 400);
    const reports: NonNullable<GeludRoomState['reports']> = [
      state.reports?.[0] ?? null,
      state.reports?.[1] ?? null,
    ];
    reports[seat] = w;
    return {
      ...state,
      reports,
      winner: reports[0] === reports[1] ? w : null,
    };
  },
  eliminate: (state, seat) => ({
    ...state,
    winner: seat === 0 ? 1 : 0,
  }),
  view: (state) => state,
  voice: (state, seat) =>
    !geludIsOver(state)
      ? { peer: 1 - seat, dir: seat === 0 ? 'send' : 'receive' }
      : null,
  isOver: geludIsOver,
};
