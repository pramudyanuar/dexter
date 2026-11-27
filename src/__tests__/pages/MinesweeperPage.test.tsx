import { act, fireEvent, render, screen } from '@testing-library/react';

import MinesweeperPage from '@/app/games/minesweeper/page';

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
