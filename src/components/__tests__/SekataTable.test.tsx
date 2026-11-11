import { fireEvent, render, screen, within } from '@testing-library/react';

import type { SekataView } from '@/lib/games/sekata';
import { DEFAULT_CONFIG } from '@/lib/games/sekata-config';
import type { RoomView } from '@/lib/rooms/types';

import SekataTable from '@/components/games/sekata/SekataTable';

const card = (id: string, text: string, kind = 'pink') => ({
  id,
  kind: kind as 'pink',
  text,
});

const baseView: SekataView = {
  config: DEFAULT_CONFIG,
  players: 3,
  you: 0,
  moderator: true,
  hand: [card('p1', 'ma'), card('p2', 'na'), card('p3', 'ku')],
  greens: [],
  counts: [3, 5, 6],
  greenCounts: [0, 0, 0],
  center: [card('p9', 'ta')],
  yellow: [card('y1', 'di', 'yellow')],
  drawCount: 80,
  usedCount: 0,
  words: [],
  scores: [0, 0, 0],
  stats: [
    { words: 0, cards: 0, invalid: 0 },
    { words: 0, cards: 0, invalid: 0 },
    { words: 0, cards: 0, invalid: 0 },
  ],
  stuck: [false, false, false],
  places: [],
  dropped: [],
  replacementsLeft: 0,
  cooling: false,
  reveals: 0,
  feed: [],
  timeLeft: null,
  startedAt: 0,
  endedAt: null,
  elapsed: 5,
  over: false,
  winner: null,
  loser: null,
  endReason: null,
  ranking: [],
};

const room = (state: SekataView): RoomView =>
  ({
    code: 'ABCDE',
    game: 'sekata',
    status: 'playing',
    seat: 0,
    joined: [true, true, true],
    names: ['Ani', 'Budi', 'Cici'],
    capacity: 10,
    minPlayers: 3,
    version: 1,
    state,
    options: state.config,
    out: [false, false, false],
    outWhy: [null, null, null],
    strikes: [0, 0, 0],
    maxStrikes: 3,
    host: 0,
    hostNotice: 0,
    leaving: [],
    waiting: null,
  }) as RoomView;

function setup(patch: Partial<SekataView> = {}) {
  const view = { ...baseView, ...patch };
  const r = {
    session: { code: 'ABCDE', token: 't', you: 0 },
    room: room(view),
    receivedAt: Date.now(),
    busy: false,
    error: '',
    move: jest.fn(),
    rematch: jest.fn(),
    leave: jest.fn(),
  };
  render(<SekataTable r={r as never} view={view} />);
  return r;
}

/** Taps a card in your hand (a picked card also shows up in the word tray). */
const tapCard = (label: string) =>
  fireEvent.click(
    within(screen.getByTestId('hand')).getByRole('button', {
      name: `Kartu ${label}`,
    }),
  );

describe('SekataTable', () => {
  beforeEach(() => {
    // the moderator's dictionary lookup
    global.fetch = jest.fn(() => new Promise(() => {})) as never;
  });

  it('shows your cards, the shared ones, and only counts for the others', () => {
    setup();
    const hand = within(screen.getByTestId('hand'));
    expect(hand.getAllByRole('button')).toHaveLength(3);
    expect(
      within(screen.getByTestId('center')).getByText('TA'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('yellow')).getByText('DI'),
    ).toBeInTheDocument();
    const others = within(screen.getByLabelText('Pemain lain'));
    expect(others.getByText('Budi')).toBeInTheDocument();
    expect(others.getByText('5')).toBeInTheDocument();
    expect(others.getByText('6')).toBeInTheDocument();
  });

  it('spells the word from the cards you pick, in order', () => {
    setup();
    tapCard('NA');
    tapCard('MA');
    expect(screen.getByTestId('preview')).toHaveTextContent('nama');
    // tapping a picked card takes it back out
    tapCard('NA');
    expect(screen.getByTestId('preview')).toHaveTextContent('ma');
  });

  it('sends the cards, not just the text, when you submit', () => {
    const r = setup();
    tapCard('MA');
    tapCard('NA');
    fireEvent.click(screen.getByRole('button', { name: 'KIRIM KATA' }));
    expect(r.move).toHaveBeenCalledWith({
      type: 'submit',
      cards: ['p1', 'p2'],
      fills: {},
      meaning: undefined,
    });
  });

  it('can build with the shared middle and yellow cards', () => {
    const r = setup();
    tapCard('KU');
    fireEvent.click(
      within(screen.getByTestId('yellow')).getByRole('button', {
        name: 'Kartu DI',
      }),
    );
    fireEvent.click(
      within(screen.getByTestId('center')).getByRole('button', {
        name: 'Kartu TA',
      }),
    );
    expect(screen.getByTestId('preview')).toHaveTextContent('kudita');
    fireEvent.click(screen.getByRole('button', { name: 'KIRIM KATA' }));
    expect(r.move).toHaveBeenCalledWith(
      expect.objectContaining({ cards: ['p3', 'y1', 'p9'] }),
    );
  });

  it('does not let you send without a card of your own, or with too few cards', () => {
    setup();
    const send = screen.getByRole('button', { name: 'KIRIM KATA' });
    expect(send).toBeDisabled();
    tapCard('MA');
    expect(send).toBeDisabled(); // one card is not a word
    fireEvent.click(
      within(screen.getByTestId('center')).getByRole('button', {
        name: 'Kartu TA',
      }),
    );
    expect(send).toBeEnabled();
    tapCard('MA'); // take your own card back out
    expect(send).toBeDisabled();
    expect(
      screen.getByText(/minimal satu kartu dari tanganmu/),
    ).toBeInTheDocument();
  });

  it('clears the selection', () => {
    setup();
    tapCard('MA');
    fireEvent.click(screen.getByRole('button', { name: 'Bersihkan' }));
    expect(screen.getByTestId('preview')).toHaveTextContent('…');
  });

  it('asks which syllable a joker stands for before it can be sent', () => {
    const r = setup({ greens: [card('g1', '', 'green')] });
    tapCard('MA');
    fireEvent.click(
      within(screen.getByTestId('greens')).getByRole('button', {
        name: /joker/i,
      }),
    );
    const send = screen.getByRole('button', { name: 'KIRIM KATA' });
    expect(send).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Suku kata joker'), {
      target: { value: 'NA' },
    });
    expect(screen.getByTestId('preview')).toHaveTextContent('mana');
    expect(send).toBeEnabled();
    fireEvent.click(send);
    expect(r.move).toHaveBeenCalledWith(
      expect.objectContaining({ cards: ['p1', 'g1'], fills: { g1: 'na' } }),
    );
  });

  it('wants the meaning in the vocabulary challenge', () => {
    setup({
      config: { ...DEFAULT_CONFIG, mode: 'vocabulary', needMeaning: true },
    });
    tapCard('MA');
    tapCard('NA');
    const send = screen.getByRole('button', { name: 'KIRIM KATA' });
    expect(send).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Arti kata'), {
      target: { value: 'di tempat yang mana' },
    });
    expect(send).toBeEnabled();
  });

  it('votes that everyone is stuck', () => {
    const r = setup({ stuck: [false, true, false] });
    const button = screen.getByRole('button', { name: /^Buntu 1\/3/ });
    fireEvent.click(button);
    expect(r.move).toHaveBeenCalledWith({ type: 'stuck' });
  });

  it('lets the moderator rule on a word waiting for a decision', () => {
    const r = setup({
      words: [
        {
          n: 1,
          seat: 1,
          word: 'maba',
          status: 'review',
          reason: 'Kata tidak ada di kamus, menunggu keputusan moderator.',
          points: 0,
          parts: [
            { text: 'ma', kind: 'pink', from: 'hand' },
            { text: 'ba', kind: 'pink', from: 'hand' },
          ],
          challengedBy: [],
          canChallenge: false,
        },
      ],
    });
    const panel = within(screen.getByLabelText('Menunggu keputusan'));
    fireEvent.click(panel.getByRole('button', { name: 'Terima' }));
    expect(r.move).toHaveBeenCalledWith({
      type: 'rule',
      n: 1,
      verdict: 'accept',
    });
    fireEvent.click(panel.getByRole('button', { name: 'Tolak' }));
    expect(r.move).toHaveBeenCalledWith({
      type: 'rule',
      n: 1,
      verdict: 'reject',
    });
  });

  it('leaves the ruling to the moderator for everyone else', () => {
    setup({
      moderator: false,
      words: [
        {
          n: 1,
          seat: 1,
          word: 'maba',
          status: 'review',
          points: 0,
          parts: [{ text: 'maba', kind: 'pink', from: 'hand' }],
          challengedBy: [],
          canChallenge: false,
        },
      ],
    });
    expect(screen.queryByRole('button', { name: 'Terima' })).toBeNull();
    expect(
      screen.getByText('Menunggu keputusan moderator'),
    ).toBeInTheDocument();
  });

  it("can challenge someone else's accepted word", () => {
    const r = setup({
      words: [
        {
          n: 4,
          seat: 2,
          word: 'kita',
          status: 'ok',
          points: 22,
          parts: [{ text: 'kita', kind: 'pink', from: 'hand' }],
          challengedBy: [],
          canChallenge: true,
        },
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tantang' }));
    expect(r.move).toHaveBeenCalledWith({ type: 'challenge', n: 4 });
  });

  it('shows the final ranking when the game is over', () => {
    const r = setup({
      over: true,
      winner: 1,
      endReason: 'finished',
      ranking: [1, 0, 2],
      counts: [3, 0, 6],
    });
    const dialog = within(
      screen.getByRole('dialog', { name: 'Hasil permainan' }),
    );
    expect(dialog.getByText('Budi menang')).toBeInTheDocument();
    expect(dialog.getAllByRole('row')).toHaveLength(4);
    fireEvent.click(dialog.getByRole('button', { name: 'Main lagi' }));
    expect(r.rematch).toHaveBeenCalled();
  });

  it('stops you playing once your hand is empty in elimination', () => {
    setup({ places: [0], hand: [] });
    expect(screen.getByText(/kamu aman/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'KIRIM KATA' })).toBeDisabled();
  });
});
