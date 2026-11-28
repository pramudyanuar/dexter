import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import type { ChatMsg } from '@/features/rooms/types';

/** jsdom has no Response, so answer with the small part of it the component reads. */
const reply = (body: unknown, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => body,
});

import RoomChat from '@/features/rooms/components/RoomChat';

const session = { code: 'ABCDE', token: 'tok', you: 1 };
const line = (id: string, seat: number, text: string) => ({
  id,
  seat,
  text,
  at: Date.UTC(2026, 0, 1, 10, 30),
});

function mockServer(initial: ChatMsg[] = []) {
  const lines = [...initial];
  const posts: unknown[] = [];
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      const body = JSON.parse(init.body as string);
      posts.push({
        headers: init.headers,
        body,
      });
      const m = {
        ...line(`n${lines.length}`, 1, body.text ?? 'Sticker'),
        ...(body.stickerId ? { stickerId: body.stickerId } : {}),
      };
      lines.push(m);
      return reply({ message: m });
    }
    const after = new URL(url, 'http://x').searchParams.get('after');
    const at = after ? lines.findIndex((l) => l.id === after) : -1;
    return reply({ messages: at === -1 ? lines : lines.slice(at + 1) });
  }) as unknown as typeof fetch;
  return { lines, posts };
}

beforeEach(() => sessionStorage.clear());

describe('RoomChat', () => {
  it('shows nothing when you are not in a room', () => {
    mockServer();
    const { container } = render(<RoomChat game='chess' />);
    expect(container).toBeEmptyDOMElement();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('counts unread lines from others, then clears them when opened', async () => {
    sessionStorage.setItem('room-session-chess', JSON.stringify(session));
    mockServer([
      line('a', 0, 'halo'),
      line('b', 1, 'punyaku'),
      line('c', 0, 'siap?'),
    ]);
    render(<RoomChat game='chess' />);

    // two of the three lines are from someone else
    expect(
      await screen.findByRole('button', { name: 'Chat, 2 pesan baru' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Chat/ }));
    expect(screen.getByText('halo')).toBeInTheDocument();
    expect(screen.getByText('siap?')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Tutup chat' }),
    ).toBeInTheDocument();
  });

  it('sends a message with the player token and shows it', async () => {
    sessionStorage.setItem('room-session-chess', JSON.stringify(session));
    const server = mockServer();
    render(<RoomChat game='chess' />);

    fireEvent.click(await screen.findByRole('button', { name: 'Buka chat' }));
    expect(screen.getByText(/Belum ada pesan/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Pesan'), {
      target: { value: 'ayo main' },
    });
    await act(async () => {
      fireEvent.submit(screen.getByLabelText('Pesan').closest('form')!);
    });

    await waitFor(() =>
      expect(screen.getByText('ayo main')).toBeInTheDocument(),
    );
    expect(server.posts).toEqual([
      {
        headers: expect.objectContaining({ 'x-player-token': 'tok' }),
        body: { text: 'ayo main' },
      },
    ]);
    expect(screen.getByLabelText('Pesan')).toHaveValue('');
  });

  it('keeps the text and explains when sending fails', async () => {
    sessionStorage.setItem('room-session-chess', JSON.stringify(session));
    global.fetch = jest.fn(async (_url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? reply({ error: 'Terlalu cepat, tunggu sebentar' }, 429)
        : reply({ messages: [] }),
    ) as unknown as typeof fetch;
    render(<RoomChat game='chess' />);

    fireEvent.click(await screen.findByRole('button', { name: 'Buka chat' }));
    fireEvent.change(screen.getByLabelText('Pesan'), {
      target: { value: 'spam' },
    });
    await act(async () => {
      fireEvent.submit(screen.getByLabelText('Pesan').closest('form')!);
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Terlalu cepat');
    expect(screen.getByLabelText('Pesan')).toHaveValue('spam');
  });

  it.each(['inline', 'desktop'])(
    'collapses the %s panel and preserves its draft',
    async (mode) => {
      sessionStorage.setItem('room-session-chess', JSON.stringify(session));
      const matchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
      if (mode === 'desktop')
        Object.defineProperty(window, 'matchMedia', {
          configurable: true,
          value: () => ({
            matches: true,
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
          }),
        });
      mockServer([line('a', 0, 'halo')]);
      try {
        render(<RoomChat game='chess' inline={mode === 'inline'} />);
        expect(await screen.findByText('halo')).toBeVisible();
        const input = screen.getByRole('textbox', { name: 'Pesan' });
        fireEvent.change(input, { target: { value: 'draf' } });
        fireEvent.click(screen.getByRole('button', { name: 'Tutup chat' }));
        expect(input).not.toBeVisible();
        expect(
          screen.getByRole('button', { name: 'Buka chat' }),
        ).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(screen.getByRole('button', { name: 'Buka chat' }));
        expect(input).toBeVisible();
        expect(input).toHaveValue('draf');
        expect(screen.getByText('halo')).toBeVisible();
      } finally {
        if (matchMedia) Object.defineProperty(window, 'matchMedia', matchMedia);
        else Reflect.deleteProperty(window, 'matchMedia');
      }
    },
  );

  it('searches the sticker catalog and sends a sticker without clearing the draft', async () => {
    sessionStorage.setItem('room-session-chess', JSON.stringify(session));
    const server = mockServer();
    render(<RoomChat game='chess' inline />);

    fireEvent.change(screen.getByLabelText('Pesan'), {
      target: { value: 'ayo main' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Stiker' }));
    const search = screen.getByRole('searchbox');
    expect(search).toHaveFocus();
    fireEvent.change(search, { target: { value: 'nggak ada' } });
    expect(screen.getByText('Stiker tidak ditemukan.')).toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'good game' } });
    expect(
      screen.queryByRole('button', { name: 'Kirim stiker WKWK' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Kirim stiker GG!' }));

    expect(await screen.findByRole('img', { name: 'GG!' })).toBeInTheDocument();
    expect(server.posts).toEqual([
      {
        headers: expect.objectContaining({ 'x-player-token': 'tok' }),
        body: { stickerId: 'gg' },
      },
    ]);
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Pesan')).toHaveValue('ayo main');
  });
});
