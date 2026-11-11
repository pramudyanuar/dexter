import { fireEvent, render, screen, within } from '@testing-library/react';

import { remoGame, RemoState, RemoView, start } from '@/lib/games/remo';
import { makeDeck } from '@/lib/games/remo-cards';
import type { RemoConfig } from '@/lib/games/remo-config';
import type { RoomView } from '@/lib/rooms/types';

import RemoTable from '@/components/games/remo/RemoTable';

// the game's moves copy the state, and jsdom has no structuredClone
global.structuredClone = ((v: unknown) =>
  JSON.parse(JSON.stringify(v))) as never;

const ids = (s: string) => s.split(' ').filter(Boolean);

function table(
  hands: string[],
  cfg: Partial<RemoConfig> = {},
  tweak: (s: RemoState) => void = () => {},
  you = 0,
) {
  const s = start(hands.length, () => 0.1, cfg);
  const taken = new Set(hands.flatMap(ids));
  taken.add('D12');
  s.hands = hands.map(ids);
  s.discard = ['D12'];
  s.draw = makeDeck(s.config.jokers).filter((c) => !taken.has(c));
  s.turn = 0;
  s.starter = 0;
  s.phase = 'draw';
  tweak(s);
  const view = remoGame.view(s, you) as RemoView;
  const room = {
    code: 'ABCDE',
    game: 'remo',
    status: 'playing',
    seat: you,
    joined: Array(hands.length).fill(true),
    names: ['Ani', 'Budi', 'Cici', 'Dodi'].slice(0, hands.length),
    capacity: 4,
    minPlayers: 2,
    version: 1,
    state: view,
    options: s.config,
    out: Array(hands.length).fill(false),
    outWhy: Array(hands.length).fill(null),
    strikes: Array(hands.length).fill(0),
    maxStrikes: 3,
    host: 0,
    hostNotice: 0,
    leaving: [],
    waiting: null,
  } as unknown as RoomView;
  const r = {
    session: { code: 'ABCDE', token: 't', you },
    room,
    receivedAt: Date.now(),
    busy: false,
    error: '',
    move: jest.fn(),
    rematch: jest.fn(),
    leave: jest.fn(),
  };
  render(<RemoTable r={r as never} view={view} />);
  return r;
}

const hand = () => within(screen.getByTestId('hand'));
const tap = (name: string) =>
  fireEvent.click(hand().getByRole('button', { name }));
const action = (name: string) => screen.getByRole('button', { name });

const MELDS = 'S3 S4 S5 H9 D2 C6 C7';
const OTHER = 'H1 H2 H3 D9 D10 C1 C2';

describe('RemoTable', () => {
  it('shows your cards and only the number of the others', () => {
    table([MELDS, OTHER, 'S9 H9 D9 C9 S10 H10 D11']);
    expect(hand().getAllByRole('button')).toHaveLength(7);
    const others = within(screen.getByLabelText('Other players'));
    expect(others.getByText('Budi')).toBeInTheDocument();
    expect(others.getByText('Cici')).toBeInTheDocument();
    expect(others.getAllByText('7')).toHaveLength(2);
    // none of their cards are on the page
    for (const c of ids(OTHER))
      expect(document.querySelector(`[data-card="${c}"]`)).toBeNull();
  });

  it('starts a turn with a draw, and only a draw', () => {
    const r = table([MELDS, OTHER]);
    expect(screen.getByTestId('turn')).toHaveTextContent('draw a card');
    expect(action('Draw')).toBeEnabled();
    expect(action('Take discard')).toBeEnabled();
    expect(action('Create Sequence')).toBeDisabled();
    expect(action('Create Set')).toBeDisabled();
    expect(action('Lay Down')).toBeDisabled();
    expect(action('Discard')).toBeDisabled();
    fireEvent.click(action('Draw'));
    expect(r.move).toHaveBeenCalledWith({ type: 'draw', from: 'pile' });
    fireEvent.click(action('Take discard'));
    expect(r.move).toHaveBeenCalledWith({ type: 'draw', from: 'discard' });
  });

  it('can draw by clicking the piles', () => {
    const r = table([MELDS, OTHER]);
    fireEvent.click(screen.getByRole('button', { name: 'Draw from the pile' }));
    expect(r.move).toHaveBeenCalledWith({ type: 'draw', from: 'pile' });
    fireEvent.click(
      within(screen.getByLabelText('Table')).getByRole('button', {
        name: 'Q ♦',
      }),
    );
    expect(r.move).toHaveBeenLastCalledWith({ type: 'draw', from: 'discard' });
  });

  it('after the draw, the other actions open up and the draw closes', () => {
    table([MELDS, OTHER], {}, (s) => {
      s.phase = 'play';
    });
    expect(screen.getByTestId('turn')).toHaveTextContent(
      'lay down cards, then discard',
    );
    expect(action('Draw')).toBeDisabled();
    expect(action('Take discard')).toBeDisabled();
    expect(document.querySelector('[data-step="Meld"]')).toHaveAttribute(
      'data-active',
      'true',
    );
    expect(document.querySelector('[data-step="Draw"]')).toHaveAttribute(
      'data-active',
      'false',
    );
  });

  it('is not your turn: nothing to press, and it says whose turn it is', () => {
    table([MELDS, OTHER], {}, () => {}, 1);
    expect(screen.getByTestId('turn')).toHaveTextContent("Ani's turn");
    for (const n of [
      'Draw',
      'Take discard',
      'Create Sequence',
      'Create Set',
      'Lay Down',
      'Discard',
    ]) {
      expect(action(n)).toBeDisabled();
    }
    expect(screen.getByText(/Waiting for Ani/)).toBeInTheDocument();
  });

  describe('making combinations', () => {
    const play = (hands = [MELDS, OTHER], cfg: Partial<RemoConfig> = {}) =>
      table(hands, cfg, (s) => {
        s.phase = 'play';
      });

    it('shows what the picked cards make, and enables the right button', () => {
      play();
      tap('3 ♠');
      tap('4 ♠');
      expect(action('Create Sequence')).toBeDisabled(); // two cards
      tap('5 ♠');
      expect(screen.getByTestId('preview')).toHaveTextContent(
        'A valid sequence',
      );
      expect(action('Create Sequence')).toBeEnabled();
      expect(action('Create Set')).toBeDisabled();
      expect(action('Lay Down')).toBeEnabled();
    });

    it('lays down a sequence', () => {
      const r = play();
      for (const c of ['3 ♠', '4 ♠', '5 ♠']) tap(c);
      fireEvent.click(action('Create Sequence'));
      expect(r.move).toHaveBeenCalledWith({
        type: 'meld',
        cards: ['S3', 'S4', 'S5'],
        kind: 'sequence',
        as: {},
      });
    });

    it('lays down a set', () => {
      const r = play(['S9 H9 D9 H1 D2 C6 C7', OTHER]);
      for (const c of ['9 ♠', '9 ♥', '9 ♦']) tap(c);
      expect(screen.getByTestId('preview')).toHaveTextContent('A valid set');
      expect(action('Create Sequence')).toBeDisabled();
      fireEvent.click(action('Create Set'));
      expect(r.move).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'meld',
          kind: 'set',
          cards: ['S9', 'H9', 'D9'],
        }),
      );
    });

    it('says why cards are not a combination, and will not lay them', () => {
      play();
      for (const c of ['3 ♠', '4 ♠', '9 ♥']) tap(c);
      expect(screen.getByTestId('preview')).toHaveTextContent(
        /Not a combination/,
      );
      expect(action('Lay Down')).toBeDisabled();
      expect(action('Create Sequence')).toBeDisabled();
    });

    it('lets you take a card back out of the picked ones', () => {
      play();
      for (const c of ['3 ♠', '4 ♠', '5 ♠']) tap(c);
      tap('5 ♠');
      expect(action('Create Sequence')).toBeDisabled();
    });

    it('discards exactly one picked card', () => {
      const r = play();
      tap('9 ♥');
      expect(action('Discard')).toBeEnabled();
      tap('6 ♣');
      expect(action('Discard')).toBeDisabled();
      tap('6 ♣');
      fireEvent.click(action('Discard'));
      expect(r.move).toHaveBeenCalledWith({ type: 'discard', card: 'H9' });
    });

    it('will not let you put back the card you just took', () => {
      table([MELDS, OTHER], {}, (s) => {
        s.phase = 'play';
        s.hands[0].push('D12');
        s.discard = [];
        s.took = 'D12';
      });
      tap('Q ♦');
      expect(action('Discard')).toBeDisabled();
      expect(screen.getByText(/just took that card/)).toBeInTheDocument();
      tap('Q ♦');
      tap('9 ♥');
      expect(action('Discard')).toBeEnabled();
    });

    it('wants an opening of the right size', () => {
      play(['S3 S4 S5 H9 D2 C6 C7', OTHER], { initialMeld: 30 });
      for (const c of ['3 ♠', '4 ♠', '5 ♠']) tap(c);
      expect(screen.getByTestId('preview')).toHaveTextContent(
        'worth 12, you need 30',
      );
    });
  });

  describe('jokers', () => {
    it('shows what a joker stands for', () => {
      table(['S3 X1 S5 H9 D2 C6 C7', OTHER], { jokers: 2 }, (s) => {
        s.phase = 'play';
      });
      for (const c of ['3 ♠', 'Joker', '5 ♠']) tap(c);
      expect(screen.getByTestId('preview')).toHaveTextContent('joker as 4♠');
    });

    it('asks which card a joker is when it could be two', () => {
      const r = table(['S5 S6 X1 H9 D2 C6 C7', OTHER], { jokers: 2 }, (s) => {
        s.phase = 'play';
      });
      for (const c of ['5 ♠', '6 ♠', 'Joker']) tap(c);
      const choice = screen.getByText('The joker stands for:').parentElement!;
      fireEvent.click(within(choice).getByRole('button', { name: '7♠' }));
      fireEvent.click(action('Create Sequence'));
      expect(r.move).toHaveBeenCalledWith(
        expect.objectContaining({ as: { X1: { rank: 7, suit: 'S' } } }),
      );
    });
  });

  describe('the table', () => {
    const laid = (s: RemoState) => {
      s.phase = 'play';
      s.opened[0] = true;
      s.melds = [
        {
          id: 1,
          seat: 1,
          kind: 'sequence',
          cards: [5, 6, 7].map((rank) => ({
            id: `S${rank}`,
            rank,
            suit: 'S' as const,
            joker: false,
          })),
        },
      ];
    };

    it("shows everyone's combinations, with who laid them", () => {
      table(['S4 H9 D2 C6 C7 S1 S2', 'S5 S6 S7 D10 C1 C2 H2'], {}, laid);
      const meld = within(screen.getByTestId('melds'));
      expect(meld.getAllByRole('listitem')).toHaveLength(1);
      expect(meld.getByText(/sequence · Budi/)).toBeInTheDocument();
      expect(meld.getAllByLabelText(/♠/)).toHaveLength(3);
    });

    it('offers to add a card that fits, and sends the layoff', () => {
      const r = table(['S4 H9 D2 C6 C7 S1 S2', 'H4 D10 C1 C2 H2'], {}, laid);
      expect(screen.queryByRole('button', { name: '+ Add here' })).toBeNull();
      tap('4 ♠');
      fireEvent.click(screen.getByRole('button', { name: '+ Add here' }));
      expect(r.move).toHaveBeenCalledWith({
        type: 'layoff',
        card: 'S4',
        meld: 1,
      });
    });

    it('does not offer a card that does not fit', () => {
      table(['S4 H9 D2 C6 C7 S1 S2', 'H4 D10 C1 C2 H2'], {}, laid);
      tap('9 ♥');
      expect(screen.queryByRole('button', { name: '+ Add here' })).toBeNull();
    });

    it('does not offer adding until you have laid down yourself, or when it is off', () => {
      table(['S4 H9 D2 C6 C7 S1 S2', 'H4 D10 C1 C2 H2'], {}, (s) => {
        laid(s);
        s.opened[0] = false;
      });
      tap('4 ♠');
      expect(screen.queryByRole('button', { name: '+ Add here' })).toBeNull();
    });

    it('shows a joker as the card it stands for', () => {
      table(['S4 H9 D2 C6 C7 S1 S2', 'H4 D10 C1 C2 H2'], { jokers: 1 }, (s) => {
        laid(s);
        s.melds[0].cards[1] = { id: 'X1', rank: 6, suit: 'S', joker: true };
      });
      expect(
        within(screen.getByTestId('melds')).getByLabelText('Joker as 6 ♠'),
      ).toBeInTheDocument();
    });
  });

  it('can end a turn when the last card may not be discarded', () => {
    const r = table(['H9', OTHER], { finish: 'melded' }, (s) => {
      s.phase = 'play';
    });
    expect(action('Discard')).toBeDisabled();
    tap('9 ♥');
    expect(action('Discard')).toBeDisabled();
    fireEvent.click(action('End turn'));
    expect(r.move).toHaveBeenCalledWith({ type: 'pass' });
  });

  it('sorts the hand by suit and by rank', () => {
    table(['H5 S9 C2 S2 D7 H1 C13', OTHER]);
    const order = () =>
      hand()
        .getAllByRole('button')
        .map((b) => b.getAttribute('data-card'));
    fireEvent.click(action('Sort by rank'));
    expect(order()).toEqual(
      ['H1', 'S2', 'C2', 'H5', 'D7', 'S9', 'C13'].map((c) => c),
    ); // ranked
    fireEvent.click(action('Sort by suit'));
    expect(order()).toEqual(['S2', 'S9', 'H1', 'H5', 'D7', 'C2', 'C13']);
  });

  it('shows the rules', () => {
    table([MELDS, OTHER]);
    fireEvent.click(screen.getByRole('button', { name: 'Rules' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Rules' }));
    expect(dialog.getByText('How to play Remo')).toBeInTheDocument();
    expect(dialog.getByText('Cards each')).toBeInTheDocument();
    fireEvent.click(dialog.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the round result with every hand, and goes on to the next round', () => {
    const r = table(
      ['H9', 'S1 S5 C13', 'X1 H7'],
      { mode: 'point', rounds: 3, jokers: 1 },
      (s) => {
        s.roundOver = true;
        s.roundWinner = 0;
        s.roundReason = 'out';
        s.roundPenalty = [0, 26, 27];
        s.totals = [0, 26, 27];
        s.hands[0] = [];
      },
    );
    const dialog = within(screen.getByRole('dialog', { name: 'Round result' }));
    expect(dialog.getByText('You went out!')).toBeInTheDocument();
    expect(dialog.getByText(/\+26/)).toBeInTheDocument();
    expect(dialog.getAllByText(/pts left/)).toHaveLength(2);
    fireEvent.click(dialog.getByRole('button', { name: 'Next Round' }));
    expect(r.move).toHaveBeenCalledWith({ type: 'next' });
    expect(dialog.queryByRole('button', { name: 'Play Again' })).toBeNull();
  });

  it('shows the match result with the final ranking', () => {
    const r = table(['H9', 'S1 S5 C13'], { mode: 'point', rounds: 1 }, (s) => {
      s.roundOver = true;
      s.over = true;
      s.winners = [0];
      s.roundWinner = 0;
      s.roundReason = 'out';
      s.roundPenalty = [0, 16];
      s.totals = [0, 16];
      s.hands[0] = [];
    });
    const dialog = within(screen.getByRole('dialog', { name: 'Match result' }));
    expect(dialog.getByText('You win the match!')).toBeInTheDocument();
    fireEvent.click(dialog.getByRole('button', { name: 'Play Again' }));
    expect(r.rematch).toHaveBeenCalled();
    fireEvent.click(dialog.getByRole('button', { name: 'Back to lobby' }));
    expect(r.leave).toHaveBeenCalled();
  });
});
