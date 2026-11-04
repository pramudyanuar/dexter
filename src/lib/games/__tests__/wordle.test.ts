import { evaluate, keyboardStates, pickAnswer } from '@/lib/games/wordle';

import { WORDLE_ANSWERS } from '@/constant/wordle-words';

describe('word list', () => {
  it('only has unique lowercase 5-letter words', () => {
    expect(WORDLE_ANSWERS.length).toBeGreaterThan(200);
    expect(new Set(WORDLE_ANSWERS).size).toBe(WORDLE_ANSWERS.length);
    for (const w of WORDLE_ANSWERS) expect(w).toMatch(/^[a-z]{5}$/);
  });

  it('picks from the list', () => {
    expect(pickAnswer(() => 0)).toBe(WORDLE_ANSWERS[0]);
    expect(WORDLE_ANSWERS).toContain(pickAnswer(() => 0.999999));
  });
});

describe('evaluate', () => {
  it('marks exact, misplaced, and absent letters', () => {
    expect(evaluate('rumah', 'rumah')).toEqual(Array(5).fill('correct'));
    expect(evaluate('kotak', 'rumah')).toEqual([
      'absent',
      'absent',
      'absent',
      'correct',
      'absent',
    ]);
    // same letter, wrong place
    expect(evaluate('ruang', 'rumah')[3]).toBe('absent');
    expect(evaluate('mahru', 'rumah').slice(0, 3)).toEqual([
      'present',
      'present',
      'present',
    ]);
  });

  it('does not over-count repeated letters', () => {
    // answer has a single "a": only one of the guessed a's can score
    expect(evaluate('aaxxx', 'abcde')).toEqual([
      'correct',
      'absent',
      'absent',
      'absent',
      'absent',
    ]);
    expect(evaluate('xxaax', 'abcde')).toEqual([
      'absent',
      'absent',
      'present',
      'absent',
      'absent',
    ]);
    // two a's in the answer: both guessed a's can score
    expect(evaluate('aaxxx', 'baxax')).toEqual([
      'present',
      'correct',
      'correct',
      'absent',
      'correct',
    ]);
  });

  it('gives an exact match priority over a misplaced one', () => {
    expect(evaluate('geese', 'eagle')).toEqual([
      'present',
      'present',
      'absent',
      'absent',
      'correct',
    ]);
  });
});

describe('keyboardStates', () => {
  it('keeps the best state seen for each letter', () => {
    const states = keyboardStates(['kotak', 'rumah'], 'rumah');
    expect(states.r).toBe('correct');
    expect(states.k).toBe('absent');
    expect(states.a).toBe('correct'); // present in "kotak", correct in "rumah"
  });
});
