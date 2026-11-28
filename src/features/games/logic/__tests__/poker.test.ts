import {
  bestPokerHand,
  pokerGame,
  type PokerView,
} from '@/features/games/logic/poker';
import { seededRandom } from '@/features/games/logic/seeded-random';

type State = ReturnType<typeof pokerGame.start>;
const start = (players = 2) => pokerGame.start(players, seededRandom(42));
function move(state: State, type: string) {
  return pokerGame.move(state, state.turn!, {
    type,
    hand: state.hand,
    turnNumber: state.turnNumber,
  });
}

it('evaluates the highest five cards, including a low ace and two triplets', () => {
  expect(bestPokerHand(['S1', 'H2', 'C3', 'D4', 'S5', 'S13', 'H12'])).toEqual([
    4, 5,
  ]);
  expect(
    bestPokerHand(['S13', 'H13', 'D13', 'S10', 'H10', 'D10', 'S1']),
  ).toEqual([6, 13, 10]);
  expect(bestPokerHand(['S1', 'S10', 'S11', 'S12', 'S13', 'D4', 'C9'])).toEqual(
    [8, 14],
  );
});

it('hides all private cards except your own and gives the big blind their option', () => {
  const state = start();
  expect(pokerGame.view(state, 0)).toMatchObject({
    players: [{ cards: state.players[0].cards }, { cards: [] }],
    actions: ['call', 'raise', 'fold'],
    toCall: 1,
  });
  expect(pokerGame.view(state, null)).not.toHaveProperty('deck');
  expect(pokerGame.view(state, null)).toMatchObject({
    players: [{ cards: [] }, { cards: [] }],
  });
  const called = move(state, 'call');
  expect(called.street).toBe('pre-flop');
  expect(pokerGame.view(called, 1)).toMatchObject({
    actions: ['check', 'raise', 'fold'],
  });
  const flop = move(called, 'check');
  expect(flop).toMatchObject({ turn: 1, street: 'flop', pot: 4 });
  expect(flop.board).toHaveLength(3);
});

it('caps raises, deals all four stages, and keeps chips and cards consistent', () => {
  const state = start(6);
  let next = move(move(move(state, 'raise'), 'raise'), 'raise');
  expect(() => move(next, 'raise')).toThrow('Aksi poker tidak tersedia');
  const boardSizes = [next.board.length];
  for (let step = 0; step < 40 && next.turn !== null; step++) {
    const view = pokerGame.view(next, next.turn) as PokerView;
    const waiting = pokerGame.waiting!(next)!;
    expect(waiting.seats).toEqual([next.turn]);
    const current = next.street;
    next = move(next, view.toCall ? 'call' : 'check');
    if (next.street !== current) boardSizes.push(next.board.length);
  }
  expect(boardSizes).toEqual([0, 3, 4, 5]);
  expect(next.result).not.toBeNull();
  expect(
    new Set([...next.players.flatMap(({ cards }) => cards), ...next.board])
      .size,
  ).toBe(17);
  expect(next.players.reduce((sum, player) => sum + player.chips, 0)).toBe(600);
});

it('splits ties from the board and returns uncalled chips after a fold', () => {
  const state = start();
  const tied = move(
    {
      ...state,
      street: 'river',
      board: ['S1', 'S10', 'S11', 'S12', 'S13'],
      pending: [0],
      players: [
        { cards: ['H2', 'D3'], chips: 98, bet: 0, folded: false },
        { cards: ['H4', 'D5'], chips: 98, bet: 0, folded: false },
      ],
      pot: 4,
      betCount: 0,
    },
    'check',
  );
  expect(tied.result).toEqual({
    winners: [
      { seat: 1, chips: 2 },
      { seat: 0, chips: 2 },
    ],
    category: 8,
  });
  const folded = move(state, 'fold');
  expect(folded.result).toEqual({
    winners: [{ seat: 1, chips: 2 }],
    category: null,
  });
  expect(folded.players.map(({ chips }) => chips)).toEqual([99, 101]);
  expect(pokerGame.view(folded, 0)).toMatchObject({
    players: [{}, { cards: [] }],
  });
  const rematch = pokerGame.restart(folded, 2, seededRandom(12));
  expect(rematch).toMatchObject({ hand: 2, button: 1, turn: 1, pot: 3 });
});

it('retains the active turn when another player leaves and rejects a stale action', () => {
  const state = start(4);
  const after = pokerGame.eliminate!(state, 0);
  expect(after.turn).toBe(state.turn);
  expect(after.players[0].folded).toBe(true);
  expect(() =>
    pokerGame.move(after, after.turn!, {
      type: 'call',
      hand: state.hand,
      turnNumber: state.turnNumber,
    }),
  ).toThrow('Giliran poker sudah berubah');
});
