import { fireEvent, render, screen, within } from '@testing-library/react';

import HongKongTable from '@/features/games/components/mahjong/HongKongTable';
import {
  hkMahjongGame,
  tableView,
} from '@/features/games/logic/hk-mahjong/game';

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

it('reorders the local rack and inspects only visible opponent tiles during play', () => {
  const state = hkMahjongGame.start(4, () => 0.5);
  const you = state.turn;
  const opponent = (you + 1) % 4;
  const names = ['Satu', 'Dua', 'Tiga', 'Empat'];
  state.players[you].hand = [0, 1, 2];
  state.drawn = 2;
  state.players[opponent] = { hand: [31], melds: [], flowers: [], river: [9] };
  const onPlay = jest.fn();
  render(
    <HongKongTable
      v={tableView(state, you)}
      you={you}
      names={names}
      onPlay={onPlay}
      busy={false}
    />,
  );
  const rack = screen.getByLabelText('Ubin kamu');
  const first = within(rack).getByRole('button', { name: 'Pilih 1 bambu' });
  fireEvent.click(first);
  fireEvent.click(screen.getByRole('button', { name: 'Geser ubin ke kanan' }));
  expect(within(rack).getAllByRole('button')[1]).toBe(first);
  fireEvent.click(screen.getByRole('button', { name: 'Buang 1 bambu' }));
  expect(onPlay).toHaveBeenCalledWith({
    type: 'discard',
    tile: 0,
    revision: state.revision,
  });

  const name = names[opponent];
  fireEvent.click(screen.getByRole('button', { name: `Lihat ubin ${name}` }));
  const details = screen.getByRole('region', { name });
  expect(within(details).getByText('1 ubin tertutup')).toBeVisible();
  expect(within(details).getAllByRole('img')).toHaveLength(1);
});

it('shows each remaining hand and waits after the current player votes', () => {
  const state = hkMahjongGame.start(4, () => 0.5);
  state.result = {
    kind: 'draw',
    seat: null,
    payer: null,
    score: null,
    deltas: [0, 0, 0, 0],
  };
  const names = ['Satu', 'Dua', 'Tiga', 'Empat'];
  const onPlay = jest.fn();
  const table = () => (
    <HongKongTable
      v={tableView(state, 0)}
      you={0}
      names={names}
      onPlay={onPlay}
      busy={false}
    />
  );
  const { rerender } = render(table());
  expect(screen.getAllByRole('group', { name: /Sisa ubin/ })).toHaveLength(4);
  fireEvent.click(
    screen.getByRole('button', { name: 'Siap untuk tangan berikutnya' }),
  );
  expect(onPlay).toHaveBeenCalledWith({
    type: 'next',
    revision: state.revision,
  });
  state.ready = [0];
  rerender(table());
  expect(screen.getByRole('button', { name: 'Sudah siap' })).toBeDisabled();
  expect(
    screen.getByText('1/4 siap. Menunggu Dua, Tiga, Empat.'),
  ).toBeVisible();
});
