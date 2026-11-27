import { act, fireEvent, render, screen } from '@testing-library/react';

import { newGame, reveal } from '@/lib/games/minesweeper';
import { seededRandom } from '@/lib/games/seeded-random';

import MinesweeperPage from '@/app/games/minesweeper/page';

it('places reveal effects at the clicked or detonated square and clears them on restart', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ seed: 222, ticket: 'test' }),
  });

  try {
    render(<MinesweeperPage />);
    const cells = screen.getAllByRole('gridcell');
    fireEvent.click(cells[0]);
    await screen.findByText('Permainan berlangsung');
    const initial = reveal(newGame('mudah'), 0, 0, seededRandom(222));
    const grid = screen.getByRole('grid');
    expect(grid.querySelector('[data-reveal-pulse="safe"]')).toHaveStyle({
      gridColumn: '1 / span 1',
      gridRow: '1 / span 1',
    });
    const lifted = initial.cells.findIndex(
      (cell, i) => i > 0 && cell.state === 'open',
    );
    expect(
      parseInt(cells[lifted].style.getPropertyValue('--reveal-delay'), 10),
    ).toBeGreaterThan(0);
    const impact = initial.cells.findIndex((cell) => cell.mine);
    fireEvent.click(cells[impact]);
    await screen.findByText('Ranjau meledak');

    expect(cells[impact]).toHaveAttribute('data-detonated', 'true');
    expect(cells[impact].style.getPropertyValue('--reveal-delay')).toBe('0ms');
    expect(grid.querySelector('[data-reveal-pulse="mine"]')).toHaveStyle({
      gridColumn: `${(impact % initial.width) + 1} / span 1`,
      gridRow: `${Math.floor(impact / initial.width) + 1} / span 1`,
    });
    const following = cells.filter(
      (cell) => cell !== cells[impact] && cell.dataset.mine,
    );
    expect(following).toHaveLength(initial.mines - 1);
    expect(
      following.every(
        (cell) =>
          parseInt(cell.style.getPropertyValue('--reveal-delay'), 10) > 0,
      ),
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Main lagi' }));
    expect(grid.querySelectorAll('[data-reveal-pulse]')).toHaveLength(0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

it('keeps the selected difficulty labeled and renders both flag animation states', () => {
  render(<MinesweeperPage />);
  const medium = screen.getByRole('button', { name: 'sedang' });
  fireEvent.click(medium);
  expect(medium).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getAllByRole('gridcell')).toHaveLength(144);

  const cell = screen.getByRole('gridcell', { name: 'Baris 1, kolom 1' });
  fireEvent.contextMenu(cell);
  expect(cell).toHaveAccessibleName('Baris 1, kolom 1, bendera');
  expect(cell.querySelector('svg')).toHaveAttribute('data-exiting', 'false');
  fireEvent.contextMenu(cell);
  expect(cell).toHaveAccessibleName('Baris 1, kolom 1');
  expect(cell.querySelector('svg')).toHaveAttribute('data-exiting', 'true');
});

it('places one flag when a long press also triggers the system context menu', async () => {
  jest.useFakeTimers();
  try {
    render(<MinesweeperPage />);
    const cell = await screen.findByRole('gridcell', {
      name: 'Baris 1, kolom 1',
    });
    fireEvent.touchStart(cell);
    fireEvent.contextMenu(cell);
    act(() => jest.advanceTimersByTime(500));
    fireEvent.touchEnd(cell);
    fireEvent.click(cell);
    expect(cell).toHaveAttribute('data-state', 'flag');
  } finally {
    jest.useRealTimers();
  }
});

it('moves keyboard focus across the grid and flags the focused square', () => {
  render(<MinesweeperPage />);
  const initial = screen.getByRole('gridcell', { name: 'Baris 1, kolom 1' });
  const below = screen.getByRole('gridcell', { name: 'Baris 2, kolom 1' });
  act(() => initial.focus());
  fireEvent.keyDown(initial, { key: 'ArrowDown' });
  expect(below).toHaveFocus();
  expect(initial).toHaveAttribute('tabindex', '-1');
  fireEvent.keyDown(below, { key: 'f' });
  expect(below).toHaveAccessibleName('Baris 2, kolom 1, bendera');
  expect(screen.getByText('009')).toBeVisible();
});
