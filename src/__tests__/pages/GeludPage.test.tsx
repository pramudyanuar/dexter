import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import GeludPage from '@/app/games/gelud/page';
import useGeludPeer from '@/features/games/components/gelud/useGeludPeer';
import {
  createGeludState,
  type GeludRoomState,
} from '@/features/games/logic/gelud';
import { useRoom } from '@/features/rooms/useRoom';

jest.mock('@/features/rooms/useRoom');
jest.mock('@/features/games/components/gelud/useGeludPeer');
jest.mock('@/features/games/components/Confetti', () => () => null);
jest.mock(
  '@/features/games/components/GameShell',
  () =>
    ({ children }: { children: ReactNode }) =>
      children,
);
jest.mock('@/features/rooms/components/RoomChat', () => () => null);
jest.mock('@/features/rooms/components/RoomGate', () => ({
  __esModule: true,
  default: ({
    r,
    children,
  }: {
    r: { room: unknown; session: { you: number } };
    children: (props: { room: unknown; you: number }) => ReactNode;
  }) => children({ room: r.room, you: r.session.you }),
  Rematch: () => <button type='button'>Main lagi</button>,
}));

it('automatically retries saving the result and shows one result when saved', async () => {
  jest.useFakeTimers();
  const canvas = jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue(null);
  try {
    const moveOrThrow = jest
      .fn()
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce(undefined);
    const session = { code: 'ABCDE', token: 'guest', you: 1 };
    const room = {
      code: session.code,
      state: { winner: null, match: 3 } as GeludRoomState,
      names: ['Raka', 'Bima'],
    };
    jest.mocked(useRoom).mockReturnValue({
      session,
      room,
      moveOrThrow,
    } as unknown as ReturnType<typeof useRoom>);
    jest.mocked(useGeludPeer).mockReturnValue({
      connected: true,
      supported: true,
      timedOut: false,
      send: jest.fn(),
      retry: jest.fn(),
    });
    const view = render(<GeludPage />);
    expect(moveOrThrow).not.toHaveBeenCalled();
    const { onMessage } = jest.mocked(useGeludPeer).mock.lastCall![0];
    const state = {
      ...createGeludState('2p'),
      phase: 'match-over',
      winner: 1,
      banner: 'BIMA MENANG!',
    };
    await act(async () =>
      onMessage(JSON.stringify({ type: 'state', state, events: {} })),
    );
    expect(moveOrThrow).toHaveBeenCalledWith(
      { winner: 1, match: 3 },
      expect.any(AbortSignal),
    );
    expect(
      screen.getByText('Gagal menyimpan hasil. Mencoba lagi…'),
    ).toBeVisible();
    expect(screen.queryByText('Konfirmasi hasil')).not.toBeInTheDocument();

    await act(async () => jest.advanceTimersByTimeAsync(3000));
    expect(moveOrThrow).toHaveBeenCalledTimes(2);
    room.state = { ...room.state, winner: 1, reports: [1, 1] };
    view.rerender(<GeludPage />);
    expect(screen.getByRole('heading', { name: 'Kamu menang!' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Main lagi' })).toBeVisible();
    await act(async () => jest.advanceTimersByTimeAsync(3000));
    expect(moveOrThrow).toHaveBeenCalledTimes(2);
    view.unmount();
  } finally {
    canvas.mockRestore();
    jest.useRealTimers();
  }
});
