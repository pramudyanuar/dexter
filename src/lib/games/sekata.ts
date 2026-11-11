import {
  blankDeck,
  CardKind,
  greenDeck,
  pinkDeck,
  SCard,
  SYLLABLE,
  yellowDeck,
} from '@/lib/games/sekata-cards';
import type { WordTag } from '@/lib/games/sekata-config';
import {
  DEFAULT_CONFIG,
  sanitizeConfig,
  SekataConfig,
} from '@/lib/games/sekata-config';
import { lookup, pronounceable } from '@/lib/games/sekata-dictionary';
import { shuffle } from '@/lib/games/uno';
import type { GameCtx, GameDef } from '@/lib/rooms/game';
import { RoomError } from '@/lib/rooms/types';

/**
 * SEKATA: build Indonesian words out of syllable cards, all players at once.
 * The room's polling and compare-and-set writes already serialise everyone's
 * submissions, so when two players reach for the same shared card the first
 * write wins and the second is told the card is gone.
 *
 * What the original game leaves open (what the yellow, green and blank cards
 * do exactly) is a setting here, not a hard-coded rule.
 */

export * from '@/lib/games/sekata-config';

// -------------------------------------------------------------------- state

export type Origin = 'hand' | 'green' | 'center' | 'yellow';

interface Used {
  card: SCard;
  from: Origin;
  /** What a joker stood for */
  fill?: string;
}

export type WordStatus = 'ok' | 'review' | 'void' | 'invalid';

export interface WordEntry {
  n: number;
  seat: number;
  word: string;
  status: WordStatus;
  reason?: string;
  meaning?: string;
  points: number;
  /** The player's own cards it used */
  own: number;
  used: Used[];
  /** Cards that left their place for this word (kept so they can come back) */
  taken: Used[];
  /** Cards are already spent: a challenge, not a first look */
  final: boolean;
  challengedBy: number[];
}

export interface Stat {
  words: number;
  cards: number;
  invalid: number;
}

export interface FeedItem {
  n: number;
  kind:
    'reveal' | 'penalty' | 'replace' | 'challenge' | 'rule' | 'drop' | 'end';
  seat: number | null;
  text: string;
}

export interface SekataState {
  config: SekataConfig;
  players: number;
  hands: SCard[][];
  greens: SCard[][];
  draw: SCard[];
  discard: SCard[];
  center: SCard[];
  yellow: SCard[];
  yellowStock: SCard[];
  words: WordEntry[];
  /** Words the moderator allowed, which count as known from then on */
  approved: string[];
  nextWord: number;
  scores: number[];
  stats: Stat[];
  replacements: number[];
  stuck: boolean[];
  places: number[];
  dropped: number[];
  lastSubmitter: number | null;
  /** Counts up with every revealed card, so clients can animate the new one */
  reveals: number;
  feed: FeedItem[];
  nextFeed: number;
  startedAt: number;
  deadline: number | null;
  endedAt: number | null;
  over: boolean;
  winner: number | null;
  loser: number | null;
  endReason: 'finished' | 'time' | 'last' | 'empty' | 'left' | null;
}

// ------------------------------------------------------------------ helpers

const isActive = (s: SekataState, seat: number) =>
  !s.dropped.includes(seat) && !s.places.includes(seat);
const actives = (s: SekataState) =>
  Array.from({ length: s.players }, (_, i) => i).filter((i) => isActive(s, i));
const pendingBy = (s: SekataState, seat: number) =>
  s.words.some((w) => w.seat === seat && w.status === 'review' && !w.final);

function say(
  s: SekataState,
  kind: FeedItem['kind'],
  seat: number | null,
  text: string,
) {
  s.feed.push({ n: s.nextFeed++, kind, seat, text });
  if (s.feed.length > 30) s.feed.shift();
}

/** Draws up to `count` pink cards, shuffling the used ones back in if the pile runs dry. */
function take(s: SekataState, count: number, rng: () => number): SCard[] {
  const got: SCard[] = [];
  for (let i = 0; i < count; i++) {
    if (s.draw.length === 0) {
      s.draw = shuffle(s.discard, rng);
      s.discard = [];
    }
    const card = s.draw.pop();
    if (!card) break;
    got.push(card);
  }
  return got;
}

function penalize(
  s: SekataState,
  seat: number,
  rng: () => number,
  why: string,
) {
  const n = s.config.penalty;
  if (!n) return;
  const got = take(s, n, rng);
  s.hands[seat].push(...got);
  say(s, 'penalty', seat, `${why} Tarik ${got.length} kartu.`);
}

const meaningOk = (m: unknown) =>
  typeof m === 'string' && m.trim().length >= 3 && m.trim().length <= 120;

// -------------------------------------------------------------------- start

export function start(
  players: number,
  rng: () => number = Math.random,
  options?: unknown,
): SekataState {
  const config = sanitizeConfig(options);
  const draw = shuffle(
    [...pinkDeck(), ...(config.blankCards ? blankDeck() : [])],
    rng,
  );
  const hands: SCard[][] = Array.from({ length: players }, () => []);
  for (let i = 0; i < config.handSize; i++) {
    for (let p = 0; p < players; p++) hands[p].push(draw.pop()!);
  }

  // the opening syllable: the first plain pink card off the pile
  const at = draw.findLastIndex((c) => c.kind === 'pink');
  const opening = draw.splice(at, 1)[0];

  const yellow = shuffle(yellowDeck(), rng);
  const shared = yellow.splice(0, config.sharedYellow);

  const greenStock = shuffle(greenDeck(), rng);
  const each = Math.min(
    config.greenPerPlayer,
    Math.floor(greenStock.length / players),
  );
  const greens: SCard[][] = Array.from({ length: players }, () => []);
  for (let i = 0; i < each; i++) {
    for (let p = 0; p < players; p++) greens[p].push(greenStock.pop()!);
  }

  const now = Date.now();
  return {
    config,
    players,
    hands,
    greens,
    draw,
    discard: [],
    center: [opening],
    yellow: shared,
    yellowStock: yellow,
    words: [],
    approved: [],
    nextWord: 1,
    scores: Array(players).fill(0),
    stats: Array.from({ length: players }, () => ({
      words: 0,
      cards: 0,
      invalid: 0,
    })),
    replacements: Array(players).fill(0),
    stuck: Array(players).fill(false),
    places: [],
    dropped: [],
    lastSubmitter: null,
    reveals: 0,
    feed: [],
    nextFeed: 1,
    startedAt: now,
    deadline: config.timeLimit ? now + config.timeLimit * 1000 : null,
    endedAt: null,
    over: false,
    winner: null,
    loser: null,
    endReason: null,
  };
}

// ----------------------------------------------------------------- the end

/** Best to worst, depending on how the game was set up and how it ended. */
export function ranking(s: SekataState): number[] {
  const all = Array.from({ length: s.players }, (_, i) => i);
  const left = (i: number) => s.hands[i].length;
  const byCards = (a: number, b: number) =>
    left(a) - left(b) || s.scores[b] - s.scores[a];
  const live = all.filter((i) => !s.dropped.includes(i));
  const gone = s.dropped;

  if (s.config.mode === 'elimination') {
    const rest = live.filter((i) => !s.places.includes(i)).sort(byCards);
    return [...s.places, ...gone, ...rest];
  }
  if (s.config.mode === 'point') {
    return [
      ...live.sort((a, b) => s.scores[b] - s.scores[a] || byCards(a, b)),
      ...gone,
    ];
  }
  const done = s.places.filter((i) => !s.dropped.includes(i));
  const rest = live.filter((i) => !done.includes(i)).sort(byCards);
  return [...done, ...rest, ...gone];
}

function end(s: SekataState, reason: NonNullable<SekataState['endReason']>) {
  if (s.over) return;
  s.over = true;
  s.endReason = reason;
  s.endedAt = Date.now();
  const order = ranking(s);
  if (s.config.mode === 'elimination') {
    const rest = order.filter(
      (i) => !s.places.includes(i) && !s.dropped.includes(i),
    );
    s.loser = reason === 'last' ? (rest[0] ?? null) : null;
    s.winner = s.places[0] ?? order[0] ?? null;
  } else {
    s.winner = order[0] ?? null;
  }
  say(s, 'end', s.winner, 'Permainan selesai.');
}

/** Called after anything that can change who has cards left. */
function settle(s: SekataState) {
  if (s.over) return;
  for (const seat of actives(s)) {
    if (s.hands[seat].length > 0 || pendingBy(s, seat)) continue;
    s.places.push(seat);
    if (s.config.mode !== 'elimination') {
      s.scores[seat] += s.config.scoring.finishBonus;
      end(s, 'finished');
      return;
    }
  }
  if (s.config.mode === 'elimination' && actives(s).length <= 1) {
    end(s, 'last');
    return;
  }
  if (actives(s).length === 0) end(s, 'finished');
}

// ------------------------------------------------------------- word checking

type Verdict =
  { kind: 'ok' } | { kind: 'review' } | { kind: 'invalid'; reason: string };

const TAG_NAME: Record<Exclude<WordTag, 'standard'>, string> = {
  proper: 'nama orang',
  place: 'nama tempat',
  foreign: 'kata asing',
  abbr: 'singkatan',
  slang: 'bahasa gaul',
  regional: 'bahasa daerah',
};

function judge(s: SekataState, word: string): Verdict {
  if (!pronounceable(word)) {
    return { kind: 'invalid', reason: `"${word}" tidak bisa diucapkan.` };
  }
  if (s.approved.includes(word)) return { kind: 'ok' };
  const found = lookup(word);
  if (!found) {
    return s.config.unknownWords === 'reject'
      ? { kind: 'invalid', reason: `"${word}" tidak ada di kamus.` }
      : { kind: 'review' };
  }
  if (found.tag !== 'standard' && !s.config.categories[found.tag]) {
    return {
      kind: 'invalid',
      reason: `"${word}" ${TAG_NAME[found.tag]}, belum diizinkan di game ini.`,
    };
  }
  return { kind: 'ok' };
}

// ------------------------------------------------------------------- cards

const remove = (list: SCard[], id: string) => {
  const i = list.findIndex((c) => c.id === id);
  return i === -1 ? null : list.splice(i, 1)[0];
};

/** Takes a word's cards off the table. The ones that stay (shared yellow, kept green) are not moved. */
function lock(s: SekataState, seat: number, used: Used[]): Used[] {
  const taken: Used[] = [];
  for (const u of used) {
    if (u.from === 'hand') {
      remove(s.hands[seat], u.card.id);
      taken.push(u);
    } else if (u.from === 'center') {
      remove(s.center, u.card.id);
      taken.push(u);
    } else if (u.from === 'green' && s.config.greenConsumed) {
      remove(s.greens[seat], u.card.id);
      taken.push(u);
    } else if (u.from === 'yellow' && s.config.yellowConsumed) {
      remove(s.yellow, u.card.id);
      const next = s.yellowStock.pop();
      if (next) s.yellow.push(next);
      taken.push(u);
    }
  }
  return taken;
}

/** The word stands: its pink cards go to the used pile and it scores. */
function finalize(s: SekataState, e: WordEntry) {
  for (const u of e.taken) {
    if (u.card.kind === 'pink' || u.card.kind === 'blank')
      s.discard.push(u.card);
  }
  e.points =
    e.own * s.config.scoring.perCard +
    Math.max(0, e.word.length - 3) * s.config.scoring.perLetter;
  s.scores[e.seat] += e.points;
  s.stats[e.seat].words += 1;
  s.stats[e.seat].cards += e.own;
  e.final = true;
}

/** The word falls: the cards go back where they came from. */
function revert(s: SekataState, e: WordEntry) {
  for (const u of e.taken) {
    if (u.from === 'hand') {
      remove(s.discard, u.card.id);
      s.hands[e.seat].push(u.card);
    } else if (u.from === 'center') {
      remove(s.discard, u.card.id);
      s.center.push(u.card);
    } else if (u.from === 'green') {
      s.greens[e.seat].push(u.card);
    } else if (u.from === 'yellow') {
      s.yellow.push(u.card);
    }
  }
  if (e.final) {
    s.scores[e.seat] -= e.points;
    s.stats[e.seat].words -= 1;
    s.stats[e.seat].cards -= e.own;
  }
  e.taken = [];
  e.final = false;
  e.points = 0;
}

// ------------------------------------------------------------------- moves

type Move =
  | {
      type: 'submit';
      cards: string[];
      fills?: Record<string, string>;
      meaning?: string;
    }
  | { type: 'stuck' }
  | { type: 'challenge'; n: number }
  | { type: 'rule'; n: number; verdict: 'accept' | 'reject' }
  | { type: 'replace'; card: string }
  | { type: 'tick' };

function submit(
  s: SekataState,
  seat: number,
  move: Extract<Move, { type: 'submit' }>,
  rng: () => number,
) {
  const cfg = s.config;
  if (!isActive(s, seat))
    throw new RoomError('Kamu sudah tidak ikut bermain', 409);
  if (cfg.cooldown && s.lastSubmitter === seat) {
    throw new RoomError('Tunggu pemain lain menyusun kata dulu', 409);
  }
  const ids = Array.isArray(move.cards) ? move.cards : [];
  if (
    ids.length < 1 ||
    ids.length > 14 ||
    ids.some((i) => typeof i !== 'string')
  ) {
    throw new RoomError('Pilih kartu untuk menyusun kata', 400);
  }
  if (new Set(ids).size !== ids.length) {
    throw new RoomError('Satu kartu tidak boleh dipakai dua kali', 400);
  }

  const find = (id: string): Used | null => {
    let card = s.hands[seat].find((c) => c.id === id);
    if (card) return { card, from: 'hand' };
    card = s.greens[seat].find((c) => c.id === id);
    if (card) return { card, from: 'green' };
    card = s.center.find((c) => c.id === id);
    if (card) return { card, from: 'center' };
    card = s.yellow.find((c) => c.id === id);
    if (card) return { card, from: 'yellow' };
    return null;
  };
  const used: Used[] = [];
  for (const id of ids) {
    const u = find(id);
    if (!u)
      throw new RoomError('Kartu itu bukan milikmu atau sudah terpakai', 409);
    used.push(u);
  }
  if (!used.some((u) => u.from === 'hand')) {
    throw new RoomError('Pakai minimal satu kartu dari tanganmu', 400);
  }
  if (used.length < cfg.minWordCards) {
    throw new RoomError(`Kata butuh minimal ${cfg.minWordCards} kartu`, 400);
  }
  if (
    used.filter((u) => u.card.kind === 'green' || u.card.kind === 'blank')
      .length > 1
  ) {
    throw new RoomError('Hanya satu kartu joker per kata', 400);
  }

  // the word is exactly what the cards spell
  const fills = move.fills && typeof move.fills === 'object' ? move.fills : {};
  let word = '';
  for (const u of used) {
    if (u.card.kind === 'green' || u.card.kind === 'blank') {
      const fill = String(fills[u.card.id] ?? '')
        .toLowerCase()
        .trim();
      if (!SYLLABLE.test(fill)) {
        throw new RoomError('Tulis satu suku kata untuk kartu joker', 400);
      }
      u.fill = fill;
      word += fill;
    } else {
      word += u.card.text;
    }
  }
  if (word.length < 2) throw new RoomError('Kata terlalu pendek', 400);
  if (cfg.needMeaning && !meaningOk(move.meaning)) {
    throw new RoomError('Jelaskan arti katanya (minimal 3 huruf)', 400);
  }
  const meaning =
    typeof move.meaning === 'string'
      ? move.meaning.trim().slice(0, 120)
      : undefined;
  if (
    !cfg.allowRepeats &&
    s.words.some(
      (w) => w.word === word && (w.status === 'ok' || w.status === 'review'),
    )
  ) {
    throw new RoomError(`"${word}" sudah dipakai`, 409);
  }

  const own = used.filter((u) => u.from === 'hand').length;
  const entry: WordEntry = {
    n: s.nextWord++,
    seat,
    word,
    status: 'ok',
    meaning,
    points: 0,
    own,
    used,
    taken: [],
    final: false,
    challengedBy: [],
  };
  s.words.push(entry);
  s.stuck.fill(false);

  const verdict = judge(s, word);
  if (verdict.kind === 'invalid') {
    entry.status = 'invalid';
    entry.reason = verdict.reason;
    s.stats[seat].invalid += 1;
    s.scores[seat] = Math.max(0, s.scores[seat] - cfg.scoring.invalidPenalty);
    penalize(s, seat, rng, verdict.reason);
    return;
  }
  entry.taken = lock(s, seat, used);
  s.lastSubmitter = seat;
  if (verdict.kind === 'review') {
    entry.status = 'review';
    entry.reason = 'Kata tidak ada di kamus, menunggu keputusan moderator.';
    say(s, 'rule', seat, `"${word}" menunggu keputusan moderator.`);
  } else {
    finalize(s, entry);
  }
  settle(s);
}

function reveal(s: SekataState, rng: () => number) {
  const [card] = take(s, 1, rng);
  s.stuck.fill(false);
  if (!card) {
    end(s, 'empty');
    return;
  }
  s.center.push(card);
  s.reveals += 1;
  say(
    s,
    'reveal',
    null,
    `Kartu baru terbuka: ${card.text.toUpperCase() || 'joker'}.`,
  );
}

function rule(
  s: SekataState,
  seat: number,
  move: Extract<Move, { type: 'rule' }>,
  ctx: GameCtx | undefined,
  rng: () => number,
) {
  if (ctx && ctx.host !== seat) {
    throw new RoomError('Hanya moderator yang bisa memutuskan', 403);
  }
  const e = s.words.find((w) => w.n === move.n);
  if (!e || e.status !== 'review') {
    throw new RoomError('Tidak ada kata yang perlu diputuskan', 409);
  }
  if (move.verdict === 'accept') {
    if (!e.final) {
      finalize(s, e);
      s.approved.push(e.word);
    }
    e.status = 'ok';
    e.reason = undefined;
    e.challengedBy = [];
    say(s, 'rule', e.seat, `Moderator menerima "${e.word}".`);
  } else {
    const wasFinal = e.final;
    revert(s, e);
    e.status = wasFinal ? 'void' : 'invalid';
    e.reason = 'Ditolak moderator.';
    s.stats[e.seat].invalid += 1;
    s.scores[e.seat] = Math.max(
      0,
      s.scores[e.seat] - s.config.scoring.invalidPenalty,
    );
    say(s, 'rule', e.seat, `Moderator menolak "${e.word}".`);
    penalize(s, e.seat, rng, 'Kata ditolak.');
  }
  settle(s);
}

export const sekataGame: GameDef<SekataState> = {
  id: 'sekata',
  minPlayers: 3,
  maxPlayers: 10,
  autoStart: false,
  defaultOptions: DEFAULT_CONFIG,
  sanitizeOptions: sanitizeConfig,

  start,
  restart: (previous, players, rng) => start(players, rng, previous.config),

  move(state, seat, raw, rng = Math.random, ctx) {
    if (state.over) throw new RoomError('Permainan sudah selesai', 409);
    const move = raw as Move | null;
    if (!move || typeof move !== 'object') {
      throw new RoomError('Langkah tidak valid', 400);
    }
    const s = structuredClone(state);

    switch (move.type) {
      case 'submit':
        submit(s, seat, move, rng);
        break;

      case 'stuck': {
        if (!isActive(s, seat)) throw new RoomError('Kamu sudah selesai', 409);
        s.stuck[seat] = !s.stuck[seat];
        if (actives(s).every((i) => s.stuck[i])) reveal(s, rng);
        break;
      }

      case 'challenge': {
        if (!s.config.challenges)
          throw new RoomError('Tantangan dimatikan', 409);
        if (s.dropped.includes(seat))
          throw new RoomError('Kamu sudah keluar', 409);
        const e = s.words.find((w) => w.n === move.n);
        if (!e || e.status !== 'ok')
          throw new RoomError('Kata itu tidak bisa ditantang', 409);
        if (e.seat === seat)
          throw new RoomError('Kata sendiri tidak bisa ditantang', 409);
        // only the latest words: older ones have long been built on
        if (e.n < s.nextWord - 6)
          throw new RoomError('Kata itu sudah terlalu lama', 409);
        e.status = 'review';
        e.reason = 'Ditantang pemain lain, menunggu keputusan moderator.';
        e.challengedBy = [seat];
        say(s, 'challenge', seat, `Menantang "${e.word}".`);
        break;
      }

      case 'rule':
        rule(s, seat, move, ctx, rng);
        break;

      case 'replace': {
        const cfg = s.config;
        if (!cfg.replacement)
          throw new RoomError('Tukar kartu tidak aktif', 409);
        if (!isActive(s, seat)) throw new RoomError('Kamu sudah selesai', 409);
        if (s.replacements[seat] >= cfg.replaceLimit) {
          throw new RoomError('Jatah tukar kartumu habis', 409);
        }
        const card = remove(s.hands[seat], String(move.card));
        if (!card) throw new RoomError('Kartu itu bukan milikmu', 409);
        // it goes to the bottom of the pile, then a fresh one comes off the top
        s.draw.unshift(card);
        s.hands[seat].push(...take(s, 1, rng));
        s.replacements[seat] += 1;
        say(s, 'replace', seat, 'Menukar satu kartu.');
        break;
      }

      case 'tick': {
        if (s.deadline === null || Date.now() < s.deadline) {
          throw new RoomError('Waktu belum habis', 409);
        }
        end(s, 'time');
        break;
      }

      default:
        throw new RoomError('Langkah tidak dikenal', 400);
    }
    if (!s.over) settle(s);
    return s;
  },

  // a player who left: their cards go back, and play carries on
  eliminate(state, seat, rng = Math.random) {
    if (state.dropped.includes(seat) || state.over) return state;
    const s = structuredClone(state);
    s.draw = shuffle([...s.draw, ...s.hands[seat]], rng);
    s.hands[seat] = [];
    s.greens[seat] = [];
    s.dropped.push(seat);
    s.stuck[seat] = false;
    // their words still waiting for a ruling are void
    for (const e of s.words) {
      if (e.seat === seat && e.status === 'review' && !e.final) {
        e.status = 'void';
        e.reason = 'Pemain keluar.';
      }
    }
    say(s, 'drop', seat, 'Pemain keluar dari permainan.');
    if (actives(s).length <= 1) {
      // the one still playing, if any, wins
      const rest = actives(s);
      s.winner = rest[0] ?? null;
      end(s, 'left');
      if (rest[0] !== undefined) s.winner = rest[0];
    } else if (actives(s).every((i) => s.stuck[i])) {
      reveal(s, rng);
    }
    if (!s.over) settle(s);
    return s;
  },

  view(state, seat, ctx): SekataView {
    const mine = seat === null || state.dropped.includes(seat);
    const timeLeft =
      state.deadline === null || state.over
        ? null
        : Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000));
    return {
      config: state.config,
      players: state.players,
      you: seat,
      moderator: seat !== null && ctx?.host === seat,
      hand: mine ? [] : state.hands[seat!],
      greens: mine ? [] : state.greens[seat!],
      counts: state.hands.map((h) => h.length),
      greenCounts: state.greens.map((g) => g.length),
      center: state.center,
      yellow: state.yellow,
      drawCount: state.draw.length,
      usedCount: state.discard.length,
      words: state.words.slice(-60).map((w) => ({
        n: w.n,
        seat: w.seat,
        word: w.word,
        status: w.status,
        reason: w.reason,
        meaning: w.meaning,
        points: w.points,
        parts: w.used.map((u) => ({
          text: u.fill ?? u.card.text,
          kind: u.card.kind,
          from: u.from,
        })),
        challengedBy: w.challengedBy,
        canChallenge:
          seat !== null &&
          state.config.challenges &&
          !state.over &&
          w.status === 'ok' &&
          w.seat !== seat &&
          w.n >= state.nextWord - 6 &&
          !state.dropped.includes(seat),
      })),
      scores: state.scores,
      stats: state.stats,
      stuck: state.stuck,
      places: state.places,
      dropped: state.dropped,
      replacementsLeft:
        seat === null
          ? 0
          : state.config.replaceLimit - state.replacements[seat],
      cooling:
        seat !== null && state.config.cooldown && state.lastSubmitter === seat,
      reveals: state.reveals,
      feed: state.feed,
      timeLeft,
      startedAt: state.startedAt,
      endedAt: state.endedAt,
      elapsed: Math.max(
        0,
        Math.floor(((state.endedAt ?? Date.now()) - state.startedAt) / 1000),
      ),
      over: state.over,
      winner: state.winner,
      loser: state.loser,
      endReason: state.endReason,
      ranking: state.over ? ranking(state) : [],
    };
  },

  isOver: (state) => state.over,
};

// -------------------------------------------------------------------- views

export interface WordView {
  n: number;
  seat: number;
  word: string;
  status: WordStatus;
  reason?: string;
  meaning?: string;
  points: number;
  parts: { text: string; kind: CardKind; from: Origin }[];
  challengedBy: number[];
  canChallenge: boolean;
}

/** What one seat sees: its own cards, and only counts for everyone else's. */
export interface SekataView {
  config: SekataConfig;
  players: number;
  you: number | null;
  /** This seat decides disputed words */
  moderator: boolean;
  hand: SCard[];
  greens: SCard[];
  counts: number[];
  greenCounts: number[];
  center: SCard[];
  yellow: SCard[];
  drawCount: number;
  usedCount: number;
  words: WordView[];
  scores: number[];
  stats: Stat[];
  stuck: boolean[];
  places: number[];
  dropped: number[];
  replacementsLeft: number;
  /** You must wait for someone else's word before another of yours */
  cooling: boolean;
  reveals: number;
  feed: FeedItem[];
  timeLeft: number | null;
  startedAt: number;
  endedAt: number | null;
  /** Seconds the game has run (or ran for), as the server counts them */
  elapsed: number;
  over: boolean;
  winner: number | null;
  loser: number | null;
  endReason: SekataState['endReason'];
  ranking: number[];
}
