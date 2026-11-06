import * as React from 'react';

import { normalizeCode } from '@/lib/rooms/code-format';
import type { GameId, RoomView } from '@/lib/rooms/types';
import useStoredState from '@/lib/useStoredState';

export interface RoomSession {
  code: string;
  token: string;
  you: number;
}

const POLL_MS = 1000;

async function call(
  path: string,
  options: { body?: unknown; token?: string } = {},
) {
  const hasBody = options.body !== undefined;
  const res = await fetch(path, {
    method: hasBody ? 'POST' : 'GET',
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      // the token goes in a header so it stays out of URLs and logs
      ...(options.token ? { 'x-player-token': options.token } : {}),
    },
    body: hasBody ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(data.error ?? `HTTP ${res.status}`), {
      status: res.status,
    });
  }
  return data;
}

/**
 * Everything a room page needs: creating and joining, keeping the view fresh by
 * polling, and sending actions. `V` is the game's view of its state.
 */
export function useRoom<V>(game: GameId) {
  const [session, setSession] = useStoredState<RoomSession | null>(
    `room-session-${game}`,
    null,
  );
  const [room, setRoom] = React.useState<RoomView<V> | null>(null);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const version = React.useRef(0);

  const adopt = (next: RoomView<V>) => {
    version.current = next.version;
    setRoom(next);
  };

  const leave = React.useCallback(
    (message = '') => {
      setSession(null);
      setRoom(null);
      version.current = 0;
      setError(message);
    },
    [setSession],
  );

  // every player polls; the server answers tersely when nothing changed
  const code = session?.code;
  const token = session?.token;
  React.useEffect(() => {
    if (!code || !token) return;
    let stopped = false;

    const poll = async () => {
      if (stopped || document.visibilityState !== 'visible') return;
      try {
        const data = await call(`/api/rooms/${code}?v=${version.current}`, {
          token,
        });
        if (!stopped && data.changed) adopt(data.room);
      } catch (err) {
        if ((err as { status?: number }).status === 404) {
          leave('Room sudah kedaluwarsa atau tidak ada lagi.');
        }
        // other errors (a dropped connection): try again on the next tick
      }
    };

    const first = setTimeout(poll, 0);
    const timer = setInterval(poll, POLL_MS);
    document.addEventListener('visibilitychange', poll);
    return () => {
      stopped = true;
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', poll);
    };
    // adopt only touches refs and state setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, token, leave]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setBusy(false);
    }
  };

  const create = () =>
    run(async () => {
      const data = await call('/api/rooms', { body: { game } });
      setSession({ code: data.code, token: data.token, you: data.you });
      adopt(data.room);
    });

  const join = (input: string) =>
    run(async () => {
      const target = normalizeCode(input);
      const data = await call(`/api/rooms/${target}`, {
        body: { action: 'join' },
      });
      setSession({ code: target, token: data.token, you: data.you });
      adopt(data.room);
      window.history.replaceState(null, '', window.location.pathname);
    });

  const act = (action: string, move?: unknown) =>
    run(async () => {
      if (!session) return;
      const data = await call(`/api/rooms/${session.code}`, {
        body: { action, token: session.token, move },
      });
      adopt(data.room);
    });

  return {
    session,
    room,
    error,
    busy,
    leave: () => leave(),
    create,
    join,
    start: () => act('start'),
    move: (move: unknown) => act('move', move),
    rematch: () => act('rematch'),
  };
}
