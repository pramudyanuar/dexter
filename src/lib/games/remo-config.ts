/** Remo's settings, kept apart from the engine so the lobby can use them. */

export type RemoMode = 'classic' | 'point' | 'quick' | 'joker';
export const REMO_MODES: readonly RemoMode[] = [
  'classic',
  'point',
  'quick',
  'joker',
];

/** How a player may finish: `discard` allows going out on the last discard; `melded` needs every card laid down. */
export type Finish = 'discard' | 'melded';

export interface RemoConfig {
  mode: RemoMode;
  handSize: number;
  /** Jokers added to the 52 cards */
  jokers: number;
  /** Most jokers in one combination */
  jokerLimit: number;
  aceLow: boolean;
  aceHigh: boolean;
  /** Add cards to combinations on the table */
  layoff: boolean;
  /** Points the first combination(s) must be worth (0: any) */
  initialMeld: number;
  finish: Finish;
  /** You cannot discard the card you just took from the discard pile */
  noSameDiscard: boolean;
  /** Seconds per turn (0: no clock) */
  turnSeconds: number;
  /** Rounds in a match (Point Remo) */
  rounds: number;
}

export const DEFAULT_REMO: RemoConfig = {
  mode: 'classic',
  handSize: 7,
  jokers: 0,
  jokerLimit: 1,
  aceLow: true,
  aceHigh: true,
  layoff: true,
  initialMeld: 0,
  finish: 'discard',
  noSameDiscard: true,
  turnSeconds: 60,
  rounds: 1,
};

/** What choosing a mode switches on, before the host changes anything by hand. */
export function modeDefaults(mode: RemoMode): Partial<RemoConfig> {
  switch (mode) {
    case 'point':
      return { rounds: 3 };
    case 'quick':
      return { handSize: 5, turnSeconds: 30 };
    case 'joker':
      return { jokers: 2, jokerLimit: 1 };
    default:
      return {};
  }
}

const int = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v)
    ? Math.min(max, Math.max(min, Math.round(v)))
    : fallback;
const bool = (v: unknown, fallback: boolean) =>
  typeof v === 'boolean' ? v : fallback;

export function sanitizeRemo(raw: unknown): RemoConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >;
  const mode = REMO_MODES.includes(r.mode as RemoMode)
    ? (r.mode as RemoMode)
    : 'classic';
  const base: RemoConfig = { ...DEFAULT_REMO, ...modeDefaults(mode), mode };
  const cfg: RemoConfig = {
    mode,
    handSize: int(r.handSize, 4, 10, base.handSize),
    jokers: int(r.jokers, 0, 4, base.jokers),
    jokerLimit: int(r.jokerLimit, 0, 4, base.jokerLimit),
    aceLow: bool(r.aceLow, base.aceLow),
    aceHigh: bool(r.aceHigh, base.aceHigh),
    layoff: bool(r.layoff, base.layoff),
    initialMeld: int(r.initialMeld, 0, 60, base.initialMeld),
    finish: r.finish === 'melded' ? 'melded' : 'discard',
    noSameDiscard: bool(r.noSameDiscard, base.noSameDiscard),
    turnSeconds:
      r.turnSeconds === 0 ? 0 : int(r.turnSeconds, 15, 300, base.turnSeconds),
    rounds: int(r.rounds, 1, 10, base.rounds),
  };
  // what a mode is, whatever the other settings say
  if (mode === 'joker' && cfg.jokers < 1) cfg.jokers = 2;
  // only Point Remo plays more than one round
  cfg.rounds = mode === 'point' ? int(r.rounds, 1, 10, 3) : 1;
  if (cfg.jokers === 0) cfg.jokerLimit = 0;
  else if (cfg.jokerLimit === 0) cfg.jokerLimit = 1;
  return cfg;
}

export const MODE_INFO: Record<RemoMode, { title: string; blurb: string }> = {
  classic: {
    title: 'Classic Remo',
    blurb:
      'Seven cards each. Draw, lay down sequences and sets, discard. First to empty their hand wins.',
  },
  point: {
    title: 'Point Remo',
    blurb:
      'Play several rounds. Cards left in your hand count against you, the lowest total wins the match.',
  },
  quick: {
    title: 'Quick Remo',
    blurb: 'A smaller hand and a faster clock for a short game.',
  },
  joker: {
    title: 'Joker Remo',
    blurb: 'Jokers are in the deck and can stand in for any missing card.',
  },
};
