/**
 * Three Monkeys: Bomb Defusal. Settings, roles and the campaign, shared by the
 * server engine and the lobby.
 */

export type Role = 'blind' | 'mute' | 'deaf';
export const ROLES: Role[] = ['blind', 'mute', 'deaf'];

export const ROLE_INFO: Record<
  Role,
  { title: string; short: string; can: string; cannot: string }
> = {
  blind: {
    title: 'Blind Monkey',
    short: 'Hands',
    can: 'Is the only one who can touch the bomb: cut wires, press keys, turn knobs.',
    cannot:
      'Sees only a grey, shaky outline of the bomb. No colours, no text, no manual. Hears the Deaf Monkey’s voice.',
  },
  mute: {
    title: 'Mute Monkey',
    short: 'Manual',
    can: 'Is the only one who can read the manual, and signals what it says with gestures.',
    cannot:
      'Cannot speak, type or see the bomb. Gestures are the only way out.',
  },
  deaf: {
    title: 'Deaf Monkey',
    short: 'Eyes & voice',
    can: 'Sees the bomb in full colour and sees the Mute Monkey’s gestures. Speaks to the Blind Monkey.',
    cannot: 'Hears nothing, so nobody can talk back. No manual, no touching.',
  },
};

/** What the Mute Monkey can say. There is no text: these are all it has. */
export const GESTURES = [
  'one',
  'two',
  'three',
  'up',
  'down',
  'left',
  'right',
  'circle',
  'cross',
  'yes',
  'no',
  'hurry',
  'stop',
  'warning',
  'help',
] as const;
export type Gesture = (typeof GESTURES)[number];
export const isGesture = (v: unknown): v is Gesture =>
  typeof v === 'string' && (GESTURES as readonly string[]).includes(v);

/** What each gesture means, shown to the Deaf Monkey and in the tutorial. */
export const GESTURE_INFO: Record<
  Gesture,
  { glyph: string; label: string; hint: string }
> = {
  one: { glyph: '☝️', label: 'One finger', hint: '1 · first from the top' },
  two: { glyph: '✌️', label: 'Two fingers', hint: '2 · second' },
  three: { glyph: '🤟', label: 'Three fingers', hint: '3 · third' },
  up: { glyph: '⬆️', label: 'Point up', hint: 'up' },
  down: { glyph: '⬇️', label: 'Point down', hint: 'down · the last one' },
  left: { glyph: '⬅️', label: 'Point left', hint: 'left' },
  right: { glyph: '➡️', label: 'Point right', hint: 'right' },
  circle: { glyph: '⭕', label: 'Circle', hint: 'zero · the same' },
  cross: { glyph: '❌', label: 'Cross', hint: 'no / nothing' },
  yes: { glyph: '👍', label: 'Yes', hint: 'the lit version follows' },
  no: { glyph: '👎', label: 'No', hint: 'the dark version follows' },
  hurry: { glyph: '⏩', label: 'Hurry', hint: 'hurry up' },
  stop: { glyph: '✋', label: 'Stop', hint: 'stop, wait' },
  warning: { glyph: '⚠️', label: 'Warning', hint: 'careful' },
  help: { glyph: '🆘', label: 'Help', hint: 'I need help' },
};

export type ModuleKind = 'wires' | 'keypad' | 'knobs' | 'math' | 'flash';
export const MODULE_KINDS: ModuleKind[] = [
  'wires',
  'keypad',
  'knobs',
  'math',
  'flash',
];
export const MODULE_INFO: Record<
  ModuleKind,
  { title: string; glyph: string; blurb: string }
> = {
  wires: {
    title: 'Wires',
    glyph: '🧵',
    blurb: 'Cut the right wires in the right order.',
  },
  keypad: {
    title: 'Keypad',
    glyph: '🔢',
    blurb: 'Press the big buttons in a secret order.',
  },
  knobs: {
    title: 'Knobs',
    glyph: '🎛️',
    blurb: 'Turn every knob to face the right way.',
  },
  math: {
    title: 'Sums',
    glyph: '➕',
    blurb: 'Work out the sum, then key in the answer.',
  },
  flash: {
    title: 'Flashes',
    glyph: '💡',
    blurb: 'Answer a flashing pattern with a twist.',
  },
};

export type Mode = 'campaign' | 'endless' | 'custom' | 'practice';
export const MODES: Mode[] = ['campaign', 'endless', 'custom', 'practice'];
export const MODE_INFO: Record<Mode, { title: string; blurb: string }> = {
  campaign: {
    title: 'Campaign',
    blurb: 'Ten bombs, each harder than the last. Clear one to open the next.',
  },
  endless: {
    title: 'Endless',
    blurb: 'Bomb after bomb with less time each round. How far can you go?',
  },
  custom: {
    title: 'Custom',
    blurb: 'Set the time, modules and difficulty yourself.',
  },
  practice: {
    title: 'Practice',
    blurb: 'A friendly bomb: lots of time, forgiving, and nothing is saved.',
  },
};

/** The shape of one bomb. */
export interface Spec {
  /** Seconds on the clock */
  seconds: number;
  modules: number;
  /** 1 easy, 2 normal, 3 hard */
  difficulty: 1 | 2 | 3;
  /** Mistakes the team may survive: one more blows the bomb up */
  mistakes: number;
  /** Seconds taken off the clock for each mistake */
  penalty: number;
  kinds: ModuleKind[];
}

export interface MonkeyConfig {
  mode: Mode;
  /** Campaign level, 1..CAMPAIGN.length */
  level: number;
  /** Custom bomb settings (also what Practice and Endless start from) */
  custom: Spec;
  /** Who gets which role: dealt at random, or chosen by the host */
  roles: 'random' | 'host';
  /** Host-chosen roles by seat (used when `roles` is 'host') */
  assign: Role[];
}

export const CAMPAIGN: Spec[] = [
  {
    seconds: 300,
    modules: 3,
    difficulty: 1,
    mistakes: 3,
    penalty: 10,
    kinds: ['wires', 'keypad'],
  },
  {
    seconds: 300,
    modules: 3,
    difficulty: 1,
    mistakes: 3,
    penalty: 10,
    kinds: ['wires', 'keypad', 'knobs'],
  },
  {
    seconds: 280,
    modules: 3,
    difficulty: 1,
    mistakes: 3,
    penalty: 15,
    kinds: ['wires', 'keypad', 'knobs', 'math'],
  },
  {
    seconds: 280,
    modules: 4,
    difficulty: 2,
    mistakes: 3,
    penalty: 15,
    kinds: ['wires', 'keypad', 'knobs', 'flash'],
  },
  {
    seconds: 260,
    modules: 4,
    difficulty: 2,
    mistakes: 3,
    penalty: 15,
    kinds: MODULE_KINDS,
  },
  {
    seconds: 260,
    modules: 4,
    difficulty: 2,
    mistakes: 2,
    penalty: 20,
    kinds: MODULE_KINDS,
  },
  {
    seconds: 240,
    modules: 5,
    difficulty: 2,
    mistakes: 3,
    penalty: 20,
    kinds: MODULE_KINDS,
  },
  {
    seconds: 240,
    modules: 5,
    difficulty: 3,
    mistakes: 3,
    penalty: 20,
    kinds: MODULE_KINDS,
  },
  {
    seconds: 220,
    modules: 5,
    difficulty: 3,
    mistakes: 2,
    penalty: 25,
    kinds: MODULE_KINDS,
  },
  {
    seconds: 200,
    modules: 5,
    difficulty: 3,
    mistakes: 1,
    penalty: 30,
    kinds: MODULE_KINDS,
  },
];

export const PRACTICE: Spec = {
  seconds: 600,
  modules: 3,
  difficulty: 1,
  mistakes: 9,
  penalty: 0,
  kinds: ['wires', 'keypad', 'flash'],
};

export const DEFAULT_SPEC: Spec = {
  seconds: 300,
  modules: 4,
  difficulty: 2,
  mistakes: 3,
  penalty: 15,
  kinds: MODULE_KINDS,
};

export const DEFAULT_MONKEYS: MonkeyConfig = {
  mode: 'campaign',
  level: 1,
  custom: DEFAULT_SPEC,
  roles: 'random',
  assign: ['blind', 'mute', 'deaf'],
};

const clamp = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : NaN;
  return Number.isNaN(n) ? fallback : Math.min(hi, Math.max(lo, n));
};

const isMode = (v: unknown): v is Mode =>
  typeof v === 'string' && (MODES as string[]).includes(v);

export function sanitizeSpec(raw: unknown): Spec {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >;
  const kinds = Array.isArray(o.kinds)
    ? MODULE_KINDS.filter((k) => (o.kinds as unknown[]).includes(k))
    : [];
  return {
    seconds: clamp(o.seconds, 60, 900, DEFAULT_SPEC.seconds),
    modules: clamp(o.modules, 3, 5, DEFAULT_SPEC.modules),
    difficulty: clamp(o.difficulty, 1, 3, 2) as 1 | 2 | 3,
    mistakes: clamp(o.mistakes, 1, 9, DEFAULT_SPEC.mistakes),
    penalty: clamp(o.penalty, 0, 60, DEFAULT_SPEC.penalty),
    kinds: kinds.length ? kinds : MODULE_KINDS,
  };
}

/** The three roles, each exactly once; anything else becomes the default order. */
export function sanitizeAssign(raw: unknown): Role[] {
  if (
    Array.isArray(raw) &&
    raw.length === 3 &&
    ROLES.every((r) => raw.includes(r))
  )
    return [...raw] as Role[];
  return [...DEFAULT_MONKEYS.assign];
}

export function sanitizeMonkeys(raw: unknown): MonkeyConfig {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >;
  return {
    mode: isMode(o.mode) ? o.mode : DEFAULT_MONKEYS.mode,
    level: clamp(o.level, 1, CAMPAIGN.length, 1),
    custom: sanitizeSpec(o.custom),
    roles: o.roles === 'host' ? 'host' : 'random',
    assign: sanitizeAssign(o.assign),
  };
}

/** The bomb for a number in a run: campaign level, custom settings, or an endless round. */
export function specFor(cfg: MonkeyConfig, bomb: number): Spec {
  if (cfg.mode === 'practice') return PRACTICE;
  if (cfg.mode === 'campaign') return CAMPAIGN[cfg.level - 1] ?? CAMPAIGN[0];
  if (cfg.mode === 'custom') return cfg.custom;
  // endless: harder and quicker every bomb
  const base = cfg.custom;
  return {
    ...base,
    difficulty: Math.min(3, 1 + Math.floor(bomb / 2)) as 1 | 2 | 3,
    modules: Math.min(5, 3 + Math.floor(bomb / 2)),
    seconds: Math.max(75, base.seconds - bomb * 20),
    kinds: MODULE_KINDS,
  };
}

export const CAMPAIGN_KEY = 'monkeys-campaign';
