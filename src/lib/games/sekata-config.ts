export type WordTag =
  'standard' | 'proper' | 'place' | 'foreign' | 'abbr' | 'slang' | 'regional';

/**
 * Sekata's settings, kept apart from the engine so the lobby can use them
 * without pulling in the dictionary.
 */

export type Mode =
  | 'classic'
  | 'green'
  | 'point'
  | 'elimination'
  | 'speed'
  | 'vocabulary'
  | 'norepeat';

export const MODES: readonly Mode[] = [
  'classic',
  'green',
  'point',
  'elimination',
  'speed',
  'vocabulary',
  'norepeat',
];

export interface SekataConfig {
  mode: Mode;
  handSize: number;
  /** Yellow cards face up in the middle */
  sharedYellow: number;
  /** Green jokers dealt to each player */
  greenPerPlayer: number;
  /** Whether a used green card is gone for good */
  greenConsumed: boolean;
  /** Whether a used yellow card leaves the middle (and is replaced) */
  yellowConsumed: boolean;
  /** Blank jokers shuffled into the draw pile (0 to leave them out) */
  blankCards: number;
  /** Pink cards drawn for a rejected word */
  penalty: number;
  allowRepeats: boolean;
  categories: Record<Exclude<WordTag, 'standard'>, boolean>;
  /** Words the dictionary does not know: ask the moderator, or reject */
  unknownWords: 'review' | 'reject';
  /** After a word you wait until someone else gets one in */
  cooldown: boolean;
  replacement: boolean;
  replaceLimit: number;
  /** Seconds for the whole round; 0 for no limit */
  timeLimit: number;
  minWordCards: number;
  /** Others may challenge an accepted word */
  challenges: boolean;
  /** Every word needs its meaning explained */
  needMeaning: boolean;
  scoring: {
    perCard: number;
    perLetter: number;
    finishBonus: number;
    invalidPenalty: number;
  };
}

export const DEFAULT_CONFIG: SekataConfig = {
  mode: 'classic',
  handSize: 10,
  sharedYellow: 3,
  greenPerPlayer: 0,
  greenConsumed: true,
  yellowConsumed: false,
  blankCards: 0,
  penalty: 1,
  allowRepeats: false,
  categories: {
    proper: false,
    place: false,
    foreign: false,
    abbr: false,
    slang: false,
    regional: false,
  },
  unknownWords: 'review',
  cooldown: false,
  replacement: false,
  replaceLimit: 2,
  timeLimit: 0,
  minWordCards: 2,
  challenges: true,
  needMeaning: false,
  scoring: { perCard: 10, perLetter: 2, finishBonus: 30, invalidPenalty: 5 },
};

/** What choosing a mode switches on, before the host changes anything by hand. */
export function modeDefaults(mode: Mode): Partial<SekataConfig> {
  switch (mode) {
    case 'green':
      return { greenPerPlayer: 2 };
    case 'speed':
      return { timeLimit: 180 };
    case 'vocabulary':
      return { needMeaning: true };
    case 'norepeat':
      return { allowRepeats: false };
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

/** A complete, clamped settings object from whatever a client sent. */
export function sanitizeConfig(raw: unknown): SekataConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >;
  const mode = MODES.includes(r.mode as Mode) ? (r.mode as Mode) : 'classic';
  const base: SekataConfig = {
    ...DEFAULT_CONFIG,
    ...modeDefaults(mode),
    mode,
  };
  const cats = (r.categories ?? {}) as Record<string, unknown>;
  const sc = (r.scoring ?? {}) as Record<string, unknown>;
  const cfg: SekataConfig = {
    mode,
    handSize: int(r.handSize, 4, 15, base.handSize),
    sharedYellow: int(r.sharedYellow, 0, 6, base.sharedYellow),
    greenPerPlayer: int(r.greenPerPlayer, 0, 3, base.greenPerPlayer),
    greenConsumed: bool(r.greenConsumed, base.greenConsumed),
    yellowConsumed: bool(r.yellowConsumed, base.yellowConsumed),
    blankCards:
      r.blankCards === 3 ? 3 : r.blankCards === 0 ? 0 : base.blankCards,
    penalty: int(r.penalty, 0, 3, base.penalty),
    allowRepeats: bool(r.allowRepeats, base.allowRepeats),
    categories: {
      proper: bool(cats.proper, base.categories.proper),
      place: bool(cats.place, base.categories.place),
      foreign: bool(cats.foreign, base.categories.foreign),
      abbr: bool(cats.abbr, base.categories.abbr),
      slang: bool(cats.slang, base.categories.slang),
      regional: bool(cats.regional, base.categories.regional),
    },
    unknownWords: r.unknownWords === 'reject' ? 'reject' : base.unknownWords,
    cooldown: bool(r.cooldown, base.cooldown),
    replacement: bool(r.replacement, base.replacement),
    replaceLimit: int(r.replaceLimit, 1, 5, base.replaceLimit),
    timeLimit: int(r.timeLimit, 0, 900, base.timeLimit),
    minWordCards: int(r.minWordCards, 1, 4, base.minWordCards),
    challenges: bool(r.challenges, base.challenges),
    needMeaning: bool(r.needMeaning, base.needMeaning),
    scoring: {
      perCard: int(sc.perCard, 0, 100, base.scoring.perCard),
      perLetter: int(sc.perLetter, 0, 50, base.scoring.perLetter),
      finishBonus: int(sc.finishBonus, 0, 500, base.scoring.finishBonus),
      invalidPenalty: int(
        sc.invalidPenalty,
        0,
        100,
        base.scoring.invalidPenalty,
      ),
    },
  };
  // what a mode is, whatever the other settings say
  if (mode === 'norepeat') cfg.allowRepeats = false;
  if (mode === 'vocabulary') cfg.needMeaning = true;
  if (mode === 'speed' && cfg.timeLimit < 30) cfg.timeLimit = 180;
  if (mode === 'green' && cfg.greenPerPlayer < 1) cfg.greenPerPlayer = 1;
  return cfg;
}
