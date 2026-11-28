import { fireEvent, render, screen } from '@testing-library/react';

import PokerPage from '@/app/games/poker/page';
import { pokerGame, type PokerView } from '@/features/games/logic/poker';
import { join, newRoom, start, toView } from '@/features/rooms/engine';

jest.mock('next/navigation', () => ({
  usePathname: () => '/games/poker',
}));

it('renders the player’s hand and sends the selected action from the table', async () => {
  const originalFetch = global.fetch;
  const code = 'ABCDE';
  const token = 'player-a';
  const initial = start(
    join(newRoom('poker', code, token), null, 'player-b').room,
    token,
    () => 0.4,
  );
  const room = toView(initial, token);
  const view = room.state as PokerView;
  const moves: unknown[] = [];
  const reply = (data: unknown) => ({ ok: true, json: async () => data });
  sessionStorage.setItem(
    'room-session-poker',
    JSON.stringify({ code, token, you: 0 }),
  );
  global.fetch = jest.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith('/chat')) return reply({ messages: [] });
    if (options?.method === 'POST') {
      const body = JSON.parse(String(options.body));
      moves.push(body.move);
      const state = pokerGame.move(
        initial.state as ReturnType<typeof pokerGame.start>,
        0,
        body.move,
      );
      return reply({
        room: toView(
          { ...initial, state, version: initial.version + 1 },
          token,
        ),
      });
    }
    return reply({ changed: true, room });
  }) as unknown as typeof fetch;

  try {
    const { container } = render(<PokerPage />);
    const call = await screen.findByRole('button', { name: 'Call · 1' });
    expect(container.querySelectorAll('[data-card]')).toHaveLength(2);
    fireEvent.click(call);
    expect(await screen.findByText(/Giliran Pemain 2/)).toBeInTheDocument();
    expect(moves).toEqual([
      { type: 'call', hand: view.hand, turnNumber: view.turnNumber },
    ]);
  } finally {
    sessionStorage.removeItem('room-session-poker');
    global.fetch = originalFetch;
  }
});
