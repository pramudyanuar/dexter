import { fireEvent, render, screen } from '@testing-library/react';

import Game2048Page from '@/app/games/2048/page';

it('accepts arrow keys while the restart button still has focus', async () => {
  render(<Game2048Page />);
  const restart = await screen.findByRole('button', { name: 'game baru' });
  restart.focus();
  fireEvent.click(restart);
  expect(restart).toHaveFocus();
  expect(fireEvent.keyDown(restart, { key: 'ArrowLeft' })).toBe(false);
  expect(fireEvent.keyDown(restart, { key: 'Enter' })).toBe(true);
});

it('undoes one step at a time, rerolls the tile, and allows undo after another move', () => {
  render(<Game2048Page />);
  const undo = screen.getByRole('button', { name: 'Undo' });
  const board = () =>
    screen.getAllByRole('gridcell').map((tile) => tile.textContent);
  const initial = board();
  expect(undo).toBeDisabled();

  const key = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].find(
    (key) => {
      fireEvent.keyDown(window, { key });
      return !undo.hasAttribute('disabled');
    },
  );
  expect(key).toBeDefined();
  const after = board();
  expect(after).not.toEqual(initial);
  fireEvent.click(undo);
  expect(board()).toEqual(initial);
  expect(undo).toBeDisabled();
  fireEvent.click(undo);
  expect(board()).toEqual(initial);
  fireEvent.keyDown(window, { key });
  expect(board()).not.toEqual(after);
  expect(undo).toBeEnabled();
  fireEvent.click(undo);
  expect(board()).toEqual(initial);
  expect(undo).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'game baru' }));
  expect(undo).toBeDisabled();
});
