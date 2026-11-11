import { WORDLE_VALID_WORDS } from '@/constant/wordle-valid';
import { WORDLE_ANSWERS } from '@/constant/wordle-words';

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

export type LetterState = 'correct' | 'present' | 'absent';

export type WordleLang = 'id' | 'en';

/** The words of one language: what can be the answer, and what may be guessed. */
export interface WordList {
  answers: readonly string[];
  isValid(word: string): boolean;
  pick(rng?: () => number): string;
}

/** A word list from its answers and a space-separated list of other valid guesses. */
export function makeWordList(
  answers: readonly string[],
  extra: string,
): WordList {
  let valid: Set<string> | null = null;
  return {
    answers,
    isValid(word) {
      valid ??= new Set([...extra.split(' ').filter(Boolean), ...answers]);
      return valid.has(word.toLowerCase());
    },
    pick: (rng = Math.random) => answers[Math.floor(rng() * answers.length)],
  };
}

const indonesian = makeWordList(WORDLE_ANSWERS, WORDLE_VALID_WORDS);

let english: Promise<WordList> | null = null;

/**
 * The words for a language. English is a separate chunk of code (about 100 KB
 * of words), so it is only downloaded when someone plays in English.
 */
export function loadWordList(lang: WordleLang): Promise<WordList> {
  if (lang === 'id') return Promise.resolve(indonesian);
  english ??= Promise.all([
    import('@/constant/wordle-en-words'),
    import('@/constant/wordle-en-valid'),
  ]).then(([a, b]) =>
    makeWordList(a.WORDLE_EN_ANSWERS, b.WORDLE_EN_VALID_WORDS),
  );
  return english;
}

/** The Indonesian list, available at once. */
export const indonesianWords = indonesian;

/** Whether a guess is a real Indonesian word: in the dictionary, or an answer word. */
export const isValidWord = (word: string) => indonesian.isValid(word);

export const pickAnswer = (rng: () => number = Math.random) =>
  indonesian.pick(rng);

/** Scores a guess. Repeated letters are only marked as often as they occur. */
export function evaluate(guess: string, answer: string): LetterState[] {
  const result: LetterState[] = Array(guess.length).fill('absent');
  const remaining: Record<string, number> = {};

  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === answer[i]) result[i] = 'correct';
    else remaining[answer[i]] = (remaining[answer[i]] ?? 0) + 1;
  }
  for (let i = 0; i < guess.length; i++) {
    if (result[i] === 'correct') continue;
    if ((remaining[guess[i]] ?? 0) > 0) {
      result[i] = 'present';
      remaining[guess[i]]--;
    }
  }
  return result;
}

const RANK: Record<LetterState, number> = { absent: 0, present: 1, correct: 2 };

/** Best known state of each letter, for colouring the on-screen keyboard. */
export function keyboardStates(
  guesses: string[],
  answer: string,
): Record<string, LetterState> {
  const states: Record<string, LetterState> = {};
  for (const guess of guesses) {
    evaluate(guess, answer).forEach((state, i) => {
      const letter = guess[i];
      if (!states[letter] || RANK[state] > RANK[states[letter]]) {
        states[letter] = state;
      }
    });
  }
  return states;
}
