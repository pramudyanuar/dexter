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
