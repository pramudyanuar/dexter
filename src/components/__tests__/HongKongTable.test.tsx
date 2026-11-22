import { render, screen } from '@testing-library/react';

import { hkMahjongGame, tableView } from '@/lib/games/hk-mahjong/game';

import HongKongTable from '@/components/games/mahjong/HongKongTable';

it('shows all four seats without a player rack in the shared admin spectator view', () => {
  const state = hkMahjongGame.start(4, () => 0.5);
  render(
    <HongKongTable
      v={tableView(state, null)}
      you={-1}
      names={['Satu', 'Dua', 'Tiga', 'Empat']}
      busy={false}
      onPlay={jest.fn()}
    />,
  );
  for (const name of ['Satu', 'Dua', 'Tiga', 'Empat']) {
    expect(
      screen.getByRole('region', { name: new RegExp('^' + name + ',') }),
    ).toBeInTheDocument();
  }
  expect(screen.getAllByLabelText(/ubin tertutup/)).toHaveLength(4);
  expect(screen.queryByLabelText('Ubin kamu')).not.toBeInTheDocument();
});
