import {
  CAMPAIGN,
  DEFAULT_MONKEYS,
  Gesture,
  isGesture,
  MODULE_KINDS,
  ModuleKind,
  MonkeyConfig,
  Role,
  ROLES,
  sanitizeMonkeys,
  Spec,
  specFor,
} from '@/lib/games/monkeys-config';
import type { GameDef } from '@/lib/rooms/game';
import { cryptoRng } from '@/lib/rooms/rng';
import { RoomError } from '@/lib/rooms/types';

export * from '@/lib/games/monkeys-config';

/**
 * Three Monkeys: Bomb Defusal. Three players, three roles, one bomb.
 *
 * - The Blind Monkey is the only one who can touch the bomb, and sees only a
 *   grey outline of it.
 * - The Mute Monkey is the only one who can read the manual, and can only make
 *   gestures.
 * - The Deaf Monkey sees the bomb in colour and the gestures, and talks to the
 *   Blind Monkey (voice goes over WebRTC, see `voice`).
 *
 * The server owns everything: the clock, the puzzles and their answers, the
 * mistakes, and who wins. `view` is the only way anything leaves, and each role
 * gets only its own slice of it.
 */

export const WIRE_COLORS = [
  'red',
  'blue',
  'yellow',
  'green',
  'white',
  'purple',
];
export const PAD_COLORS = ['red', 'blue', 'yellow', 'green'];
export const DIRS = ['up', 'right', 'down', 'left'] as const;
export type Dir = (typeof DIRS)[number];

/** Seconds in which a gesture can be repeated at the earliest (ms) */
export const GESTURE_GAP_MS = 350;
/** Gestures kept on screen */
export const GESTURE_KEEP = 8;

type Plan<T> = [lit: T, dark: T];

interface Base {
  id: number;
  solved: boolean;
  /** Whether the answer depends on the lamp (lit/dark) */
  variant: boolean;
  lamp: boolean;
}
export interface WiresMod extends Base {
  kind: 'wires';
  colors: string[];
  plan: Plan<Gesture[]>;
  cut: boolean[];
  step: number;
}
export interface KeypadMod extends Base {
  kind: 'keypad';
  /** What each of the three buttons shows (1..3), left to right */
  labels: number[];
  plan: Plan<Gesture[]>;
  step: number;
}
export interface KnobsMod extends Base {
  kind: 'knobs';
  dirs: Dir[];
  plan: Plan<Dir[]>;
}
export interface MathMod extends Base {
  kind: 'math';
  a: number;
  b: number;
  op: '+' | '-' | '×';
  /** The Mute Monkey's manual adds this to the answer */
  offset: number;
  entry: string;
}
export interface FlashMod extends Base {
  kind: 'flash';
  colors: string[];
  seq: number[];
  plan: Plan<Gesture>;
  step: number;
}
export type Mod = WiresMod | KeypadMod | KnobsMod | MathMod | FlashMod;

export type Phase = 'briefing' | 'playing' | 'won' | 'exploded' | 'abandoned';
export type Cause = 'time' | 'mistakes' | 'left';

export interface Sign {
  seq: number;
  g: Gesture;
  at: number;
}
export interface Event {
  seq: number;
  kind: 'ok' | 'bad' | 'solved' | 'next';
  module: number;
}

export interface MonkeyState {
  config: MonkeyConfig;
  spec: Spec;
  /** Role by seat */
  roles: Role[];
  phase: Phase;
  ready: boolean[];
  /** Which bomb of the run this is (0 for the first) */
  bomb: number;
  /** Bombs defused so far in this run */
  defused: number;
  modules: Mod[];
  mistakes: number;
  /** When the bomb goes off (ms); 0 until the clock starts */
  endsAt: number;
  /** While someone is away the clock stands still from this moment */
  pausedAt: number | null;
  signs: Sign[];
  signSeq: number;
  event: Event | null;
  cause: Cause | null;
  /** Seconds left when the last bomb was defused */
  finishedWith: number;
}

// ---------------------------------------------------------------- helpers

const rand = (rng: () => number, n: number) => Math.floor(rng() * n);
const pick = <T>(rng: () => number, items: readonly T[]): T =>
  items[rand(rng, items.length)];

function shuffled<T>(rng: () => number, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(rng, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const NUMBER_GESTURES: Gesture[] = ['one', 'two', 'three'];

/** The wire a gesture points at: fingers count from the top, "down" is the last. */
export const wireAt = (g: Gesture, count: number) =>
  g === 'one' ? 0 : g === 'two' ? 1 : g === 'three' ? 2 : count - 1;

/** How a flash is answered: the same pad, the next one clockwise, anticlockwise, or across. */
export const SHIFT: Partial<Record<Gesture, number>> = {
  circle: 0,
  right: 1,
  left: 3,
  down: 2,
};

/** The answer a module expects given its lamp */
const planOf = <T>(m: { plan: Plan<T>; lamp: boolean; variant: boolean }): T =>
  m.variant && !m.lamp ? m.plan[1] : m.plan[0];

// ---------------------------------------------------------------- modules

function twoPlans<T>(
  make: () => T,
  variant: boolean,
  same: (a: T, b: T) => boolean,
): Plan<T> {
  const lit = make();
  if (!variant) return [lit, lit];
  let dark = make();
  for (let i = 0; i < 12 && same(lit, dark); i++) dark = make();
  return [lit, dark];
}

const sameList = (a: unknown[], b: unknown[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

function makeModule(
  id: number,
  kind: ModuleKind,
  difficulty: number,
  rng: () => number,
): Mod {
  const variant = difficulty >= 2 && rng() < (difficulty === 2 ? 0.5 : 0.8);
  const base = { id, solved: false, variant, lamp: rng() < 0.5 };

  switch (kind) {
    case 'wires': {
      const count = 4 + (difficulty - 1) + rand(rng, 2); // 4..7
      const n = Math.min(6, count);
      const targets: Gesture[] = ['one', 'two', 'three', 'down'];
      const steps = difficulty + 1; // 2..4
      return {
        ...base,
        kind,
        colors: shuffled(rng, WIRE_COLORS).slice(0, n),
        plan: twoPlans(
          () => shuffled(rng, targets).slice(0, steps),
          variant,
          sameList,
        ),
        cut: Array<boolean>(n).fill(false),
        step: 0,
      };
    }
    case 'keypad': {
      const length = 2 + difficulty; // 3..5
      return {
        ...base,
        kind,
        labels: shuffled(rng, [1, 2, 3]),
        plan: twoPlans(
          () => Array.from({ length }, () => pick(rng, NUMBER_GESTURES)),
          variant,
          sameList,
        ),
        step: 0,
      };
    }
    case 'knobs': {
      const count = 1 + difficulty; // 2..4
      const make = () => Array.from({ length: count }, () => pick(rng, DIRS));
      const plan = twoPlans<Dir[]>(make, variant, sameList);
      // start every knob facing somewhere it should not end up
      const dirs = plan[0].map((d, i) => {
        const bad = DIRS.filter((x) => x !== d && x !== plan[1][i]);
        return pick(rng, bad.length ? bad : DIRS.filter((x) => x !== d));
      });
      return { ...base, kind, dirs, plan };
    }
    case 'math': {
      const op =
        difficulty === 1 ? '+' : (pick(rng, ['+', '-', '×']) as MathMod['op']);
      const top = difficulty === 1 ? 9 : difficulty === 2 ? 12 : 15;
      let a = 1 + rand(rng, top);
      let b = 1 + rand(rng, op === '×' ? 9 : top);
      if (op === '-' && b > a) [a, b] = [b, a];
      return {
        ...base,
        // the lamp plays no part in sums
        variant: false,
        kind,
        a,
        b,
        op,
        offset: difficulty === 1 ? 0 : rand(rng, 4),
        entry: '',
      };
    }
    case 'flash': {
      const length = 2 + difficulty; // 3..5
      return {
        ...base,
        kind,
        colors: shuffled(rng, PAD_COLORS),
        seq: Array.from({ length }, () => rand(rng, 4)),
        plan: twoPlans<Gesture>(
          () => pick(rng, Object.keys(SHIFT) as Gesture[]),
          variant,
          (x, y) => x === y,
        ),
        step: 0,
      };
    }
  }
}

export function makeBomb(spec: Spec, rng: () => number): Mod[] {
  const kinds = spec.kinds.length ? spec.kinds : MODULE_KINDS;
  // every kind shows up before any repeats
  const order: ModuleKind[] = [];
  while (order.length < spec.modules) order.push(...shuffled(rng, kinds));
  return order
    .slice(0, spec.modules)
    .map((kind, id) => makeModule(id, kind, spec.difficulty, rng));
}

export const mathAnswer = (m: MathMod) =>
  (m.op === '+' ? m.a + m.b : m.op === '-' ? m.a - m.b : m.a * m.b) + m.offset;

/** The gesture that stands for a sum's extra amount */
export const offsetGesture = (n: number): Gesture =>
  n === 0 ? 'circle' : NUMBER_GESTURES[n - 1];

/** The pad that must be pressed for each flash */
export const flashAnswer = (m: FlashMod) => {
  const shift = SHIFT[planOf(m)] ?? 0;
  return m.seq.map((p) => (p + shift) % 4);
};

// ---------------------------------------------------------------- the game

const seatsOf = (s: MonkeyState, role: Role) => s.roles.indexOf(role);

function dealRoles(cfg: MonkeyConfig, rng: () => number): Role[] {
  return cfg.roles === 'host' ? [...cfg.assign] : shuffled(rng, ROLES);
}

function newBomb(
  s: MonkeyState,
  bomb: number,
  now: number,
  rng: () => number,
): MonkeyState {
  const spec = specFor(s.config, bomb);
  return {
    ...s,
    spec,
    bomb,
    modules: makeBomb(spec, rng),
    endsAt: now + spec.seconds * 1000,
    pausedAt: null,
  };
}

function begin(
  players: number,
  rng: () => number,
  config: MonkeyConfig,
): MonkeyState {
  if (players !== 3)
    throw new RoomError('Three Monkeys needs exactly 3 players', 409);
  const spec = specFor(config, 0);
  return {
    config,
    spec,
    roles: dealRoles(config, rng),
    phase: 'briefing',
    ready: [false, false, false],
    bomb: 0,
    defused: 0,
    modules: makeBomb(spec, rng),
    mistakes: 0,
    endsAt: 0,
    pausedAt: null,
    signs: [],
    signSeq: 0,
    event: null,
    cause: null,
    finishedWith: 0,
  };
}

const note = (
  s: MonkeyState,
  kind: Event['kind'],
  module: number,
): MonkeyState => ({
  ...s,
  event: { seq: (s.event?.seq ?? 0) + 1, kind, module },
});

/** A mistake: the clock loses time, and too many blow the bomb up. */
function mistake(s: MonkeyState, id: number, now: number): MonkeyState {
  const mistakes = s.mistakes + 1;
  const endsAt = s.endsAt - s.spec.penalty * 1000;
  const next = note({ ...s, mistakes, endsAt }, 'bad', id);
  if (mistakes > s.spec.mistakes)
    return { ...next, phase: 'exploded', cause: 'mistakes' };
  if (endsAt <= now) return { ...next, phase: 'exploded', cause: 'time' };
  return next;
}

/** After a module is solved: the bomb is defused when they all are. */
function solved(
  s: MonkeyState,
  id: number,
  now: number,
  rng: () => number,
): MonkeyState {
  const modules = s.modules.map((m) =>
    m.id === id ? { ...m, solved: true } : m,
  );
  const next = note({ ...s, modules }, 'solved', id);
  if (!modules.every((m) => m.solved)) return next;
  const left = Math.max(0, Math.ceil((s.endsAt - now) / 1000));
  const done = { ...next, defused: s.defused + 1, finishedWith: left };
  if (s.config.mode !== 'endless') return { ...done, phase: 'won' };
  // endless: straight on to the next bomb, with a little time carried over
  const fresh = newBomb(done, s.bomb + 1, now, rng);
  return note(
    { ...fresh, endsAt: fresh.endsAt + Math.floor(left / 4) * 1000 },
    'next',
    0,
  );
}

const bad = (message: string, status = 400): never => {
  throw new RoomError(message, status);
};

interface Act {
  t: 'act';
  m: number;
  a: string;
  i?: number;
  d?: number;
  dir?: string;
}

function actOn(
  s: MonkeyState,
  act: Act,
  now: number,
  rng: () => number,
): MonkeyState {
  const mod = s.modules.find((m) => m.id === act.m);
  if (!mod) return bad('There is no such module');
  if (mod.solved) return bad('That module is already defused', 409);

  const replace = (m: Mod): MonkeyState => ({
    ...s,
    modules: s.modules.map((x) => (x.id === m.id ? m : x)),
  });
  const right = (m: Mod, finished: boolean) => {
    const next = replace(m);
    return finished ? solved(next, m.id, now, rng) : note(next, 'ok', m.id);
  };
  const wrong = (m: Mod) => mistake(replace(m), m.id, now);
  const index = (n: number) => {
    if (
      !Number.isInteger(act.i) ||
      (act.i as number) < 0 ||
      (act.i as number) >= n
    )
      bad('Nothing there to touch');
    return act.i as number;
  };

  switch (mod.kind) {
    case 'wires': {
      const i = index(mod.cut.length);
      if (mod.cut[i]) return bad('That wire is already cut', 409);
      const want = wireAt(planOf(mod)[mod.step], mod.cut.length);
      if (i !== want) return wrong(mod);
      const cut = mod.cut.map((c, k) => c || k === i);
      const step = mod.step + 1;
      return right({ ...mod, cut, step }, step >= planOf(mod).length);
    }
    case 'keypad': {
      const i = index(3);
      const code = planOf(mod);
      if (mod.labels[i] !== NUMBER_GESTURES.indexOf(code[mod.step]) + 1)
        return wrong({ ...mod, step: 0 });
      const step = mod.step + 1;
      return right({ ...mod, step }, step >= code.length);
    }
    case 'knobs': {
      if (act.a === 'turn') {
        const i = index(mod.dirs.length);
        const dir = DIRS.find((d) => d === act.dir);
        if (!dir) return bad('That is not a direction');
        return replace({
          ...mod,
          dirs: mod.dirs.map((d, k) => (k === i ? dir : d)),
        });
      }
      if (act.a === 'lock') {
        const want = planOf(mod);
        return sameList(mod.dirs, want) ? right(mod, true) : wrong(mod);
      }
      return bad('Unknown action');
    }
    case 'math': {
      if (act.a === 'clear') return replace({ ...mod, entry: '' });
      if (act.a === 'digit') {
        const d = act.d;
        if (!Number.isInteger(d) || (d as number) < 0 || (d as number) > 9)
          return bad('That is not a digit');
        if (mod.entry.length >= 3) return replace(mod);
        return replace({ ...mod, entry: mod.entry + String(d) });
      }
      if (act.a === 'enter') {
        if (!mod.entry) return bad('Key in a number first');
        return Number(mod.entry) === mathAnswer(mod)
          ? right({ ...mod, entry: '' }, true)
          : wrong({ ...mod, entry: '' });
      }
      return bad('Unknown action');
    }
    case 'flash': {
      const i = index(4);
      const want = flashAnswer(mod)[mod.step];
      if (i !== want) return wrong({ ...mod, step: 0 });
      const step = mod.step + 1;
      return right({ ...mod, step }, step >= mod.seq.length);
    }
  }
}

function playMove(
  s: MonkeyState,
  seat: number,
  raw: unknown,
  rng: () => number,
  now: number,
): MonkeyState {
  const mv = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >;
  const role = s.roles[seat];

  if (s.phase === 'briefing') {
    if (mv.t !== 'ready') return bad('The briefing is still going', 409);
    const ready = s.ready.map((r, i) => r || i === seat);
    if (!ready.every(Boolean)) return { ...s, ready };
    // everyone is ready: the clock starts now
    return {
      ...s,
      ready,
      phase: 'playing',
      endsAt: now + s.spec.seconds * 1000,
    };
  }
  if (s.phase !== 'playing') return bad('The bomb is no longer live', 409);
  if (s.pausedAt !== null)
    return bad('Paused: waiting for a monkey to come back', 409);

  if (mv.t === 'gesture') {
    if (role !== 'mute') return bad('Only the Mute Monkey can gesture', 403);
    if (!isGesture(mv.g)) return bad('Unknown gesture');
    const last = s.signs[s.signs.length - 1];
    if (last && now - last.at < GESTURE_GAP_MS)
      return bad('Slow down a little', 429);
    const seq = s.signSeq + 1;
    return {
      ...s,
      signSeq: seq,
      signs: [...s.signs, { seq, g: mv.g, at: now }].slice(-GESTURE_KEEP),
    };
  }
  if (mv.t === 'act') {
    if (role !== 'blind')
      return bad('Only the Blind Monkey can touch the bomb', 403);
    return actOn(
      s,
      {
        t: 'act',
        m: Number(mv.m),
        a: String(mv.a ?? ''),
        i: typeof mv.i === 'number' ? mv.i : undefined,
        d: typeof mv.d === 'number' ? mv.d : undefined,
        dir: typeof mv.dir === 'string' ? mv.dir : undefined,
      },
      now,
      rng,
    );
  }
  return bad('Unknown move');
}

// ---------------------------------------------------------------- views

export interface ModuleRef {
  id: number;
  kind: ModuleKind;
  solved: boolean;
}

/** The Blind Monkey's bomb: shapes and positions only. No colours, text or lamps. */
export type BlindMod =
  | {
      id: number;
      kind: 'wires';
      solved: boolean;
      count: number;
      cut: boolean[];
    }
  | { id: number; kind: 'keypad'; solved: boolean }
  | { id: number; kind: 'knobs'; solved: boolean; dirs: Dir[] }
  | { id: number; kind: 'math'; solved: boolean; entry: string }
  | { id: number; kind: 'flash'; solved: boolean; seq: number[] };

/** The Deaf Monkey's bomb: everything the eyes can see. */
export type DeafMod =
  | {
      id: number;
      kind: 'wires';
      solved: boolean;
      lamp: boolean | null;
      colors: string[];
      cut: boolean[];
      step: number;
      steps: number;
    }
  | {
      id: number;
      kind: 'keypad';
      solved: boolean;
      lamp: boolean | null;
      labels: number[];
      step: number;
      steps: number;
    }
  | {
      id: number;
      kind: 'knobs';
      solved: boolean;
      lamp: boolean | null;
      dirs: Dir[];
    }
  | {
      id: number;
      kind: 'math';
      solved: boolean;
      lamp: null;
      a: number;
      b: number;
      op: string;
      entry: string;
    }
  | {
      id: number;
      kind: 'flash';
      solved: boolean;
      lamp: boolean | null;
      colors: string[];
      seq: number[];
      step: number;
    };

/** One page of the manual: the answer as gestures, for the lit and the dark lamp. */
export interface ManualPage {
  id: number;
  kind: ModuleKind;
  solved: boolean;
  /** Whether the answer depends on the lamp; if not, `lit` and `dark` are the same */
  variant: boolean;
  lit: Gesture[];
  dark: Gesture[];
}

export interface MonkeyView {
  role: Role | null;
  roles: Role[];
  phase: Phase;
  mode: MonkeyConfig['mode'];
  level: number;
  levels: number;
  bomb: number;
  defused: number;
  mistakes: number;
  allowed: number;
  penalty: number;
  difficulty: number;
  /** Milliseconds the bomb started with */
  total: number;
  /** Milliseconds on the clock as of this view; stands still while paused */
  remaining: number;
  paused: boolean;
  ready: boolean[];
  cause: Cause | null;
  finishedWith: number;
  modules: ModuleRef[];
  event: Event | null;
  signs: Sign[];
  /** Voice: the seat you talk to (Deaf, sending) or listen to (Blind, receiving) */
  voice: { peer: number; dir: 'send' | 'receive' } | null;
  blind?: BlindMod[];
  deaf?: DeafMod[];
  manual?: ManualPage[];
}

const blindMod = (m: Mod): BlindMod => {
  switch (m.kind) {
    case 'wires':
      return {
        id: m.id,
        kind: m.kind,
        solved: m.solved,
        count: m.cut.length,
        cut: m.cut,
      };
    case 'keypad':
      return { id: m.id, kind: m.kind, solved: m.solved };
    case 'knobs':
      return { id: m.id, kind: m.kind, solved: m.solved, dirs: m.dirs };
    case 'math':
      return { id: m.id, kind: m.kind, solved: m.solved, entry: m.entry };
    case 'flash':
      return { id: m.id, kind: m.kind, solved: m.solved, seq: m.seq };
  }
};

const deafMod = (m: Mod): DeafMod => {
  const lamp = m.variant ? m.lamp : null;
  switch (m.kind) {
    case 'wires':
      return {
        id: m.id,
        kind: m.kind,
        solved: m.solved,
        lamp,
        colors: m.colors,
        cut: m.cut,
        step: m.step,
        steps: planOf(m).length,
      };
    case 'keypad':
      return {
        id: m.id,
        kind: m.kind,
        solved: m.solved,
        lamp,
        labels: m.labels,
        step: m.step,
        steps: planOf(m).length,
      };
    case 'knobs':
      return { id: m.id, kind: m.kind, solved: m.solved, lamp, dirs: m.dirs };
    case 'math':
      return {
        id: m.id,
        kind: m.kind,
        solved: m.solved,
        lamp: null,
        a: m.a,
        b: m.b,
        op: m.op,
        entry: m.entry,
      };
    case 'flash':
      return {
        id: m.id,
        kind: m.kind,
        solved: m.solved,
        lamp,
        colors: m.colors,
        seq: m.seq,
        step: m.step,
      };
  }
};

const manualPage = (m: Mod): ManualPage => {
  const base = { id: m.id, kind: m.kind, solved: m.solved, variant: m.variant };
  switch (m.kind) {
    case 'wires':
    case 'keypad':
      return { ...base, lit: m.plan[0], dark: m.plan[1] };
    case 'knobs':
      return { ...base, lit: m.plan[0], dark: m.plan[1] };
    case 'math':
      return {
        ...base,
        lit: [offsetGesture(m.offset)],
        dark: [offsetGesture(m.offset)],
      };
    case 'flash':
      return { ...base, lit: [m.plan[0]], dark: [m.plan[1]] };
  }
};

export const voiceOf = (
  s: MonkeyState,
  seat: number | null,
): MonkeyView['voice'] => {
  if (seat === null || s.phase === 'abandoned') return null;
  const role = s.roles[seat];
  if (role === 'deaf') return { peer: seatsOf(s, 'blind'), dir: 'send' };
  if (role === 'blind') return { peer: seatsOf(s, 'deaf'), dir: 'receive' };
  return null;
};

function viewOf(s: MonkeyState, seat: number | null, now: number): MonkeyView {
  const role = seat === null ? null : (s.roles[seat] ?? null);
  const live = s.phase === 'playing';
  const view: MonkeyView = {
    role,
    roles: s.roles,
    phase: s.phase,
    mode: s.config.mode,
    level: s.config.level,
    levels: CAMPAIGN.length,
    bomb: s.bomb,
    defused: s.defused,
    mistakes: s.mistakes,
    allowed: s.spec.mistakes,
    penalty: s.spec.penalty,
    difficulty: s.spec.difficulty,
    total: s.spec.seconds * 1000,
    remaining: live
      ? Math.max(0, s.endsAt - (s.pausedAt ?? now))
      : s.phase === 'briefing'
        ? s.spec.seconds * 1000
        : 0,
    paused: s.pausedAt !== null,
    ready: s.ready,
    cause: s.cause,
    finishedWith: s.finishedWith,
    modules: s.modules.map((m) => ({
      id: m.id,
      kind: m.kind,
      solved: m.solved,
    })),
    event: s.event,
    // the gestures are only for the Mute Monkey (who sent them) and the Deaf Monkey
    signs: role === 'mute' || role === 'deaf' || role === null ? s.signs : [],
    voice: voiceOf(s, seat),
  };
  if (role === 'blind') view.blind = s.modules.map(blindMod);
  if (role === 'deaf') view.deaf = s.modules.map(deafMod);
  if (role === 'mute') view.manual = s.modules.map(manualPage);
  return view;
}

// ---------------------------------------------------------------- the def

const isOver = (s: MonkeyState) =>
  s.phase === 'won' || s.phase === 'exploded' || s.phase === 'abandoned';

export const monkeysGame: GameDef<MonkeyState> = {
  id: 'monkeys',
  minPlayers: 3,
  maxPlayers: 3,
  autoStart: false,
  defaultOptions: DEFAULT_MONKEYS,
  sanitizeOptions: sanitizeMonkeys,
  capacity: () => 3,

  start: (players, rng = cryptoRng(), options) =>
    begin(players, rng, sanitizeMonkeys(options)),

  restart: (previous, players, rng = cryptoRng()) => {
    // a cleared campaign level opens the next one
    const config =
      previous.phase === 'won' &&
      previous.config.mode === 'campaign' &&
      previous.config.level < CAMPAIGN.length
        ? { ...previous.config, level: previous.config.level + 1 }
        : previous.config;
    return begin(players, rng, config);
  },

  move: (state, seat, move, rng = cryptoRng(), ctx) =>
    playMove(state, seat, move, rng, ctx?.now ?? Date.now()),

  /**
   * The clock. Runs on the server whoever is looking: the bomb goes off when
   * time is up, and the clock stands still while a monkey is away.
   */
  tick: (state, now, _rng, away = []) => {
    if (state.phase !== 'playing') return null;
    if (away.length > 0) {
      return state.pausedAt === null ? { ...state, pausedAt: now } : null;
    }
    if (state.pausedAt !== null) {
      return {
        ...state,
        endsAt: state.endsAt + (now - state.pausedAt),
        pausedAt: null,
      };
    }
    return now >= state.endsAt
      ? { ...state, phase: 'exploded', cause: 'time' }
      : null;
  },

  // somebody was gone too long: the team cannot go on
  eliminate: (state) =>
    isOver(state) ? state : { ...state, phase: 'abandoned', cause: 'left' },

  // no talking in text: the monkeys have a gesture wheel and a voice
  chat: (state) =>
    isOver(state) ? { send: 'all', read: ['all'] } : { send: null, read: [] },

  voice: (state, seat) => voiceOf(state, seat),

  view: (state, seat, ctx) => viewOf(state, seat, ctx?.now ?? Date.now()),
  isOver,
};
