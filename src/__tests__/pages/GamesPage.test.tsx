import { act, fireEvent, render, screen } from '@testing-library/react';

import GamesPage from '@/app/games/page';
import { GAMES } from '@/constant/games';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

describe('Games menu', () => {
  beforeEach(() => {
    push.mockClear();
    localStorage.clear();
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  it('is public: lists every game without asking for a session', () => {
    render(<GamesPage />);

    expect(screen.getByRole('heading', { name: 'Games' })).toBeInTheDocument();
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

  it('filters between solo games and the ones played with friends', () => {
    render(<GamesPage />);
    expect(screen.getAllByRole('listitem')).toHaveLength(GAMES.length);

    fireEvent.click(screen.getByRole('button', { name: /^Sendiri/ }));
    expect(screen.getAllByRole('listitem')).toHaveLength(
      GAMES.filter((g) => !g.online).length,
    );
    expect(screen.queryByRole('link', { name: /^Chess:/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^Bareng teman/ }));
    expect(screen.getAllByRole('listitem')).toHaveLength(
      GAMES.filter((g) => g.online).length,
    );
    expect(screen.getByRole('link', { name: /^Chess:/ })).toBeInTheDocument();
  });

  it('keeps English game names as they are', () => {
    expect(GAMES.map((g) => g.title)).toEqual(
      expect.arrayContaining([
        'Snake',
        'Battleship',
        'Checkers',
        'Chess',
        "Liar's Dice",
        'Quiz',
        'Pictionary',
      ]),
    );
  });

  it('has a drawing for every game', () => {
    const { container } = render(<GamesPage />);
    expect(container.querySelectorAll('li svg')).toHaveLength(GAMES.length);
  });

  it('offers to continue the game played last', () => {
    localStorage.setItem('last-game', JSON.stringify('chess'));
    render(<GamesPage />);

    expect(
      screen.getByRole('link', { name: /Lanjut main Chess/ }),
    ).toHaveAttribute('href', '/games/chess');
  });

  it('has no way "back" from the menu, since it is the front page', () => {
    render(<GamesPage />);
    expect(screen.queryByRole('link', { name: 'Beranda' })).toBeNull();
  });

  it('opens the launcher on three quick taps of the title, not fewer', () => {
    jest.useFakeTimers();
    render(<GamesPage />);
    const title = screen.getByRole('heading', { name: 'Games' });

    fireEvent.click(title);
    fireEvent.click(title);
    expect(push).not.toHaveBeenCalled();
    fireEvent.click(title);
    expect(push).toHaveBeenCalledWith('/apps');

    // slow taps do not count
    push.mockClear();
    for (let i = 0; i < 3; i++) {
      fireEvent.click(title);
      act(() => {
        jest.advanceTimersByTime(1000);
      });
    }
    expect(push).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});
