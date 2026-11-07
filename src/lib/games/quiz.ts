import { type Question, QUESTIONS } from '@/lib/games/data/quiz-bank';
import { shuffle } from '@/lib/games/uno';
import type { GameDef } from '@/lib/rooms/game';
import { RoomError } from '@/lib/rooms/types';

export const TOTAL = 10;

export interface QuizResult {
  q: string;
  options: Question['options'];
  correct: number;
  /** Each seat's choice, -1 when they ran out of time */
  answers: number[];
  gains: number[];
}

export interface QuizState {
  players: number;
  questions: Question[];
  idx: number;
  /** Seat -> choice for the current question, null while pending */
  answers: (number | null)[];
  /** Seats in the order they answered */
  order: number[];
  scores: number[];
  last: QuizResult | null;
  /** Seats with the top score once all questions are done */
  winners: number[] | null;
}

export interface QuizView {
  players: number;
  idx: number;
  total: number;
  question: { q: string; options: Question['options'] } | null;
  myAnswer: number | null;
  answered: boolean[];
  scores: number[];
  last: QuizResult | null;
  winners: number[] | null;
}

function fresh(players: number, rng: () => number = Math.random): QuizState {
  return {
    players,
    questions: shuffle([...QUESTIONS], rng).slice(0, TOTAL),
    idx: 0,
    answers: Array(players).fill(null),
    order: [],
    scores: Array(players).fill(0),
    last: null,
    winners: null,
  };
}

/** Faster correct answers earn more: 3, 2, then 1 point. */
const pointsFor = (place: number) => Math.max(1, 3 - place);

export const quizGame: GameDef<QuizState> = {
  id: 'quiz',
  minPlayers: 2,
  maxPlayers: 6,
  autoStart: false,

  start: fresh,
  restart: (_previous, players, rng) => fresh(players, rng),

  move(state, seat, move) {
    const m = move as { q?: unknown; choice?: unknown } | null;
    // a late answer for a question that already moved on is simply refused
    if (m?.q !== state.idx) throw new RoomError('Soal sudah berganti', 409);
    const choice = m.choice;
    if (
      typeof choice !== 'number' ||
      !Number.isInteger(choice) ||
      choice < -1 ||
      choice > 3
    )
      throw new RoomError('Jawaban tidak valid');
    if (state.answers[seat] !== null)
      throw new RoomError('Kamu sudah menjawab', 409);

    const answers = [...state.answers];
    answers[seat] = choice;
    const order = [...state.order, seat];
    if (answers.some((a) => a === null)) return { ...state, answers, order };

    // everyone is in: score by speed, then move on
    const question = state.questions[state.idx];
    const gains = Array(state.players).fill(0);
    let place = 0;
    for (const s of order) {
      if (answers[s] === question.answer) gains[s] = pointsFor(place++);
    }
    const scores = state.scores.map((n, i) => n + gains[i]);
    const last: QuizResult = {
      q: question.q,
      options: question.options,
      correct: question.answer,
      answers: answers as number[],
      gains,
    };

    const idx = state.idx + 1;
    if (idx >= state.questions.length) {
      const top = Math.max(...scores);
      return {
        ...state,
        idx,
        answers: Array(state.players).fill(null),
        order: [],
        scores,
        last,
        winners: scores.flatMap((n, i) => (n === top ? [i] : [])),
      };
    }
    return {
      ...state,
      idx,
      answers: Array(state.players).fill(null),
      order: [],
      scores,
      last,
    };
  },

  view(state, seat): QuizView {
    const current = state.questions[state.idx];
    return {
      players: state.players,
      idx: state.idx,
      total: state.questions.length,
      // the right answer stays on the server until the question is over
      question:
        state.winners || !current
          ? null
          : { q: current.q, options: current.options },
      myAnswer: seat === null ? null : state.answers[seat],
      answered: state.answers.map((a) => a !== null),
      scores: state.scores,
      last: state.last,
      winners: state.winners,
    };
  },

  isOver: (state) => state.winners !== null,
};
