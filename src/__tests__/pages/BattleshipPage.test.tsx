import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';

import BattleshipPage from '@/app/games/battleship/page';
import {
  battleshipGame,
  BattleshipView,
  FLEET,
  shipCells,
  validFleet,
} from '@/features/games/logic/battleship';

const mockMove = jest.fn();
let mockState: BattleshipView;

jest.mock('@/features/rooms/useRoom', () => ({
  useRoom: () => ({ move: mockMove, busy: false }),
}));

jest.mock('@/features/rooms/components/RoomGate', () => ({
  __esModule: true,
  default: ({
    children,
  }: {
    children: (props: {
      room: { state: BattleshipView };
      you: number;
    }) => ReactNode;
  }) => children({ room: { state: mockState }, you: 0 }),
  Rematch: () => null,
}));

beforeEach(() => {
  mockMove.mockClear();
  mockState = battleshipGame.view(battleshipGame.start(2), 0) as BattleshipView;
});

it('places and rotates ships manually, then can submit a random preset', () => {
  render(<BattleshipPage />);
  const ready = screen.getByRole('button', { name: 'Siap tempur' });
  const cell = (label: string) =>
    within(screen.getByRole('grid', { name: 'armadamu' })).getByRole(
      'gridcell',
      { name: label },
    );
  expect(ready).toBeDisabled();
  fireEvent.click(
    screen.getByRole('button', { name: 'Putar kapal, mendatar' }),
  );
  fireEvent.click(cell('A7'));
  expect(
    screen.getByText('Kapal bertumpuk atau melewati batas papan.'),
  ).toBeVisible();
  fireEvent.click(cell('A1'));
  expect(cell('A5, kapal')).toBeVisible();
  expect(cell('B1')).toBeVisible();
  expect(screen.getByText('1/5 kapal terpasang')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Acak armada' }));
  expect(ready).toBeEnabled();
  fireEvent.click(ready);
  const submitted = mockMove.mock.calls[0][0];
  expect(submitted.type).toBe('place');
  expect(validFleet(submitted.ships)).toBe(true);
  expect(submitted.ships).toHaveLength(FLEET.length);
});

it('draws the full hull as sunk when its last segment is hit', () => {
  const ship = { x: 1, y: 1, len: 2, horizontal: true };
  mockState = {
    ...mockState,
    phase: 'battle',
    turn: 1,
    revealed: [ship],
    myShots: shipCells(ship).map((cell) => ({ ...cell, hit: true })),
    last: { seat: 0, x: 2, y: 1, hit: true, sunk: 2 },
  };
  render(<BattleshipPage />);
  const enemy = within(screen.getByRole('grid', { name: 'perairan lawan' }));
  expect(enemy.getAllByRole('gridcell', { name: /tenggelam/ })).toHaveLength(2);
});
