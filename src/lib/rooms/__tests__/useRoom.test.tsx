import { act, renderHook, waitFor } from '@testing-library/react';

import { useRoom } from '@/lib/rooms/useRoom';

const view = {
  code: 'ABCDE',
  game: 'chess',
  status: 'waiting',
  version: 1,
  state: null,
};

/** Records join/create calls and answers like the server. */
function mockApi() {
  const joins: { token?: string }[] = [];
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : {};
    const reply = (data: unknown) => ({
      ok: true,
      status: 200,
      json: async () => data,
    });
    if (url === '/api/rooms') {
      return reply({ code: 'ABCDE', token: 'host-token', you: 0, room: view });
    }
    if (body.action === 'join') {
      joins.push({ token: body.token });
      // a known token gets its seat back, otherwise a new seat is taken
      return reply(
        body.token
          ? { token: body.token, you: 1, room: view }
          : { token: 'new-token', you: 1, room: view },
      );
    }
    return reply({ changed: false, version: 1 });
  }) as unknown as typeof fetch;
  return { joins };
}

function fakeLocks() {
  const held = new Set<string>();
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: {
      query: async () => ({ held: [...held].map((name) => ({ name })) }),
      request: (name: string, cb: () => Promise<void>) => {
        held.add(name);
        return cb().finally(() => held.delete(name));
      },
    },
  });
  return held;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  fakeLocks();
});

describe('useRoom: coming back to a room', () => {
  it('rejoins with the same seat after leaving by accident', async () => {
    const { joins } = mockApi();
    const { result } = renderHook(() => useRoom('chess'));

    await act(async () => result.current.join('abcde'));
    await waitFor(() =>
      expect(result.current.session?.token).toBe('new-token'),
    );
    expect(joins).toEqual([{ token: undefined }]);

    act(() => result.current.leave());
    await waitFor(() => expect(result.current.session).toBeNull());
    // let the lock for the old seat be released
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => result.current.join('ABCDE'));
    expect(joins[1]).toEqual({ token: 'new-token' });
    await waitFor(() =>
      expect(result.current.session?.token).toBe('new-token'),
    );
  });

  it('lets a second tab join as a different player while the first stays', async () => {
    const { joins } = mockApi();
    const first = renderHook(() => useRoom('chess'));
    await act(async () => first.result.current.join('ABCDE'));
    await waitFor(() => expect(first.result.current.session).not.toBeNull());

    // another tab: its own session storage, but the same browser (same locks and localStorage)
    const savedSession = sessionStorage.getItem('room-session-chess');
    sessionStorage.clear();
    const second = renderHook(() => useRoom('chess'));
    expect(second.result.current.session).toBeNull();
    await act(async () => second.result.current.join('ABCDE'));

    expect(joins[1]).toEqual({ token: undefined }); // the seat is still in use
    sessionStorage.setItem('room-session-chess', savedSession!);
  });

  it('keeps each tab in its own room', async () => {
    mockApi();
    const { result } = renderHook(() => useRoom('chess'));
    await act(async () => result.current.create());
    await waitFor(() => expect(result.current.session?.code).toBe('ABCDE'));
    expect(sessionStorage.getItem('room-session-chess')).toContain(
      'host-token',
    );
    expect(localStorage.getItem('room-session-chess')).toBeNull();
  });

  it('does not keep calling the server just to say it is here', async () => {
    jest.useFakeTimers();
    try {
      const calls: string[] = [];
      global.fetch = jest.fn(async (url: string) => {
        calls.push(url);
        const reply = (data: unknown) => ({
          ok: true,
          status: 200,
          json: async () => data,
        });
        if (url === '/api/rooms')
          return reply({
            code: 'ABCDE',
            token: 'host-token',
            you: 0,
            room: view,
          });
        return reply({ changed: false, version: 1 });
      }) as unknown as typeof fetch;

      const { result } = renderHook(() => useRoom('chess'));
      await act(async () => result.current.create());
      await act(async () => {
        await jest.advanceTimersByTimeAsync(60_000);
      });

      // only the room itself is polled; nothing else is asked for
      expect(
        calls
          .filter((u) => u !== '/api/rooms')
          .every((u) => u.startsWith('/api/rooms/ABCDE?v=')),
      ).toBe(true);
      expect(calls.some((u) => u.includes('presence'))).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('tells the server when you press keluar, and only then', async () => {
    const posts: unknown[] = [];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      const reply = (data: unknown) => ({
        ok: true,
        status: 200,
        json: async () => data,
      });
      if (url === '/api/rooms')
        return reply({
          code: 'ABCDE',
          token: 'host-token',
          you: 0,
          room: view,
        });
      if (init?.method === 'POST') posts.push(JSON.parse(init.body as string));
      return reply({ changed: false, version: 1 });
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useRoom('chess'));
    await act(async () => result.current.create());
    expect(posts).toEqual([]);

    act(() => result.current.leave());
    await waitFor(() =>
      expect(posts).toContainEqual({ action: 'leave', token: 'host-token' }),
    );
    expect(result.current.session).toBeNull();
  });

  it('asks the browser to say goodbye when the page is closed', async () => {
    const beacon = jest.fn(() => true);
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      value: beacon,
    });
    global.fetch = jest.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () =>
        url === '/api/rooms'
          ? { code: 'ABCDE', token: 'host-token', you: 0, room: view }
          : { changed: false, version: 1 },
    })) as unknown as typeof fetch;

    const { result } = renderHook(() => useRoom('chess'));
    // nothing to say while you are not in a room
    window.dispatchEvent(new Event('pagehide'));
    expect(beacon).not.toHaveBeenCalled();

    await act(async () => result.current.create());
    window.dispatchEvent(new Event('pagehide'));
    expect(beacon).toHaveBeenCalledTimes(1);
    const [url, body] = (beacon.mock.calls[0] ?? []) as unknown as [
      string,
      Blob,
    ];
    expect(url).toBe('/api/rooms/ABCDE');
    // jsdom's Blob has no text(), so read it the old way
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(body);
    });
    expect(body.type).toBe('application/json');
    expect(JSON.parse(text)).toEqual({
      action: 'leave',
      token: 'host-token',
    });
  });

  it('follows your seat when it moves up after someone was removed', async () => {
    const room = { ...view, status: 'waiting', seat: 1 };
    global.fetch = jest.fn(async (url: string) => {
      const reply = (data: unknown) => ({
        ok: true,
        status: 200,
        json: async () => data,
      });
      if (url === '/api/rooms')
        return reply({ code: 'ABCDE', token: 'host-token', you: 2, room });
      return reply({ changed: false, version: 1 });
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useRoom('chess'));
    await act(async () => result.current.create());
    // the room says we sit in seat 1 now, not the 2 we were handed
    await waitFor(() => expect(result.current.session?.you).toBe(1));
  });
});
