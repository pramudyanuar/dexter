import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { StrictMode } from 'react';

import GamesPage from '@/app/games/page';
import { GAMES } from '@/features/games/catalog';
import RememberGame from '@/features/games/components/RememberGame';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/games',
  useSearchParams: () => new URLSearchParams(),
}));

describe('Games menu', () => {
  beforeEach(() => {
    push.mockClear();
    localStorage.clear();
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  it('counts game visits once under Strict Mode and again after a new launch', () => {
    const launch = () =>
      render(
        <StrictMode>
          <RememberGame id='dart' />
        </StrictMode>,
      );
    launch().unmount();
    expect(JSON.parse(localStorage.getItem('game-visits')!).dart.count).toBe(1);
    launch();
    expect(JSON.parse(localStorage.getItem('game-visits')!).dart.count).toBe(2);
    expect(localStorage.getItem('last-game')).toBe(JSON.stringify('dart'));
  });

  it('is public: lists every game without asking for a session', () => {
    render(<GamesPage />);

    expect(
      screen.getByRole('heading', { name: 'Dexter Arcade' }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/Kode OTP/i)).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();

    const library = within(screen.getByRole('list', { name: 'Daftar game' }));
    for (const game of GAMES) {
      expect(
        library.getByRole('link', { name: `Main ${game.title}` }),
      ).toHaveAttribute('href', game.href);
      expect(
        library.getByRole('link', { name: `Info ${game.title}` }),
      ).toHaveAttribute('href', `/games/info/${game.id}`);
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
      GAMES.filter((g) => !g.online || g.solo).length,
    );
    expect(screen.queryByRole('link', { name: 'Main Chess' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^Bareng teman/ }));
    expect(screen.getAllByRole('listitem')).toHaveLength(
      GAMES.filter((g) => g.online).length,
    );
    expect(
      screen.getByRole('link', { name: 'Main Chess' }),
    ).toBeInTheDocument();
  });

  it('combines search and category and lets a player recover from zero results', () => {
    render(<GamesPage />);
    const search = screen.getByRole('searchbox', { name: 'Cari game' });
    fireEvent.change(search, { target: { value: 'trívia' } });
    expect(screen.getByRole('link', { name: 'Main Quiz' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Board' }));
    expect(screen.getByText('Tidak ada game yang cocok.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reset pencarian' }));
    expect(search).toHaveValue('');
    expect(screen.getAllByRole('listitem')).toHaveLength(GAMES.length);
  });

  it('uses actual browser history for the recent and popular shelves', () => {
    localStorage.setItem(
      'game-visits',
      JSON.stringify({
        chess: { count: 8, lastOpenedAt: 100 },
        dart: { count: 2, lastOpenedAt: 200 },
      }),
    );
    render(<GamesPage />);
    const recent = within(
      screen.getByRole('region', { name: 'Terakhir dibuka' }),
    );
    const popular = within(
      screen.getByRole('region', { name: 'Populer di perangkat ini' }),
    );
    expect(recent.getAllByRole('link')[0]).toHaveAccessibleName(
      'Lanjut main Dart',
    );
    expect(popular.getAllByRole('link')[0]).toHaveTextContent('Chess');
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
    expect(container.querySelectorAll('li [role="presentation"]')).toHaveLength(
      GAMES.length,
    );
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
    const title = screen.getByRole('heading', { name: 'Dexter Arcade' });

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
