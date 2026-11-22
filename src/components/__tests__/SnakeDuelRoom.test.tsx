import { act, fireEvent, render, screen } from '@testing-library/react';

import { initialArena } from '@/lib/games/snake-duel';
import { DuelEvent, DuelView } from '@/lib/snake-duel/protocol';

import SnakeDuelRoom from '@/components/games/snake/SnakeDuelRoom';

it('receives arena state and sends player actions through the WebSocket', () => {
  const originalWebSocket = globalThis.WebSocket;
  class TestSocket {
    static OPEN = 1;
    static instances: TestSocket[] = [];
    readyState = TestSocket.OPEN;
    send = jest.fn();
    close = jest.fn();
    onopen?: () => void;
    onmessage?: (event: { data: string }) => void;

    constructor(readonly url: URL) {
      TestSocket.instances.push(this);
    }

    receive(event: DuelEvent) {
      this.onmessage?.({ data: JSON.stringify(event) });
    }
  }

  globalThis.WebSocket = TestSocket as unknown as typeof WebSocket;
  const canvas = jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue(null);
  const session = { code: 'ABCDE', seat: 0 as const, token: 'a'.repeat(32) };
  const onExit = jest.fn();
  const room: DuelView = {
    code: session.code,
    version: 1,
    now: Date.now(),
    players: [
      { name: 'Satu', online: true, ready: false },
      { name: 'Dua', online: true, ready: false },
    ],
    round: null,
  };
  const view = render(<SnakeDuelRoom session={session} onExit={onExit} />);
  try {
    const [ws] = TestSocket.instances;
    expect(ws.url.pathname).toBe('/api/snake/duel/socket');
    expect(ws.url.searchParams.get('room')).toBe(session.code);
    ws.onopen?.();
    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'hello', seat: 0, token: session.token }),
    );

    act(() => ws.receive({ type: 'state', room }));
    fireEvent.click(screen.getByRole('button', { name: 'Siap' }));
    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'ready', ready: true }),
    );

    act(() =>
      ws.receive({
        type: 'state',
        room: {
          ...room,
          version: 2,
          round: {
            id: 'round',
            phase: 'playing',
            nextAt: Date.now(),
            arena: initialArena(0),
          },
        },
      }),
    );
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'turn', dir: 'up', roundId: 'round', seq: 1 }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Keluar room' }));
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: 'leave' }));
    act(() => ws.receive({ type: 'left' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  } finally {
    view.unmount();
    globalThis.WebSocket = originalWebSocket;
    canvas.mockRestore();
  }
});
