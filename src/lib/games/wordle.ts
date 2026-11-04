import { WORDLE_ANSWERS } from '@/constant/wordle-words';

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

export type LetterState = 'correct' | 'present' | 'absent';

export function pickAnswer(rng: () => number = Math.random): string {
  return WORDLE_ANSWERS[Math.floor(rng() * WORDLE_ANSWERS.length)];
}

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
