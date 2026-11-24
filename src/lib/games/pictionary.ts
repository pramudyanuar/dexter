import { WORDS } from '@/lib/games/data/words';
import { shuffle } from '@/lib/games/uno';
import type { GameDef } from '@/lib/rooms/game';
import { RoomError } from '@/lib/rooms/types';

/** Rounds each player draws in one game. */
export const TURNS_EACH = 2;
export const ROUND_SECONDS = 80;
export const COORD_MAX = 1000;
export const COLORS = [
  '#1f2328',
  '#e5484d',
  '#3e63dd',
  '#30a46c',
  '#f5c518',
  '#ab4aba',
  '#ffffff',
  '#f97316',
  '#ec4899',
  '#7c482b',
  '#94a3b8',
  '#0ea5a0',
  '#142b63',
] as const;
export const ERASER = 6;
export const WIDTHS = [4, 9, 18, 2, 32] as const;
export const STROKE_BATCH_LIMIT = 400;

const MAX_STROKES = 250;
const MAX_POINTS = 6000;
const MAX_GUESS_LOG = 40;

export interface Stroke {
  id: string;
  color: number; // index into COLORS
  width: number; // index into WIDTHS
  /** Flat x,y pairs in 0..COORD_MAX */
  pts: number[];
}

export interface GuessEntry {
  seat: number;
  /** Empty for a correct guess, so the word is not given away */
  text: string;
  correct: boolean;
}

export interface PictionaryState {
  players: number;
  /** Index of the current round, 0-based */
  round: number;
  rounds: number;
  deadline?: number;
  drawer: number;
  word: string;
  /** Two word options offered to the drawer before drawing starts */
  choices?: [string, string];
  /** Words already used this game */
  used: string[];
  strokes: Stroke[];
  redo?: Stroke[];
  drawingStarted?: boolean;
  guesses: GuessEntry[];
  solved: number[];
  scores: number[];
  last: { word: string; solved: number[] } | null;
  winners: number[] | null;
  /** Seats removed from the game; drawing turns skip them */
  out?: boolean[];
}

export interface PictionaryView {
  players: number;
  round: number;
  rounds: number;
  remainingMs: number;
  drawer: number;
  /** The word for the drawer, otherwise a hint like "_ _ _ _" */
  word: string | null;
  /** Two word choices shown only to the drawer before drawing starts */
  choices: [string, string] | null;
  hint: string;
  strokes: Stroke[];
  canRedo: boolean;
  guesses: GuessEntry[];
  solved: number[];
  scores: number[];
  last: PictionaryState['last'];
  winners: number[] | null;
}

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');

const hintFor = (word: string) =>
  word
    .split('')
    .map((ch) => (/[a-z0-9]/i.test(ch) ? '_' : ch === ' ' ? '/' : ch))
    .join(' ');

function pickTwoWords(used: string[], rng: () => number): [string, string] {
  const pool = WORDS.filter((w) => !used.includes(w));
  const list = pool.length >= 2 ? pool : WORDS;
  const first = list[Math.floor(rng() * list.length)];
  const rest = list.filter((w) => w !== first);
  const second = (rest.length ? rest : WORDS)[
    Math.floor(rng() * (rest.length ? rest.length : WORDS.length))
  ];
  return [first, second];
}

function fresh(
  players: number,
  rng: () => number = Math.random,
  options?: unknown,
  now = Date.now(),
): PictionaryState {
  const opts = (options && typeof options === 'object' ? options : {}) as {
    turnsEach?: number;
  };
  const turnsEach =
    typeof opts.turnsEach === 'number' &&
    opts.turnsEach >= 1 &&
    opts.turnsEach <= 5
      ? Math.round(opts.turnsEach)
      : TURNS_EACH;
  const shuffled = shuffle([...WORDS], rng);
  const choices: [string, string] = [shuffled[0], shuffled[1] ?? shuffled[0]];
  const first = choices[0];
  return {
    players,
    round: 0,
    rounds: players * turnsEach,
    deadline: now + ROUND_SECONDS * 1000,
    drawer: 0,
    word: first,
    choices,
    used: [first],
    strokes: [],
    guesses: [],
    solved: [],
    scores: Array(players).fill(0),
    last: null,
    winners: null,
  };
}

const activeSeats = (s: PictionaryState) =>
  Array.from({ length: s.players }, (_, i) => i).filter((i) => !s.out?.[i]);

/** Closes the current round and opens the next, or ends the game. */
function advance(
  s: PictionaryState,
  rng: () => number,
  now: number,
): PictionaryState {
  const last = { word: s.word, solved: s.solved };
  const round = s.round + 1;
  if (round >= s.rounds) {
    const left = activeSeats(s);
    const top = Math.max(...left.map((i) => s.scores[i]));
    return {
      ...s,
      round,
      strokes: [],
      redo: [],
      solved: [],
      last,
      winners: left.filter((i) => s.scores[i] === top),
    };
  }
  const choices = pickTwoWords(s.used, rng);
  const word = choices[0];
  return {
    ...s,
    round,
    deadline: now + ROUND_SECONDS * 1000,
    // players still in the game take turns drawing
    drawer: activeSeats(s)[round % activeSeats(s).length],
    word,
    choices,
    used: [...s.used, word],
    strokes: [],
    redo: [],
    drawingStarted: false,
    guesses: [],
    solved: [],
    last,
  };
}

const finite = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n);

export const pictionaryGame: GameDef<PictionaryState> = {
  id: 'pictionary',
  minPlayers: 2,
  maxPlayers: 6,
  autoStart: false,
  fixedTurnClock: true,

  start: fresh,
  restart: (_previous, players, rng, options, now) =>
    fresh(players, rng, options, now),

  move(state, seat, move, rng = Math.random, ctx) {
    const now = ctx?.now ?? Date.now();
    const m = move as Record<string, unknown> | null;
    const type = m?.type;

    if (m?.round !== undefined && m.round !== state.round)
      throw new RoomError('Ronde sudah berganti', 409);

    if (type === 'next') {
      if (m?.round !== state.round)
        throw new RoomError('Ronde sudah berganti', 409);
      if (seat !== state.drawer && (state.deadline ?? Infinity) > now)
        throw new RoomError('Hanya penggambar yang bisa melewati ronde', 403);
      return advance(state, rng, now);
    }

    if (type === 'pick_word') {
      if (seat !== state.drawer)
        throw new RoomError('Hanya penggambar yang bisa memilih kata', 403);
      if (state.strokes.length > 0)
        throw new RoomError('Sudah mulai menggambar', 409);
      const word = typeof m?.word === 'string' ? m.word : '';
      if (!state.choices || !state.choices.includes(word))
        throw new RoomError('Pilihan kata tidak valid');
      const used = state.used.includes(word)
        ? state.used
        : [...state.used, word];
      return { ...state, word, used, choices: undefined };
    }

    if (
      type === 'stroke' ||
      type === 'clear' ||
      type === 'undo' ||
      type === 'redo'
    ) {
      if (seat !== state.drawer)
        throw new RoomError('Hanya penggambar yang bisa menggambar', 403);
      if (type === 'clear') {
        return {
          ...state,
          drawingStarted: state.drawingStarted || state.strokes.length > 0,
          strokes: [],
          redo: [],
        };
      }
      if (type === 'undo') {
        const stroke = state.strokes.at(-1);
        if (!stroke) return state;
        return {
          ...state,
          drawingStarted: true,
          strokes: state.strokes.slice(0, -1),
          redo: [...(state.redo ?? []), stroke],
        };
      }
      if (type === 'redo') {
        const stroke = state.redo?.at(-1);
        if (!stroke) return state;
        return {
          ...state,
          strokes: [...state.strokes, stroke],
          redo: state.redo?.slice(0, -1),
        };
      }

      const { id, pts, color, width } = m as {
        id?: unknown;
        pts?: unknown;
        color?: unknown;
        width?: unknown;
      };
      if (
        typeof id !== 'string' ||
        id.length > 24 ||
        !Array.isArray(pts) ||
        pts.length < 2 ||
        pts.length > STROKE_BATCH_LIMIT ||
        pts.length % 2 !== 0 ||
        !pts.every((n) => finite(n) && n >= 0 && n <= COORD_MAX) ||
        !Number.isInteger(color) ||
        (color as number) < 0 ||
        (color as number) >= COLORS.length ||
        !Number.isInteger(width) ||
        (width as number) < 0 ||
        (width as number) >= WIDTHS.length
      )
        throw new RoomError('Goresan tidak valid');

      const rounded = (pts as number[]).map(Math.round);
      const strokes = [...state.strokes];
      const tail = strokes[strokes.length - 1];
      // the same id means "more points for the stroke being drawn"
      if (tail && tail.id === id) {
        strokes[strokes.length - 1] = {
          ...tail,
          pts: [...tail.pts, ...rounded],
        };
      } else {
        strokes.push({
          id,
          color: color as number,
          width: width as number,
          pts: rounded,
        });
      }
      if (
        strokes.length > MAX_STROKES ||
        strokes.reduce((n, s) => n + s.pts.length, 0) > MAX_POINTS
      )
        throw new RoomError('Gambar terlalu rumit, hapus dulu', 409);
      return {
        ...state,
        strokes,
        choices: undefined,
        drawingStarted: true,
        redo: [],
      };
    }

    if (type === 'guess') {
      if (seat === state.drawer)
        throw new RoomError('Penggambar tidak boleh menebak', 403);
      if (state.solved.includes(seat))
        throw new RoomError('Kamu sudah menebak dengan benar', 409);
      const text =
        typeof m?.text === 'string' ? m.text.trim().slice(0, 40) : '';
      if (!text) throw new RoomError('Tebakan kosong');

      const correct = normalize(text) === normalize(state.word);
      const entry: GuessEntry = {
        seat,
        text: correct ? '' : text,
        correct,
      };
      const guesses = [...state.guesses, entry].slice(-MAX_GUESS_LOG);
      if (!correct) return { ...state, guesses };

      // 3 points for the first, then 2, then 1; the drawer earns 1 per guesser
      const solved = [...state.solved, seat];
      const scores = [...state.scores];
      scores[seat] += Math.max(1, 4 - solved.length);
      scores[state.drawer] += 1;
      const next = { ...state, guesses, solved, scores };
      return solved.length >= activeSeats(state).length - 1
        ? advance(next, rng, now)
        : next;
    }

    throw new RoomError('Aksi tidak dikenal');
  },

  // only a drawer who has not started drawing is being waited for; a round that
  // is underway ends on its own clock
  waiting: (state) =>
    !state.winners && !state.drawingStarted && state.strokes.length === 0
      ? { seats: [state.drawer], seconds: 60 }
      : null,

  autoMove: (state) => ({ type: 'next', round: state.round }),
  passive: (_move, previous, next) => previous?.round === next?.round,
  tick(state, now, rng = Math.random) {
    if (state.winners) return null;
    if (state.deadline === undefined)
      return { ...state, deadline: now + ROUND_SECONDS * 1000 };
    return now >= state.deadline ? advance(state, rng, now) : null;
  },

  eliminate(state, seat, rng = Math.random, now = Date.now()) {
    if (state.out?.[seat]) return state;
    const out = [...(state.out ?? Array<boolean>(state.players).fill(false))];
    out[seat] = true;
    const next = {
      ...state,
      out,
      solved: state.solved.filter((s) => s !== seat),
    };
    const left = activeSeats(next);
    // drawing alone is no game: the one still here wins
    if (left.length <= 1) {
      return {
        ...next,
        strokes: [],
        last: { word: state.word, solved: next.solved },
        winners: left,
      };
    }
    // the drawer left, or everyone still here has already guessed
    if (seat === state.drawer || next.solved.length >= left.length - 1) {
      return advance(next, rng, now);
    }
    return next;
  },

  view(state, seat, ctx): PictionaryView {
    const now = ctx?.now ?? Date.now();
    const isDrawer = seat === state.drawer;
    const over = state.winners !== null;
    return {
      players: state.players,
      round: state.round,
      rounds: state.rounds,
      remainingMs: Math.max(
        0,
        (state.deadline ?? now + ROUND_SECONDS * 1000) - now,
      ),
      drawer: state.drawer,
      word: isDrawer && !over ? state.word : null,
      choices:
        isDrawer && !over && state.strokes.length === 0
          ? (state.choices ?? null)
          : null,
      hint: over ? '' : hintFor(state.word),
      strokes: state.strokes,
      canRedo: isDrawer && !over && Boolean(state.redo?.length),
      guesses: state.guesses,
      solved: state.solved,
      scores: state.scores,
      last: state.last,
      winners: state.winners,
    };
  },

  isOver: (state) => state.winners !== null,
};
