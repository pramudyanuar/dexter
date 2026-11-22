import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import { DUEL_ROOMS_URL } from '@/lib/snake-duel/protocol';

import SnakeDuelLobby from '@/components/games/snake/SnakeDuelLobby';

jest.mock('next/navigation', () => ({
  usePathname: () => '/games/snake/duel',
}));

it('uses the duel room list and joins from the shared lobby', async () => {
  const session = { code: 'ABCDE', seat: 1, token: 'a'.repeat(32) };
  const fetchRooms = jest.fn((_url: string, init?: RequestInit) =>
    Promise.resolve({
      ok: true,
      json: async () =>
        init?.method === 'POST'
          ? { session }
          : {
              rooms: [
                { code: 'ABCDE', hostName: 'Teman', players: 1, capacity: 2 },
              ],
            },
    }),
  );
  global.fetch = fetchRooms as unknown as typeof fetch;
  const onEnter = jest.fn();
  render(<SnakeDuelLobby invite='' onEnter={onEnter} />);

  expect(
    screen.getByRole('checkbox', { name: /Room publik/ }),
  ).not.toBeChecked();
  expect(screen.getByRole('button', { name: 'Cari lawan' })).toBeDisabled();
  const host = await screen.findByText('Teman');
  const listed = within(host.closest('li')!);
  expect(listed.getByText('1/2 pemain')).toBeInTheDocument();

  fireEvent.change(screen.getByRole('textbox', { name: 'Username' }), {
    target: { value: '  Pemain   Baru ' },
  });
  fireEvent.click(listed.getByRole('button', { name: 'Gabung' }));
  await waitFor(() => expect(onEnter).toHaveBeenCalledWith(session));
  expect(fetchRooms).toHaveBeenCalledWith(
    DUEL_ROOMS_URL,
    expect.objectContaining({ method: 'GET' }),
  );
  const request = fetchRooms.mock.calls.find(
    ([, init]) => init?.method === 'POST',
  );
  expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
    action: 'join',
    code: 'ABCDE',
    name: 'Pemain Baru',
  });
});
