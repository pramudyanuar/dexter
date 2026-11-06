import { fireEvent, render, screen } from '@testing-library/react';

import WordlePage from '@/app/games/wordle/page';

const type = (word: string) => {
  for (const key of word) fireEvent.keyDown(window, { key });
  fireEvent.keyDown(window, { key: 'Enter' });
};

const tiles = (row: number) =>
  screen.getAllByRole('row')[row].querySelectorAll('[role=gridcell]');

describe('Wordle page', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      'wordle-game',
      JSON.stringify({ answer: 'rumah', guesses: [] }),
    );
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ authed: true }),
    }) as unknown as typeof fetch;
  });

  it('scores a guess, then wins and records the stats', async () => {
    render(<WordlePage />);
    await screen.findByRole('grid');

    type('kotak');
    expect(
      Array.from(tiles(0)).map((t) => t.getAttribute('data-state')),
    ).toEqual(['absent', 'absent', 'absent', 'correct', 'absent']);

    type('rumah');
    expect(
      await screen.findByText(/Benar! Selesai dalam 2 tebakan/),
    ).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('wordle-stats')!)).toEqual({
      played: 1,
      won: 1,
      streak: 1,
      best: 1,
    });
  });

  it('refuses a short word without using a guess', async () => {
    render(<WordlePage />);
    await screen.findByRole('grid');

    type('abc');
    expect(await screen.findByText('Kurang huruf')).toBeInTheDocument();
    expect(tiles(1)[0].getAttribute('data-state')).toBe('empty');
  });

  it('rejects a string that is not a word, without using a guess', async () => {
    render(<WordlePage />);
    await screen.findByRole('grid');

    type('zzzzz');
    expect(
      await screen.findByText('Bukan kata dalam kamus'),
    ).toBeInTheDocument();
    expect(tiles(0)[0].getAttribute('data-state')).toBe('typing');
    expect(localStorage.getItem('wordle-stats')).toBeNull();

    // the typed letters stay, so one backspace fixes a typo
    fireEvent.keyDown(window, { key: 'Backspace' });
    expect(tiles(0)[4].getAttribute('data-state')).toBe('empty');
  });

  it('reveals the answer after six misses and resets the streak', async () => {
    localStorage.setItem(
      'wordle-stats',
      JSON.stringify({ played: 3, won: 3, streak: 3, best: 3 }),
    );
    render(<WordlePage />);
    await screen.findByRole('grid');

    for (const w of ['kotak', 'bunga', 'malam', 'tidur', 'makan', 'pagar']) {
      type(w);
    }
    expect(await screen.findByText('rumah')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('wordle-stats')!)).toEqual({
      played: 4,
      won: 3,
      streak: 0,
      best: 3,
    });

    // no more input once the game is over
    type('rumah');
    expect(JSON.parse(localStorage.getItem('wordle-stats')!).played).toBe(4);
  });
});
