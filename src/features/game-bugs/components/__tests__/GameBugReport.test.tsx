import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { usePathname } from 'next/navigation';

import GameBugReport from '@/features/game-bugs/components/GameBugReport';
import { callRoom } from '@/features/rooms/room-request';

jest.mock('@/features/rooms/room-request');
jest.mock('next/navigation', () => ({ usePathname: jest.fn() }));

const request = jest.mocked(callRoom);
const sessionKey = 'room-session-connect4';

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  jest.mocked(usePathname).mockReturnValue('/games/connect4');
  request.mockReset();
});

function openReport(game = 'connect4') {
  const { container } = render(<GameBugReport game={game} />);
  const dialog = container.querySelector('dialog')!;
  // jsdom lacks the native dialog methods.
  dialog.showModal = () => dialog.setAttribute('open', '');
  dialog.close = () => dialog.removeAttribute('open');
  fireEvent.click(screen.getByRole('button', { name: 'Laporkan bug' }));
}

it('reports a solo game with its mode and saved player name', async () => {
  jest.mocked(usePathname).mockReturnValue('/games/snake/classic');
  localStorage.setItem('player-name', JSON.stringify('Budi'));
  request.mockResolvedValue({ id: 'report-id' });
  openReport('snake');
  expect(request).not.toHaveBeenCalled();
  expect(screen.getByText('Snake Classic')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: 'Apa yang terjadi?' }), {
    target: { value: 'Papan macet' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Kirim laporan' }));
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Laporan terkirim',
  );
  expect(request).toHaveBeenCalledWith(
    '/api/game-bugs',
    expect.objectContaining({
      body: {
        pathname: '/games/snake/classic',
        description: 'Papan macet',
        playerName: 'Budi',
        requestId: expect.any(String),
      },
    }),
  );
});

it('captures the room on opening and sends the description with that draft', async () => {
  sessionStorage.setItem(
    sessionKey,
    JSON.stringify({ code: 'ABCDE', token: 'token', you: 0 }),
  );
  request.mockResolvedValue({ id: 'draft-id' });
  openReport();
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

it('keeps the description when the player reports without an unavailable snapshot', async () => {
  sessionStorage.setItem(
    sessionKey,
    JSON.stringify({ code: 'ABCDE', token: 'token', you: 0 }),
  );
  request.mockRejectedValueOnce(new Error('Room sudah tidak tersedia.'));
  request.mockResolvedValueOnce({ id: 'report-id' });
  openReport();
  fireEvent.change(screen.getByRole('textbox', { name: 'Apa yang terjadi?' }), {
    target: { value: 'Room hilang' },
  });
  await screen.findByRole('alert');
  fireEvent.click(
    screen.getByRole('button', { name: 'Lanjut tanpa catatan room' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Kirim laporan' }));
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Laporan terkirim',
  );
  expect(request).toHaveBeenLastCalledWith(
    '/api/game-bugs',
    expect.objectContaining({
      body: expect.objectContaining({ description: 'Room hilang' }),
    }),
  );
});
