import * as React from 'react';

import { normalizeCode } from '@/lib/rooms/code-format';
import {
  forgetSeat,
  holdSeat,
  recallSeat,
  rememberSeat,
} from '@/lib/rooms/seat-memory';
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
  // the room you sit in belongs to this tab, so two tabs can be two players
  const [session, setSession] = useStoredState<RoomSession | null>(
    `room-session-${game}`,
    null,
    'tab',
  );
  // one name for every game, so it only has to be typed once
  const [name, setName] = useStoredState<string>('player-name', '');
  const [room, setRoom] = React.useState<RoomView<V> | null>(null);
  // when the room view arrived, so countdowns can run from there
  const [receivedAt, setReceivedAt] = React.useState(0);

  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const version = React.useRef(0);

  const adopt = (next: RoomView<V>) => {
    version.current = next.version;
    setRoom(next);
    setReceivedAt(Date.now());
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

  // tell other tabs this seat is in use, so they do not take it over
  React.useEffect(() => (token ? holdSeat(token) : undefined), [token]);

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
          forgetSeat(game, code);
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
  }, [code, token, leave, game]);

  // Closing the page or tab is the one thing the server cannot see for itself,
  // so the browser is asked to say so on the way out. A reload says it too, but
  // the reloaded page asks for the room straight away, which cancels it.
  React.useEffect(() => {
    if (!code || !token) return;
    const say = () => {
      try {
        navigator.sendBeacon(
          `/api/rooms/${code}`,
          new Blob([JSON.stringify({ action: 'leave', token })], {
            type: 'application/json',
          }),
        );
      } catch {
        // no beacon support: the turn clock will deal with it
      }
    };
    window.addEventListener('pagehide', say);
    return () => window.removeEventListener('pagehide', say);
  }, [code, token]);

  // after a rematch the seats can shift up when someone was removed
  const seatNow = room?.seat ?? null;
  React.useEffect(() => {
    if (session && seatNow !== null && seatNow !== session.you) {
      setSession({ ...session, you: seatNow });
      rememberSeat(game, session.code, { token: session.token, you: seatNow });
    }
  }, [seatNow, session, setSession, game]);

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
      const data = await call('/api/rooms', { body: { game, name } });
      rememberSeat(game, data.code, data);
      setSession({ code: data.code, token: data.token, you: data.you });
      adopt(data.room);
    });

  const join = (input: string) =>
    run(async () => {
      const target = normalizeCode(input);
      // coming back to a room you were already in gives you the same seat
      const before = await recallSeat(game, target);
      const data = await call(`/api/rooms/${target}`, {
        body: { action: 'join', name, token: before?.token },
      });
      rememberSeat(game, target, data);
      setSession({ code: target, token: data.token, you: data.you });
      adopt(data.room);
      window.history.replaceState(null, '', window.location.pathname);
    });

  const act = (action: string, extra: Record<string, unknown> = {}) =>
    run(async () => {
      if (!session) return;
      const data = await call(`/api/rooms/${session.code}`, {
        body: { action, token: session.token, ...extra },
      });
      adopt(data.room);
    });

  return {
    session,
    room,
    receivedAt,
    name,
    setName,
    error,
    busy,
    leave: () => {
      // tell the server now, so the others are not left waiting for a sign
      // that never comes; coming back soon cancels it
      if (session) {
        void call(`/api/rooms/${session.code}`, {
          body: { action: 'leave', token: session.token },
          token: session.token,
        }).catch(() => {});
      }
      leave();
    },
    create,
    join,
    start: () => act('start'),
    /** Admin: change the game's settings before it starts */
    setOptions: (options: unknown) => act('options', { options }),
    /** Host removes a waiting player by seat. */
    kick: (seat: number) => act('kick', { seat }),
    move: (move: unknown) => act('move', { move }),
    /** Changes your name, also in the room you are in */
    rename: (next: string) => {
      setName(next);
      return act('rename', { name: next });
    },
    rematch: () => act('rematch'),
  };
}
