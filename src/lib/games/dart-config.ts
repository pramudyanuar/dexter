/** Dart's settings, kept apart from the engine so the lobby can use them. */

export type DartMode = '301' | '501' | 'countup' | 'clock' | 'cricket';
export const DART_MODES: readonly DartMode[] = [
  '501',
  '301',
  'countup',
  'clock',
  'cricket',
];

export type ThrowMode = 'casual' | 'skill';
export type Difficulty = 'easy' | 'normal' | 'hard';

export interface DartConfig {
  mode: DartMode;
  /** The score to count down from in 301 and 501 */
  startScore: number;
  /** Finish on a double (or the inner bull) */
  doubleOut: boolean;
  throwMode: ThrowMode;
  difficulty: Difficulty;
  /** Count Up: rounds of three darts */
  rounds: number;
  /** Around the Clock: finish on the bull */
  clockBull: boolean;
  /** A game that runs this many rounds without a winner is decided on points (0: no limit) */
  maxRounds: number;
}

export const DEFAULT_DART: DartConfig = {
  mode: '501',
  startScore: 501,
  doubleOut: true,
  throwMode: 'casual',
  difficulty: 'normal',
  rounds: 8,
  clockBull: true,
  maxRounds: 0,
};

const int = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v)
    ? Math.min(max, Math.max(min, Math.round(v)))
    : fallback;

export function sanitizeDart(raw: unknown): DartConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >;
  const mode = DART_MODES.includes(r.mode as DartMode)
    ? (r.mode as DartMode)
    : DEFAULT_DART.mode;
  const base = mode === '301' ? 301 : 501;
  return {
    mode,
    startScore: int(r.startScore, 61, 1001, base),
    doubleOut: typeof r.doubleOut === 'boolean' ? r.doubleOut : true,
    throwMode: r.throwMode === 'skill' ? 'skill' : 'casual',
    difficulty:
      r.difficulty === 'easy' || r.difficulty === 'hard'
        ? r.difficulty
        : 'normal',
    rounds: int(r.rounds, 1, 20, DEFAULT_DART.rounds),
    clockBull: typeof r.clockBull === 'boolean' ? r.clockBull : true,
    maxRounds: int(r.maxRounds, 0, 50, 0),
  };
}

/** The mode's usual starting score, for when the host switches mode. */
export const startFor = (mode: DartMode) => (mode === '301' ? 301 : 501);

export const MODE_INFO: Record<DartMode, { title: string; blurb: string }> = {
  '501': {
    title: '501',
    blurb:
      'Count down from 501 to exactly zero. Finish on a double or the inner bull. Go over, reach 1, or finish without a double and it is a bust.',
  },
  '301': {
    title: '301',
    blurb: 'Same rules as 501, but you start from 301.',
  },
  countup: {
    title: 'Count Up',
    blurb:
      'Add up everything you hit over a set number of rounds. Highest total wins.',
  },
  clock: {
    title: 'Around the Clock',
    blurb:
      'Hit 1, then 2, then 3, all the way to 20. First to finish wins. Optional bullseye finale.',
  },
  cricket: {
    title: 'Cricket',
    blurb:
      'Close 15 to 20 and the bull with three marks each. Keep hitting a number you have closed to score, until your opponents close it too.',
  },
};

/** The seven Cricket targets; 25 is the bull. */
export const CRICKET = [20, 19, 18, 17, 16, 15, 25] as const;
