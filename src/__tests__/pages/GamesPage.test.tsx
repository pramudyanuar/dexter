import { render, screen } from '@testing-library/react';

import GamesPage from '@/app/games/page';
import { GAMES } from '@/constant/games';

describe('Games menu', () => {
  beforeEach(() => {
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  it('is public: lists every game without asking for a session', () => {
    render(<GamesPage />);

    expect(screen.getByText(/Mau main apa/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Kode OTP/i)).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();

    for (const game of GAMES) {
      expect(
        screen.getByRole('link', { name: new RegExp(`^${game.title}:`) }),
      ).toHaveAttribute('href', game.href);
    }
  });

  it('includes the new games', () => {
    expect(GAMES.map((g) => g.id)).toEqual(
      expect.arrayContaining(['minesweeper', 'tetris', 'connect4']),
    );
    expect(new Set(GAMES.map((g) => g.href)).size).toBe(GAMES.length);
  });

  it('links home from the header without exposing the app launcher', () => {
    render(<GamesPage />);
    expect(screen.getByRole('link', { name: 'Beranda' })).toHaveAttribute(
      'href',
      '/',
    );
  });
});
