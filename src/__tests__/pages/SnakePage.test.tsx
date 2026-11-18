import { act, fireEvent, render, screen } from '@testing-library/react';

import SnakePage from '@/app/games/snake/page';

jest.mock('@/components/games/GameShell', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));

describe('Snake Classic', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    jest.spyOn(Math, 'random').mockReturnValue(208.1 / 397);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('can be played and paused through its visible controls', () => {
    localStorage.setItem('snake-best', '12');
    render(<SnakePage />);
    expect(screen.getByText('12')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mulai' }));
    fireEvent.click(screen.getByRole('button', { name: 'Jeda' }));
    act(() => jest.advanceTimersByTime(2000));
    expect(screen.getByText('Permainan dijeda.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Lanjut' }));
    act(() => jest.advanceTimersByTime(2000));
    expect(screen.getByText('Game over. Skor 1.')).toBeInTheDocument();
  });

  it('leaves normal typing and Enter available to the score form', () => {
    render(<SnakePage />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    act(() => jest.advanceTimersByTime(2000));
    const name = screen.getByPlaceholderText('Namamu...');
    expect(fireEvent.keyDown(name, { key: 'w' })).toBe(true);
    expect(fireEvent.keyDown(name, { key: ' ' })).toBe(true);
    expect(fireEvent.keyDown(name, { key: 'Enter' })).toBe(true);
    expect(name).toBeInTheDocument();
    expect(localStorage.getItem('snake-best')).toBe('1');
  });
});
