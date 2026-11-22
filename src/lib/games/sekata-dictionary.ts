/**
 * Sekata's local dictionary combines the game's own list, Wordle's five-letter
 * words, and forms from Kamus Indonesia and MALINDO Morph. Turunan such as
 * "dimakan", "memakan" and "makanan" are looked up as complete words.
 * The moderator reviews unknown words unless the host chose strict mode.
 */
import type { WordTag } from '@/lib/games/sekata-config';

import { SEKATA_HUNSPELL_FORMS } from '@/constant/sekata-hunspell';
import { SEKATA_MALINDO_FORMS } from '@/constant/sekata-malindo';
import {
  SEKATA_ABBR,
  SEKATA_FOREIGN,
  SEKATA_NONSTANDARD,
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
  for (const w of split(SEKATA_HUNSPELL_FORMS)) map.set(w, 'standard');
  for (const w of split(SEKATA_MALINDO_FORMS)) map.set(w, 'standard');
  for (const w of split(WORDLE_VALID_WORDS)) map.set(w, 'standard');
  for (const w of WORDLE_ANSWERS) map.set(w, 'standard');
  for (const [tag, list] of [...TAGGED].reverse()) {
    for (const w of split(list)) map.set(w, tag);
  }
  for (const w of split(SEKATA_NONSTANDARD)) map.delete(w);
  index = map;
  return map;
}

/** What the dictionary knows about a word, or null when it does not know it. */
export function lookup(word: string): WordTag | null {
  return words().get(word.toLowerCase()) ?? null;
}

const VOWELS = 'aiueo';

/** A spelling heuristic for unknown words. Listed words may have clusters. */
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
