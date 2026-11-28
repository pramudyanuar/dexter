import { act, fireEvent, render, screen } from '@testing-library/react';

import SnakeDuelRoom from '@/features/games/components/snake/SnakeDuelRoom';
import { DUEL_TICK_MS, initialArena } from '@/features/games/logic/snake-duel';
import { DuelMessage } from '@/features/snake-duel/messages';

class TestChannel extends EventTarget {
  readyState = 'open';
  bufferedAmount = 0;
  send = jest.fn();

  receive(event: DuelMessage) {
    this.dispatchEvent(
      new MessageEvent('message', { data: JSON.stringify(event) }),
    );
  }
}

it('sends ready, turns, and leave over the WebRTC data channel', () => {
  const canvas = jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue(null);
  const channel = new TestChannel();
  const peer = { close: jest.fn() };
  const onExit = jest.fn();
  const view = render(
    <SnakeDuelRoom
      seat={1}
      names={['Satu', 'Dua']}
      channel={channel as unknown as RTCDataChannel}
      peer={peer as unknown as RTCPeerConnection}
      onExit={onExit}
    />,
  );
  try {
    expect(screen.getByRole('button', { name: 'Siap' })).toBeDisabled();
    act(() =>
      channel.receive({
        type: 'state',
        frame: { ready: [false, false], round: null },
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Siap' }));
    expect(channel.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'ready', ready: true }),
    );

    act(() =>
      channel.receive({
        type: 'state',
        frame: {
          ready: [false, false],
          round: {
            id: 1,
            phase: 'playing',
            stepInMs: DUEL_TICK_MS,
            turns: [null, null],
            arena: initialArena(0),
          },
        },
      }),
    );
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(channel.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'turn', id: 1, dir: 'up' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Keluar duel' }));
    expect(channel.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'leave' }),
    );
    expect(onExit).toHaveBeenCalledTimes(1);

    act(() => channel.receive({ type: 'leave' }));
    expect(screen.getByRole('status')).toHaveTextContent(
      'Lawan keluar. Duel selesai.',
    );
    expect(
      screen.queryByRole('button', { name: 'Siap' }),
    ).not.toBeInTheDocument();
    expect(peer.close).toHaveBeenCalledTimes(1);
  } finally {
    view.unmount();
    canvas.mockRestore();
  }
});
