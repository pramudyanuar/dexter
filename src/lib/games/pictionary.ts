import { WORDS } from '@/lib/games/data/words';
import { shuffle } from '@/lib/games/uno';
import type { GameDef } from '@/lib/rooms/game';
import { RoomError } from '@/lib/rooms/types';

/** Rounds each player draws in one game. */
export const TURNS_EACH = 2;
export const COORD_MAX = 1000;
export const COLORS = [
  '#1f2328',
  '#e5484d',
  '#3e63dd',
  '#30a46c',
  '#f5c518',
  '#ab4aba',
  '#ffffff',
] as const;
export const WIDTHS = [4, 9, 18] as const;

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
  drawer: number;
  word: string;
  /** Words already used this game */
  used: string[];
  strokes: Stroke[];
  guesses: GuessEntry[];
  solved: number[];
  scores: number[];
  last: { word: string; solved: number[] } | null;
  winners: number[] | null;
}

export interface PictionaryView {
  players: number;
  round: number;
  rounds: number;
  drawer: number;
  /** The word for the drawer, otherwise a hint like "_ _ _ _" */
  word: string | null;
  hint: string;
  strokes: Stroke[];
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

function pickWord(used: string[], rng: () => number) {
  const pool = WORDS.filter((w) => !used.includes(w));
  const list = pool.length ? pool : WORDS;
  return list[Math.floor(rng() * list.length)];
}

function fresh(
  players: number,
  rng: () => number = Math.random,
): PictionaryState {
  const first = shuffle([...WORDS], rng)[0];
  return {
    players,
    round: 0,
    rounds: players * TURNS_EACH,
    drawer: 0,
    word: first,
    used: [first],
    strokes: [],
    guesses: [],
    solved: [],
    scores: Array(players).fill(0),
    last: null,
    winners: null,
  };
}

/** Closes the current round and opens the next, or ends the game. */
function advance(s: PictionaryState, rng: () => number): PictionaryState {
  const last = { word: s.word, solved: s.solved };
  const round = s.round + 1;
  if (round >= s.rounds) {
    const top = Math.max(...s.scores);
    return {
      ...s,
      round,
      strokes: [],
      solved: [],
      last,
      winners: s.scores.flatMap((n, i) => (n === top ? [i] : [])),
    };
  }
  const word = pickWord(s.used, rng);
  return {
    ...s,
    round,
    drawer: round % s.players,
    word,
    used: [...s.used, word],
    strokes: [],
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

  start: fresh,
  restart: (_previous, players, rng) => fresh(players, rng),

  move(state, seat, move, rng = Math.random) {
    const m = move as Record<string, unknown> | null;
    const type = m?.type;

    // anyone may end a round that ran out of time, as long as it is still that round
    if (type === 'next') {
      if (m?.round !== state.round)
        throw new RoomError('Ronde sudah berganti', 409);
      return advance(state, rng);
    }

    if (type === 'stroke' || type === 'clear') {
      if (seat !== state.drawer)
        throw new RoomError('Hanya penggambar yang bisa menggambar', 403);
      if (type === 'clear') return { ...state, strokes: [] };

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
        pts.length > 400 ||
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
      return { ...state, strokes };
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
      return solved.length >= state.players - 1 ? advance(next, rng) : next;
    }

    throw new RoomError('Aksi tidak dikenal');
  },

  view(state, seat): PictionaryView {
    const isDrawer = seat === state.drawer;
    const over = state.winners !== null;
    return {
      players: state.players,
      round: state.round,
      rounds: state.rounds,
      drawer: state.drawer,
      word: isDrawer && !over ? state.word : null,
      hint: over ? '' : hintFor(state.word),
      strokes: state.strokes,
      guesses: state.guesses,
      solved: state.solved,
      scores: state.scores,
      last: state.last,
      winners: state.winners,
    };
  },

  isOver: (state) => state.winners !== null,
};
