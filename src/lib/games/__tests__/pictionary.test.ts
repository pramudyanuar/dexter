import { WORDS } from '@/lib/games/data/words';
import {
  pictionaryGame,
  PictionaryState,
  PictionaryView,
} from '@/lib/games/pictionary';

const start = (players = 3) =>
  pictionaryGame.start(players, () => 0) as PictionaryState;

describe('pictionary', () => {
  it('has no duplicate words', () => {
    expect(new Set(WORDS).size).toBe(WORDS.length);
  });

  it('shows the word only to the drawer', () => {
    const s = start();
    const drawer = pictionaryGame.view(s, s.drawer) as PictionaryView;
    const guesser = pictionaryGame.view(s, 1) as PictionaryView;
    expect(drawer.word).toBe(s.word);
    expect(guesser.word).toBeNull();
    expect(JSON.stringify(guesser)).not.toContain(`"${s.word}"`);
    expect(guesser.hint.replace(/[ _/-]/g, '')).toBe('');
  });

  it('lets only the drawer draw, and merges points into the same stroke', () => {
    let s = start();
    const stroke = {
      type: 'stroke',
      id: 'a',
      color: 1,
      width: 0,
      pts: [10, 10, 20, 20],
    };
    expect(() => pictionaryGame.move(s, 1, stroke)).toThrow(/penggambar/i);
    s = pictionaryGame.move(s, 0, stroke) as PictionaryState;
    s = pictionaryGame.move(s, 0, {
      ...stroke,
      pts: [30, 30],
    }) as PictionaryState;
    s = pictionaryGame.move(s, 0, { ...stroke, id: 'b' }) as PictionaryState;
    expect(s.strokes).toHaveLength(2);
    expect(s.strokes[0].pts).toEqual([10, 10, 20, 20, 30, 30]);
    s = pictionaryGame.move(s, 0, { type: 'clear' }) as PictionaryState;
    expect(s.strokes).toEqual([]);
  });

  it('rejects malformed strokes', () => {
    const s = start();
    const bad = (extra: object) =>
      expect(() =>
        pictionaryGame.move(s, 0, {
          type: 'stroke',
          id: 'a',
          color: 0,
          width: 0,
          pts: [1, 1],
          ...extra,
        }),
      ).toThrow(/tidak valid/);
    bad({ pts: [1, 2, 3] });
    bad({ pts: [5000, 1] });
    bad({ color: 99 });
    bad({ width: -1 });
  });

  it('scores correct guesses without echoing the word, and ends the round when all solved', () => {
    let s = start(3);
    const word = s.word;
    s = pictionaryGame.move(s, 1, {
      type: 'guess',
      text: 'salah banget',
    }) as PictionaryState;
    expect(s.guesses.at(-1)).toMatchObject({
      correct: false,
      text: 'salah banget',
    });
    expect(() =>
      pictionaryGame.move(s, 0, { type: 'guess', text: word }),
    ).toThrow(/penggambar/i);

    s = pictionaryGame.move(s, 1, {
      type: 'guess',
      text: ` ${word.toUpperCase()} `,
    }) as PictionaryState;
    expect(s.scores).toEqual([1, 3, 0]);
    expect(s.guesses.at(-1)).toMatchObject({ correct: true, text: '' });
    expect(() =>
      pictionaryGame.move(s, 1, { type: 'guess', text: word }),
    ).toThrow(/sudah/);

    s = pictionaryGame.move(s, 2, {
      type: 'guess',
      text: word,
    }) as PictionaryState;
    expect(s.scores).toEqual([2, 3, 2]);
    expect(s.round).toBe(1);
    expect(s.drawer).toBe(1);
    expect(s.last?.word).toBe(word);
    expect(s.strokes).toEqual([]);
  });

  it('moves on when time runs out, ignoring stale timeouts, and finishes the game', () => {
    let s = start(2);
    expect(() => pictionaryGame.move(s, 0, { type: 'next', round: 3 })).toThrow(
      /berganti/,
    );
    for (let i = 0; i < s.rounds; i++) {
      s = pictionaryGame.move(s, 1, {
        type: 'next',
        round: i,
      }) as PictionaryState;
    }
    expect(pictionaryGame.isOver(s)).toBe(true);
    expect(s.winners).toEqual([0, 1]);
    expect(new Set(s.used).size).toBe(s.used.length);
  });
});
