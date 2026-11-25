import { fireEvent, render, screen, within } from '@testing-library/react';

import { startArchive } from '@/lib/games/card-archive';

import CardArchivePage from '@/app/games/card-archive/page';

const runKey = 'card-archive-run';

afterEach(() => sessionStorage.removeItem(runKey));

it('lets players mark evidence, save a combination, and resume after a reload', () => {
  const initial = startArchive(3);
  initial.contracts[0] = 'red';
  initial.cards = ['S2', 'H2', 'D4', 'S8', 'C13', 'H3', 'D3', 'C5', 'C6'];
  sessionStorage.setItem(runKey, JSON.stringify(initial));

  const view = render(<CardArchivePage />);
  const cards = within(
    screen.getByRole('group', { name: 'Kartu tersedia' }),
  ).getAllByRole('button');
  const save = screen.getByRole('button', { name: 'Simpan kombinasi' });
  expect(save).toBeDisabled();
  cards.slice(0, 5).forEach((card) => fireEvent.click(card));
  fireEvent.click(screen.getByRole('button', { name: 'Bukti 0/2' }));
  cards.slice(5, 7).forEach((card) => fireEvent.click(card));
  expect(
    screen.getByText('One pair · 18 poin (+8 dari bukti)'),
  ).toBeInTheDocument();
  fireEvent.click(save);
  expect(screen.getByText('18 / 25 poin')).toBeInTheDocument();

  view.unmount();
  render(<CardArchivePage />);
  expect(screen.getByText('18 / 25 poin')).toBeInTheDocument();
});
