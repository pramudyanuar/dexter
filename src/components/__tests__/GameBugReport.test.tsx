import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { callRoom } from '@/lib/rooms/room-request';

import GameBugReport from '@/components/games/GameBugReport';

jest.mock('@/lib/rooms/room-request');

const request = jest.mocked(callRoom);
const sessionKey = 'room-session-connect4';

beforeEach(() => {
  sessionStorage.clear();
  request.mockReset();
});

it('offers reporting only when the player is in a room', () => {
  const { container } = render(<GameBugReport game='connect4' />);
  expect(container).toBeEmptyDOMElement();
});

it('captures the room on opening and sends the description with that draft', async () => {
  sessionStorage.setItem(
    sessionKey,
    JSON.stringify({ code: 'ABCDE', token: 'token', you: 0 }),
  );
  request.mockResolvedValue({ id: 'draft-id' });
  const { container } = render(<GameBugReport game='connect4' />);
  const dialog = container.querySelector('dialog')!;
  // jsdom lacks the native dialog methods.
  dialog.showModal = () => dialog.setAttribute('open', '');

  fireEvent.click(screen.getByRole('button', { name: 'Laporkan bug' }));
  expect(request).toHaveBeenCalledWith(
    '/api/rooms/ABCDE/bug-reports',
    expect.objectContaining({ token: 'token', body: { action: 'capture' } }),
  );
  const description = await screen.findByRole('textbox', {
    name: 'Apa yang terjadi?',
  });
  fireEvent.change(description, { target: { value: 'Papan macet' } });
  const submit = screen.getByRole('button', { name: 'Kirim laporan' });
  await waitFor(() => expect(submit).toBeEnabled());
  fireEvent.click(submit);

  expect(await screen.findByRole('status')).toHaveTextContent(
    'Laporan terkirim',
  );
  expect(request).toHaveBeenLastCalledWith(
    '/api/rooms/ABCDE/bug-reports',
    expect.objectContaining({
      token: 'token',
      body: { action: 'submit', description: 'Papan macet', id: 'draft-id' },
    }),
  );
});
