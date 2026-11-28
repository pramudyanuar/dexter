import { fireEvent, render, screen } from '@testing-library/react';

import SnakeEntry from '@/features/games/components/snake/SnakeEntry';
import UnoEntry from '@/features/games/components/uno/UnoEntry';

jest.mock('@/features/games/components/GameShell', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/features/games/components/uno/UnoGame', () => ({
  __esModule: true,
  default: ({ game }: { game: string }) => (
    <div data-testid='uno-game'>{game}</div>
  ),
}));

describe('SnakeEntry', () => {
  it('renders all three Snake mode cards with their destinations', () => {
    render(<SnakeEntry />);

    expect(
      screen.getByRole('heading', { name: 'Pilih Mode Snake' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Classic/i })).toHaveAttribute(
      'href',
      '/games/snake/classic',
    );
    expect(screen.getByRole('link', { name: /Harian/i })).toHaveAttribute(
      'href',
      '/games/snake/daily',
    );
    expect(screen.getByRole('link', { name: /Duel/i })).toHaveAttribute(
      'href',
      '/games/snake/duel',
    );
    expect(screen.getByRole('link', { name: 'Leaderboard' })).toHaveAttribute(
      'href',
      '/games/leaderboard',
    );
  });
});

describe('UnoEntry', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('renders all three Uno mode cards and opens Classic in place', () => {
    render(<UnoEntry />);

    expect(
      screen.getByRole('heading', { name: 'Pilih Mode Uno' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Flip/i })).toHaveAttribute(
      'href',
      '/games/unoflip',
    );
    expect(screen.getByRole('link', { name: /No Mercy/i })).toHaveAttribute(
      'href',
      '/games/unomercy',
    );

    fireEvent.click(screen.getByRole('button', { name: /Classic/i }));
    expect(screen.getByTestId('uno-game')).toHaveTextContent('uno');
  });
});
