'use client';

import * as React from 'react';

import useStoredState from '@/hooks/useStoredState';

import usePlayerName from '@/features/games/hooks/usePlayerName';
import { newToken } from '@/features/rooms/codes';
import RoomLobby from '@/features/rooms/components/RoomLobby';
import { cleanName } from '@/features/rooms/player-name';
import { callRoom } from '@/features/rooms/room-request';
import {
  DUEL_MATCH_URL,
  DUEL_ROOMS_URL,
  DuelSession,
  DuelTicket,
  MATCHMAKING_MS,
} from '@/features/snake-duel/protocol';

const lobbyEntry = { id: 'snake', title: 'Snake Duel', players: '2' };
const button =
  'min-h-11 rounded-lg border border-line-strong px-4 py-2 text-sm font-medium hover:border-accent disabled:opacity-40';

type TicketResponse = DuelTicket | { status: 'expired' | 'cancelled' };
type SearchTicket = { id: string; expiresAt: number };

function ticketRequest(
  ticket: string,
  method: 'GET' | 'POST' | 'DELETE',
  body?: object,
  signal?: AbortSignal,
): Promise<TicketResponse> {
  return callRoom(DUEL_MATCH_URL, {
    method,
    headers: { Authorization: 'Bearer ' + ticket },
    body,
    signal,
  });
}

export default function SnakeDuelLobby({
  invite,
  onEnter,
}: {
  invite: string;
  onEnter: (session: DuelSession) => void;
}) {
  const [name, setName] = usePlayerName();
  const [busy, setBusy] = React.useState(false);
  const [search, setSearch] = React.useState<SearchTicket | null>(null);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');
  const [savedTicket, storeTicket] = useStoredState<SearchTicket | null>(
    'snake-duel-ticket',
    null,
    'tab',
  );
  const ticket = search ?? savedTicket;
  const admission = React.useRef<{ key: string; token: string } | null>(null);
  const searchToken = React.useRef<string | null>(null);
  const displayName = cleanName(name);

  function handleTicket(data: TicketResponse, id: string) {
    if (data.status === 'queued') {
      const active = { id, expiresAt: data.expiresAt };
      setSearch(active);
      storeTicket(active);
    } else {
      setSearch(null);
      storeTicket(null);
      if (data.status === 'matched') onEnter(data.session);
      setMessage(
        data.status === 'expired' ? 'Belum ada lawan. Coba cari lagi.' : '',
      );
    }
  }

  const handlePoll = React.useEffectEvent(handleTicket);

  React.useEffect(() => {
    if (!ticket || busy) return;
    const { id, expiresAt } = ticket;
    const controller = new AbortController();
    let timer = window.setTimeout(poll, 3000);
    async function poll() {
      try {
        const data = await ticketRequest(
          id,
          'GET',
          undefined,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setError('');
        if (data.status === 'queued') timer = window.setTimeout(poll, 3000);
        else handlePoll(data, id);
      } catch {
        if (!controller.signal.aborted && Date.now() >= expiresAt + 3000) {
          handlePoll({ status: 'expired' }, id);
          setError('');
        } else if (!controller.signal.aborted) {
          setError('Koneksi terputus. Memeriksa pencarian lagi…');
          timer = window.setTimeout(poll, 3000);
        }
      }
    }
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [ticket, busy]);

  async function run(action: () => Promise<void>) {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      await action();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function enter(action: 'create' | 'join', isPublic: boolean, code?: string) {
    return run(async () => {
      const key = JSON.stringify([action, code, isPublic, displayName]);
      if (admission.current?.key !== key)
        admission.current = { key, token: newToken() };
      const { session }: { session: DuelSession } = await callRoom(
        DUEL_ROOMS_URL,
        {
          body: {
            action,
            name: displayName,
            token: admission.current.token,
            public: isPublic,
            code,
          },
        },
      );
      onEnter(session);
    });
  }

  function find() {
    return run(async () => {
      const id = (searchToken.current ??= newToken());
      const data = await ticketRequest(id, 'POST', { name: displayName });
      searchToken.current = null;
      handleTicket(data, id);
    });
  }

  return (
    <RoomLobby
      entry={lobbyEntry}
      blurb='Cari lawan atau buat room untuk main berdua.'
      compact
      name={name}
      onName={setName}
      busy={busy || Boolean(ticket)}
      error={error}
      initialCode={invite}
      initialPublic={false}
      requireName
      publicRoomsUrl={DUEL_ROOMS_URL}
      onCreate={(isPublic = false) => enter('create', isPublic)}
      onJoin={(code) => enter('join', false, code)}
      actions={(disabled) => (
        <div className='mt-4 space-y-2'>
          {ticket ? (
            <div className='flex items-center justify-between gap-2'>
              <p role='status' className='text-sm text-mute'>
                Mencari lawan, maksimal {MATCHMAKING_MS / 1000} detik…
              </p>
              <button
                type='button'
                disabled={busy}
                className={button}
                onClick={() =>
                  run(async () =>
                    handleTicket(
                      await ticketRequest(ticket.id, 'DELETE'),
                      ticket.id,
                    ),
                  )
                }
              >
                Batal
              </button>
            </div>
          ) : (
            <>
              <button
                type='button'
                className={button}
                disabled={disabled}
                onClick={find}
              >
                Cari lawan
              </button>
              {message && (
                <p role='status' className='text-sm text-mute'>
                  {message}
                </p>
              )}
            </>
          )}
        </div>
      )}
    />
  );
}
