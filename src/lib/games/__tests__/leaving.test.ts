/** @jest-environment node */
import {
  battleshipGame,
  BattleshipState,
  validFleet,
} from '@/lib/games/battleship';
import { checkersGame, CheckersState } from '@/lib/games/checkers';
import { chessGame, ChessState } from '@/lib/games/chess';
import { connect4Game, Connect4State } from '@/lib/games/connect4-online';
import { dominoGame, DominoState, set } from '@/lib/games/domino';
import { gomokuGame, GomokuState } from '@/lib/games/gomoku';
import { diceGame, DiceState } from '@/lib/games/liarsdice';
import { pictionaryGame, PictionaryState } from '@/lib/games/pictionary';
import { quizGame, QuizState } from '@/lib/games/quiz';
import { suitGame, SuitState } from '@/lib/games/suit';
import { deck, unoGame, UnoState } from '@/lib/games/uno';

const rng = () => 0.3;

describe('two-player boards: leaving hands the win to the other player', () => {
  it('connect4', () => {
    const s = connect4Game.start(2) as Connect4State;
    expect(connect4Game.waiting!(s)).toEqual({ seats: [0], seconds: 45 });
    const out = connect4Game.eliminate!(s, 0) as Connect4State;
    expect(out.winner).toBe(1);
    expect(connect4Game.isOver(out)).toBe(true);
    expect(connect4Game.waiting!(out)).toBeNull();
  });

  it('connect4 auto-plays a column that is not full', () => {
    let s = connect4Game.start(2) as Connect4State;
    // fill column 0 completely
    for (let i = 0; i < 6; i++) {
      s = connect4Game.move(s, s.turn, { col: 0 }) as Connect4State;
      if (s.status !== 'playing') break;
    }
    const move = connect4Game.autoMove!(s, s.turn, () => 0) as { col: number };
    expect(move.col).not.toBe(0);
    expect(() => connect4Game.move(s, s.turn, move)).not.toThrow();
  });

  it('suit waits only for players who have not picked, and plays a pick for them', () => {
    let s = suitGame.start(2) as SuitState;
    expect(suitGame.waiting!(s)?.seats).toEqual([0, 1]);
    s = suitGame.move(s, 1, { pick: 'batu' }) as SuitState;
    expect(suitGame.waiting!(s)?.seats).toEqual([0]);
    const move = suitGame.autoMove!(s, 0, rng) as { pick: string };
    expect(() => suitGame.move(s, 0, move)).not.toThrow();
    const out = suitGame.eliminate!(s, 0) as SuitState;
    expect(out.winner).toBe(1);
  });

  it('gomoku plays an empty point', () => {
    const s = gomokuGame.start(2) as GomokuState;
    const move = gomokuGame.autoMove!(s, 0, rng) as { r: number; c: number };
    expect(() => gomokuGame.move(s, 0, move)).not.toThrow();
    expect((gomokuGame.eliminate!(s, 1) as GomokuState).winner).toBe(0);
  });

  it('checkers plays a legal move, even mid-jump', () => {
    const s = checkersGame.start(2) as CheckersState;
    const move = checkersGame.autoMove!(s, 0, rng);
    expect(() => checkersGame.move(s, 0, move)).not.toThrow();
    expect((checkersGame.eliminate!(s, 0) as CheckersState).winner).toBe(1);
  });

  it('chess plays a legal move and records a resignation', () => {
    const s = chessGame.start(2) as ChessState;
    const move = chessGame.autoMove!(s, 0, rng);
    expect(() => chessGame.move(s, 0, move)).not.toThrow();
    const out = chessGame.eliminate!(s, 1) as ChessState;
    expect(out.status).toBe('resigned');
    expect(out.winner).toBe(0);
    expect(chessGame.isOver(out)).toBe(true);
  });

  it('battleship places a fleet, then fires at fresh squares', () => {
    let s = battleshipGame.start(2) as BattleshipState;
    expect(battleshipGame.waiting!(s)?.seats).toEqual([0, 1]);
    const place = battleshipGame.autoMove!(s, 0, Math.random) as {
      ships: unknown;
    };
    expect(validFleet(place.ships)).toBe(true);
    s = battleshipGame.move(s, 0, place, () => 0) as BattleshipState;
    expect(battleshipGame.waiting!(s)?.seats).toEqual([1]);
    s = battleshipGame.move(
      s,
      1,
      battleshipGame.autoMove!(s, 1),
      () => 0,
    ) as BattleshipState;
    expect(s.phase).toBe('battle');

    const shot = battleshipGame.autoMove!(s, s.turn, rng) as { type: string };
    expect(shot.type).toBe('fire');
    const after = battleshipGame.move(s, s.turn, shot) as BattleshipState;
    // it never aims at a square that was already shot
    const next = battleshipGame.autoMove!(after, after.turn, rng);
    expect(() => battleshipGame.move(after, after.turn, next)).not.toThrow();
    expect((battleshipGame.eliminate!(s, 0) as BattleshipState).winner).toBe(1);
  });
});

describe('uno', () => {
  const start = (n: number) => unoGame.start(n, rng) as UnoState;
  const cards = (s: UnoState) =>
    s.draw.length +
    s.discard.length +
    s.hands.reduce((n, h) => n + h.length, 0);

  it("returns a removed player's cards to the pile, keeping the deck whole", () => {
    const s = start(4);
    const out = unoGame.eliminate!(s, 2, rng) as UnoState;
    expect(out.hands[2]).toEqual([]);
    expect(out.dropped).toEqual([2]);
    expect(cards(out)).toBe(deck().length);
    expect(out.draw.length).toBe(s.draw.length + 7);
  });

  it('passes the turn on when the player whose turn it was is removed', () => {
    const s = start(4);
    const out = unoGame.eliminate!(s, s.turn, rng) as UnoState;
    expect(out.turn).not.toBe(s.turn);
    expect(out.dropped).not.toContain(out.turn);
  });

  it('skips removed players for the rest of the game', () => {
    let s = unoGame.eliminate!(start(3), 1, rng) as UnoState;
    // seat 0 draws and passes: next up must be seat 2, never 1
    s = { ...s, turn: 0 };
    const after = unoGame.move(s, 0, { type: 'draw' }, rng) as UnoState;
    const settled = after.pending
      ? (unoGame.move(after, 0, { type: 'pass' }, rng) as UnoState)
      : after;
    expect(settled.turn).toBe(2);
  });

  it('ends with the last player standing as winner, removed players ranked last', () => {
    let s = unoGame.eliminate!(start(3), 1, rng) as UnoState;
    expect(unoGame.isOver(s)).toBe(false);
    s = unoGame.eliminate!(s, 2, rng) as UnoState;
    expect(unoGame.isOver(s)).toBe(true);
    expect(s.winner).toBe(0);
    expect(s.places).toEqual([0, 1, 2]);
    expect(unoGame.waiting!(s)).toBeNull();
  });

  it('clears a pending draw of the removed player, and idle players draw then pass', () => {
    let s = start(3);
    s = { ...s, pending: { seat: s.turn, index: 0 } };
    expect(unoGame.autoMove!(s, s.turn)).toEqual({ type: 'pass' });
    const out = unoGame.eliminate!(s, s.turn, rng) as UnoState;
    expect(out.pending).toBeNull();
    expect(unoGame.autoMove!(start(3), 0)).toEqual({ type: 'draw' });
  });
});

describe("liar's dice", () => {
  const rigged = (dice: number[][]): DiceState => ({
    ...(diceGame.start(dice.length, () => 0) as DiceState),
    dice,
  });

  it('removes a player, passing the turn if it was theirs', () => {
    const s = rigged([
      [2, 3],
      [4, 4],
      [5, 6],
    ]);
    const out = diceGame.eliminate!(s, 0) as DiceState;
    expect(out.dice[0]).toEqual([]);
    expect(out.turn).toBe(1);
    expect(diceGame.isOver(out)).toBe(false);
  });

  it('declares the last player the winner', () => {
    const s = rigged([
      [2, 3],
      [4, 4],
    ]);
    const out = diceGame.eliminate!(s, 1) as DiceState;
    expect(out.winner).toBe(0);
    expect(diceGame.waiting!(out)).toBeNull();
  });

  it('auto-plays the smallest legal raise, or a call when the table is full', () => {
    const s = rigged([
      [2, 3],
      [4, 4],
    ]);
    expect(diceGame.autoMove!(s, 0)).toEqual({ type: 'bid', qty: 1, face: 2 });
    const bid = { ...s, bid: { qty: 2, face: 6, seat: 0 }, turn: 1 };
    expect(diceGame.autoMove!(bid, 1)).toEqual({
      type: 'bid',
      qty: 3,
      face: 1,
    });
    const max = { ...s, bid: { qty: 4, face: 6, seat: 0 }, turn: 1 };
    expect(diceGame.autoMove!(max, 1)).toEqual({ type: 'call' });
  });
});

describe('domino', () => {
  const start = (n: number) => dominoGame.start(n, rng) as DominoState;
  const tiles = (s: DominoState) =>
    s.boneyard.length +
    s.board.length +
    s.hands.reduce((n, h) => n + h.length, 0);

  it("puts a removed player's tiles back and skips them", () => {
    const s = start(3);
    const out = dominoGame.eliminate!(s, s.turn) as DominoState;
    expect(tiles(out)).toBe(set().length);
    expect(out.hands[s.turn]).toEqual([]);
    expect(out.turn).not.toBe(s.turn);
    expect(out.out?.[s.turn]).toBe(true);
  });

  it('ends with the last player standing', () => {
    let s = dominoGame.eliminate!(start(3), 1) as DominoState;
    s = dominoGame.eliminate!(s, 2) as DominoState;
    expect(s.status).toBe('won');
    expect(s.winner).toBe(0);
  });

  it('a blocked game ignores the empty hand of a removed player', () => {
    const s: DominoState = {
      ...start(3),
      hands: [[[0, 1]], [[4, 4]], [[2, 2]]],
      boneyard: [],
      board: [[5, 6]],
      out: [false, false, true],
      turn: 0,
    };
    let next = dominoGame.move(s, 0, { type: 'pass' }) as DominoState;
    next = dominoGame.move(next, 1, { type: 'pass' }) as DominoState;
    expect(next.status).toBe('blocked');
    expect(next.winner).toBe(0); // seat 2's empty hand did not win it
  });

  it('plays the first tile that fits, else draws, else passes', () => {
    const s: DominoState = {
      ...start(2),
      hands: [
        [
          [0, 1],
          [5, 2],
        ],
        [[3, 3]],
      ],
      boneyard: [[1, 1]],
      board: [[5, 6]],
      turn: 0,
    };
    expect(dominoGame.autoMove!(s, 0)).toEqual({
      type: 'play',
      index: 1,
      end: 'L',
    });
    expect(
      dominoGame.autoMove!({ ...s, hands: [[[0, 1]], [[3, 3]]] }, 0),
    ).toEqual({ type: 'draw' });
    expect(
      dominoGame.autoMove!(
        { ...s, hands: [[[0, 1]], [[3, 3]]], boneyard: [] },
        0,
      ),
    ).toEqual({ type: 'pass' });
  });
});

describe('quiz', () => {
  const start = (n: number) => quizGame.start(n, rng) as QuizState;

  it('stops waiting for a removed player and settles the question', () => {
    let s = start(3);
    s = quizGame.move(s, 0, {
      q: 0,
      choice: s.questions[0].answer,
    }) as QuizState;
    s = quizGame.move(s, 1, {
      q: 0,
      choice: s.questions[0].answer,
    }) as QuizState;
    expect(quizGame.waiting!(s)?.seats).toEqual([2]);

    const out = quizGame.eliminate!(s, 2) as QuizState;
    expect(out.idx).toBe(1); // everyone still here had answered, so it moved on
    expect(out.last?.answers[2]).toBe(-1);
    expect(out.scores[2]).toBe(0);
    // the removed seat is not waited for on the next question
    expect(quizGame.waiting!(out)?.seats).toEqual([0, 1]);
    expect((quizGame.view(out, 0) as { answered: boolean[] }).answered[2]).toBe(
      true,
    );
  });

  it('declares the last player the winner', () => {
    let s = start(2);
    s = quizGame.eliminate!(s, 0) as QuizState;
    expect(s.winners).toEqual([1]);
    expect(quizGame.isOver(s)).toBe(true);
  });

  it('auto-answers with nothing', () => {
    const s = start(2);
    expect(quizGame.autoMove!(s, 0)).toEqual({ q: 0, choice: -1 });
  });
});

describe('pictionary', () => {
  const start = (n: number) => pictionaryGame.start(n, rng) as PictionaryState;

  it('waits for a drawer who has not drawn, and skips the round for them', () => {
    const s = start(3);
    expect(pictionaryGame.waiting!(s)).toEqual({ seats: [0], seconds: 60 });
    expect(pictionaryGame.autoMove!(s, 0)).toEqual({ type: 'next', round: 0 });
    const drawing = pictionaryGame.move(s, 0, {
      type: 'stroke',
      id: 'a',
      color: 0,
      width: 0,
      pts: [1, 1],
    }) as PictionaryState;
    expect(pictionaryGame.waiting!(drawing)).toBeNull();
  });

  it('moves to the next drawer when the drawer is removed', () => {
    const s = start(3);
    const out = pictionaryGame.eliminate!(s, 0, rng) as PictionaryState;
    expect(out.round).toBe(1);
    expect(out.drawer).toBe(2); // seat 0 is out, so the rotation is [1, 2]
    expect(out.strokes).toEqual([]);
  });

  it('ends the round once every remaining guesser got it', () => {
    let s = start(3);
    s = pictionaryGame.move(s, 1, {
      type: 'guess',
      text: s.word,
    }) as PictionaryState;
    expect(s.round).toBe(0);
    // the other guesser leaves: all who remain have guessed
    const out = pictionaryGame.eliminate!(s, 2, rng) as PictionaryState;
    expect(out.round).toBe(1);
  });

  it('declares the last player the winner', () => {
    let s = start(2);
    s = pictionaryGame.eliminate!(s, 1, rng) as PictionaryState;
    expect(s.winners).toEqual([0]);
    expect(pictionaryGame.isOver(s)).toBe(true);
  });
});
