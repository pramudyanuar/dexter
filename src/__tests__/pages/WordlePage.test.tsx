import { fireEvent, render, screen, waitFor } from '@testing-library/react';

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
    sessionStorage.clear();
    sessionStorage.setItem(
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
    expect(await screen.findByText(/Kalah\. Jawabannya/)).toBeInTheDocument();
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

  it('keeps the game in this tab only, so another tab starts its own', async () => {
    render(<WordlePage />);
    await screen.findByRole('grid');

    type('kotak');
    expect(JSON.parse(sessionStorage.getItem('wordle-game')!).guesses).toEqual([
      'kotak',
    ]);
    // nothing about the game in progress is shared through localStorage
    expect(localStorage.getItem('wordle-game')).toBeNull();
  });

  describe('the meaning of the word', () => {
    const definition = (extra: object = {}) => ({
      word: 'rumah',
      lang: 'id',
      defLang: 'id',
      entries: [{ pos: 'Nomina', definitions: ['tempat tinggal'] }],
      source: 'Wiktionary Indonesia',
      url: 'https://id.wiktionary.org/wiki/rumah',
      ...extra,
    });
    const serve = (reply: () => unknown) => {
      global.fetch = jest.fn(async (url: string) => ({
        ok: true,
        json: async () =>
          String(url).includes('/api/define') ? reply() : { authed: true },
      })) as unknown as typeof fetch;
    };

    it('is shown when you win', async () => {
      serve(() => definition());
      render(<WordlePage />);
      await screen.findByRole('grid');
      type('rumah');

      expect(await screen.findByText('tempat tinggal')).toBeInTheDocument();
      expect(screen.getByText('Nomina')).toBeInTheDocument();
      expect(
        screen.getByText(/Sumber: Wiktionary Indonesia/),
      ).toBeInTheDocument();
      const call = (global.fetch as jest.Mock).mock.calls.find(([u]) =>
        String(u).includes('/api/define'),
      );
      expect(call[0]).toBe('/api/define?word=rumah&lang=id');
    });

    it('is shown when you lose too', async () => {
      serve(() => definition());
      render(<WordlePage />);
      await screen.findByRole('grid');
      for (const w of ['kotak', 'bunga', 'malam', 'tidur', 'makan', 'pagar'])
        type(w);

      expect(await screen.findByText('tempat tinggal')).toBeInTheDocument();
    });

    it('is not asked for while the game is still on', async () => {
      serve(() => definition());
      render(<WordlePage />);
      await screen.findByRole('grid');
      type('kotak');
      expect(screen.queryByLabelText('Arti kata')).not.toBeInTheDocument();
      expect(
        (global.fetch as jest.Mock).mock.calls.some(([u]) =>
          String(u).includes('/api/define'),
        ),
      ).toBe(false);
    });

    it('says so when no dictionary knows the word', async () => {
      serve(() => definition({ entries: [] }));
      render(<WordlePage />);
      await screen.findByRole('grid');
      type('rumah');

      expect(await screen.findByText(/Belum ada definisi/)).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'Cari di KBBI' }),
      ).toHaveAttribute('href', 'https://id.wiktionary.org/wiki/rumah');
    });

    it('explains when the meaning is only available in English', async () => {
      serve(() =>
        definition({
          defLang: 'en',
          entries: [{ pos: 'Noun', definitions: ['house'] }],
        }),
      );
      render(<WordlePage />);
      await screen.findByRole('grid');
      type('rumah');

      expect(await screen.findByText('house')).toBeInTheDocument();
      expect(
        screen.getByText(/ditulis dalam bahasa Inggris/),
      ).toBeInTheDocument();
    });

    it('lets you try again when the lookup could not be done', async () => {
      let calls = 0;
      serve(() => (++calls === 1 ? { error: 'down' } : definition()));
      render(<WordlePage />);
      await screen.findByRole('grid');
      type('rumah');

      fireEvent.click(await screen.findByRole('button', { name: 'Coba lagi' }));
      expect(await screen.findByText('tempat tinggal')).toBeInTheDocument();
    });
  });

  describe('English', () => {
    beforeEach(() => {
      sessionStorage.setItem(
        'wordle-game-en',
        JSON.stringify({ answer: 'crane', guesses: [] }),
      );
      global.fetch = jest.fn(async (url: string) => ({
        ok: true,
        json: async () =>
          String(url).includes('/api/define')
            ? {
                word: 'crane',
                lang: 'en',
                defLang: 'en',
                entries: [
                  { pos: 'noun', definitions: ['A large wading bird.'] },
                ],
                source: 'Free Dictionary API',
                url: 'https://en.wiktionary.org/wiki/crane',
              }
            : { authed: true },
      })) as unknown as typeof fetch;
    });

    it('plays in English with its own game and record, and shows the English meaning', async () => {
      render(<WordlePage />);
      await screen.findByRole('grid');

      fireEvent.click(screen.getByRole('button', { name: 'English' }));
      expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );

      // the English dictionary is fetched on first use; wait until it accepts a word
      await waitFor(() => {
        type('crane');
        expect(screen.queryByText(/Memuat kamus/)).not.toBeInTheDocument();
        expect(
          screen.getByText(/Benar! Selesai dalam 1 tebakan/),
        ).toBeInTheDocument();
      });

      expect(
        await screen.findByText('A large wading bird.'),
      ).toBeInTheDocument();
      expect(
        (global.fetch as jest.Mock).mock.calls.some(
          ([u]) => u === '/api/define?word=crane&lang=en',
        ),
      ).toBe(true);
      expect(JSON.parse(localStorage.getItem('wordle-stats-en')!).won).toBe(1);
      // the Indonesian game and record are untouched
      expect(localStorage.getItem('wordle-stats')).toBeNull();
      expect(
        JSON.parse(sessionStorage.getItem('wordle-game')!).guesses,
      ).toEqual([]);
    });

    it('does not accept Indonesian words when playing in English', async () => {
      render(<WordlePage />);
      await screen.findByRole('grid');
      fireEvent.click(screen.getByRole('button', { name: 'English' }));

      await waitFor(() => {
        type('rumah');
        expect(screen.getByText('Bukan kata dalam kamus')).toBeInTheDocument();
      });
      expect(
        JSON.parse(sessionStorage.getItem('wordle-game-en')!).guesses,
      ).toEqual([]);
    });

    it('remembers the language you picked', async () => {
      const first = render(<WordlePage />);
      await screen.findByRole('grid');
      fireEvent.click(screen.getByRole('button', { name: 'English' }));
      first.unmount();

      render(<WordlePage />);
      await screen.findByRole('grid');
      expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
  });
});
