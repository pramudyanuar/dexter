/**
 * The word checker behind Sekata. A local dictionary stands in for a full
 * Indonesian dictionary: the game's own list, the 5-letter dictionary words
 * Wordle already carries, and a root-plus-affix check ("makan" → "dimakan",
 * "memakan", "makanan"). Whatever it does not know is not simply rejected: the
 * game sends it to the moderator (or rejects it, if the host chose strict).
 */
import type { WordTag } from '@/lib/games/sekata-config';

import {
  SEKATA_ABBR,
  SEKATA_FOREIGN,
  SEKATA_PLACE,
  SEKATA_PROPER,
  SEKATA_REGIONAL,
  SEKATA_SLANG,
  SEKATA_STANDARD,
} from '@/constant/sekata-words';
import { WORDLE_VALID_WORDS } from '@/constant/wordle-valid';
import { WORDLE_ANSWERS } from '@/constant/wordle-words';

export type { WordTag };

const split = (s: string) => s.split(/\s+/).filter(Boolean);

const TAGGED: [WordTag, string][] = [
  ['standard', SEKATA_STANDARD],
  ['proper', SEKATA_PROPER],
  ['place', SEKATA_PLACE],
  ['foreign', SEKATA_FOREIGN],
  ['abbr', SEKATA_ABBR],
  ['slang', SEKATA_SLANG],
  ['regional', SEKATA_REGIONAL],
];

let index: Map<string, WordTag> | null = null;

function words() {
  if (index) return index;
  const map = new Map<string, WordTag>();
  // the weaker tags first, so a word listed as ordinary stays ordinary
  for (const w of split(WORDLE_VALID_WORDS)) map.set(w, 'standard');
  for (const w of WORDLE_ANSWERS) map.set(w, 'standard');
  for (const [tag, list] of [...TAGGED].reverse()) {
    for (const w of split(list)) map.set(w, tag);
  }
  index = map;
  return map;
}

const PREFIXES = [
  'meng',
  'meny',
  'mem',
  'men',
  'me',
  'peng',
  'peny',
  'pem',
  'pen',
  'pe',
  'ber',
  'be',
  'per',
  'ter',
  'di',
  'ke',
  'se',
];
const SUFFIXES = ['kan', 'an', 'i', 'nya', 'lah', 'kah', 'ku', 'mu', 'pun'];

/** The roots a word might come from once its prefix and suffix are taken off. */
function roots(word: string): string[] {
  const out = new Set<string>();
  const bases = new Set<string>([word]);
  for (const s of SUFFIXES) {
    if (word.endsWith(s) && word.length - s.length >= 3) {
      bases.add(word.slice(0, -s.length));
    }
  }
  for (const base of bases) {
    out.add(base);
    for (const p of PREFIXES) {
      if (!base.startsWith(p) || base.length - p.length < 3) continue;
      const rest = base.slice(p.length);
      out.add(rest);
      // the nasal prefixes swallow a first letter: meN + tulis → menulis, sapu → menyapu
      if (p === 'meny' || p === 'peny') out.add(`s${rest}`);
      if (p === 'meng' || p === 'peng') {
        for (const c of ['k', 'g', 'h']) out.add(`${c}${rest}`);
      }
      if (p === 'mem' || p === 'pem') out.add(`p${rest}`).add(`b${rest}`);
      if (p === 'men' || p === 'pen') out.add(`t${rest}`).add(`d${rest}`);
    }
  }
  return [...out];
}

export interface Lookup {
  tag: WordTag;
  /** True when the word is known through its root rather than listed itself */
  derived: boolean;
}

/** What the dictionary knows about a word, or null when it does not know it. */
export function lookup(word: string): Lookup | null {
  const map = words();
  const w = word.toLowerCase();
  const direct = map.get(w);
  if (direct) return { tag: direct, derived: false };
  for (const root of roots(w)) {
    if (root === w || root.length < 3) continue;
    const found = map.get(root);
    // only ordinary roots carry over: "dibudi" is not a word
    if (found === 'standard') return { tag: 'standard', derived: true };
  }
  return null;
}

const VOWELS = 'aiueo';

/** Whether a word can be said: it has a vowel, and no run of four consonants. */
export function pronounceable(word: string): boolean {
  if (!/^[a-z]+$/.test(word)) return false;
  if (![...word].some((c) => VOWELS.includes(c))) return false;
  return !/[^aiueo]{4,}/.test(word.replace(/ng|ny|sy|kh/g, 'x'));
}

/** Rough syllables of a word, for showing how it is built. */
export function syllables(word: string): string[] {
  const out: string[] = [];
  let cur = '';
  const w = word.replace(/ng|ny|sy|kh/g, (m) => m.toUpperCase());
  const isV = (c: string) => VOWELS.includes(c.toLowerCase());
  for (let i = 0; i < w.length; i++) {
    cur += w[i];
    if (isV(w[i])) {
      // an ending consonant stays with this syllable unless a vowel follows it
      const next = w[i + 1];
      const after = w[i + 2];
      if (next && !isV(next) && after && !isV(after)) {
        cur += w[++i];
      }
      out.push(cur);
      cur = '';
    }
  }
  if (cur && out.length) out[out.length - 1] += cur;
  return out.map((s) => s.toLowerCase());
}
