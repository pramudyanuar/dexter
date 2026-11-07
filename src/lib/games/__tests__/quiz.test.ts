import { QUESTIONS } from '@/lib/games/data/quiz-bank';
import { quizGame, QuizState, QuizView, TOTAL } from '@/lib/games/quiz';

const start = (players = 3) => quizGame.start(players) as QuizState;
const right = (s: QuizState) => s.questions[s.idx].answer;

describe('quiz', () => {
  it('has a sound question bank', () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(TOTAL);
    for (const q of QUESTIONS) {
      expect(new Set(q.options).size).toBe(4);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(4);
    }
  });

  it('never leaks the answer in the view', () => {
    const s = start();
    const view = quizGame.view(s, 0) as QuizView;
    expect(JSON.stringify(view)).not.toContain('"answer"');
    expect(view.question?.options).toHaveLength(4);
  });

  it('waits for everyone, then scores by speed: 3, 2, 1', () => {
    let s = start(3);
    const a = right(s);
    s = quizGame.move(s, 2, { q: 0, choice: a }) as QuizState;
    s = quizGame.move(s, 0, { q: 0, choice: (a + 1) % 4 }) as QuizState;
    expect((quizGame.view(s, 0) as QuizView).idx).toBe(0);
    expect((quizGame.view(s, 0) as QuizView).answered).toEqual([
      true,
      false,
      true,
    ]);
    s = quizGame.move(s, 1, { q: 0, choice: a }) as QuizState;
    expect(s.idx).toBe(1);
    expect(s.scores).toEqual([0, 2, 3]);
    expect(s.last?.gains).toEqual([0, 2, 3]);
  });

  it('refuses double answers, stale questions and bad choices', () => {
    let s = start(2);
    s = quizGame.move(s, 0, { q: 0, choice: 1 }) as QuizState;
    expect(() => quizGame.move(s, 0, { q: 0, choice: 1 })).toThrow(
      /sudah menjawab/,
    );
    expect(() => quizGame.move(s, 1, { q: 5, choice: 1 })).toThrow(/berganti/);
    expect(() => quizGame.move(s, 1, { q: 0, choice: 9 })).toThrow(
      /tidak valid/,
    );
    expect(() => quizGame.move(s, 1, { q: 0, choice: -1 })).not.toThrow(); // timeout
  });

  it('finishes after all questions and names the winner', () => {
    let s = start(2);
    for (let i = 0; i < TOTAL; i++) {
      s = quizGame.move(s, 0, { q: i, choice: right(s) }) as QuizState;
      s = quizGame.move(s, 1, { q: i, choice: -1 }) as QuizState;
    }
    expect(quizGame.isOver(s)).toBe(true);
    expect(s.winners).toEqual([0]);
    expect((quizGame.view(s, 0) as QuizView).question).toBeNull();
  });
});
