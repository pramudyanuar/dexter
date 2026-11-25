import { act, fireEvent, render, screen } from '@testing-library/react';

import MinesweeperPage from '@/app/games/minesweeper/page';

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
