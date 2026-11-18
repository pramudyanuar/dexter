'use client';

import * as React from 'react';

import {
  CODE_LENGTH,
  CODE_PATTERN,
  normalizeCode,
} from '@/lib/rooms/code-format';
import {
  DUEL_MATCH_URL,
  DUEL_ROOMS_URL,
  DuelLobbyEntry,
  DuelSession,
  DuelTicket,
} from '@/lib/snake-duel/protocol';
import useStoredState from '@/lib/useStoredState';

const primary =
  'min-h-11 rounded-lg bg-ink px-3 text-sm font-semibold text-paper hover:opacity-90 disabled:opacity-40';
const secondary =
  'min-h-11 rounded-lg border border-line px-3 text-sm font-medium hover:border-accent disabled:opacity-40';

type TicketResponse = DuelTicket | { status: 'expired' | 'cancelled' };
type SearchTicket = { id: string; expiresAt: number };

async function json<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error ?? 'Duel sedang tidak tersedia.');
  return data as T;
}

function ticketRequest(
  ticket: string,
  method: string,
  body?: object,
  signal?: AbortSignal,
) {
  return json<TicketResponse>(DUEL_MATCH_URL, {
    method,
    headers: {
      Authorization: `Bearer ${ticket}`,
      'Content-Type': 'application/json',
    },
    body: body && JSON.stringify(body),
    signal,
    cache: 'no-store',
  });
}

const token = () => crypto.randomUUID().replaceAll('-', '');

export default function SnakeDuelLobby({
  invite,
  onEnter,
}: {
  invite: string;
  onEnter: (session: DuelSession) => void;
}) {
  const [name, setName] = useStoredState('dexter:player-name', '');
  const [code, setCode] = React.useState(invite);
  const [isPublic, setPublic] = React.useState(false);
  const [rooms, setRooms] = React.useState<DuelLobbyEntry[] | null>(null);
  const [lobbyError, setLobbyError] = React.useState('');
  const [refresh, setRefresh] = React.useState(0);
  const [pending, setPending] = React.useState(false);
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
  const cleanName = name.trim().slice(0, 16);

  React.useEffect(() => {
    const controller = new AbortController();
    void json<{ rooms: DuelLobbyEntry[] }>(DUEL_ROOMS_URL, {
      signal: controller.signal,
    })
      .then(({ rooms }) => {
        if (controller.signal.aborted) return;
        setRooms(rooms);
        setLobbyError('');
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLobbyError((error as Error).message);
      });
    return () => controller.abort();
  }, [refresh]);

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
    if (!ticket || pending) return;
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
  }, [ticket, pending]);

  async function run(action: () => Promise<void>) {
    setError('');
    setMessage('');
    setPending(true);
    try {
      await action();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setPending(false);
    }
  }

  function enter(action: 'create' | 'join', inviteCode = code) {
    const key = JSON.stringify([action, inviteCode, isPublic, cleanName]);
    if (admission.current?.key !== key)
      admission.current = { key, token: token() };
    const proof = admission.current.token;
    return run(async () => {
      const { session } = await json<{ session: DuelSession }>(DUEL_ROOMS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          name: cleanName,
          token: proof,
          public: isPublic,
          code: inviteCode,
        }),
      });
      onEnter(session);
    });
  }

  function find() {
    const id = token();
    return run(async () =>
      handleTicket(await ticketRequest(id, 'POST', { name: cleanName }), id),
    );
  }

  const unavailable = !rooms && Boolean(lobbyError);
  const disabled = pending || Boolean(ticket) || !cleanName || unavailable;

  return (
    <div className='space-y-4'>
      <section
        aria-labelledby='duel-access'
        className='space-y-3 rounded-lg border border-line bg-card p-4'
      >
        <h2 id='duel-access' className='font-semibold'>
          Arena 1 lawan 1
        </h2>
        <label className='block space-y-1 text-sm'>
          <span>Nama pemain</span>
          <input
            value={name.slice(0, 16)}
            maxLength={16}
            onChange={(event) => setName(event.target.value)}
            autoComplete='nickname'
            className='min-h-11 w-full rounded-md border border-line px-3'
          />
        </label>
        <div className='grid grid-cols-2 gap-2'>
          <button
            type='button'
            className={primary}
            disabled={disabled}
            onClick={find}
          >
            Cari lawan
          </button>
          <button
            type='button'
            className={secondary}
            disabled={disabled}
            onClick={() => enter('create')}
          >
            Buat room
          </button>
        </div>
        <label className='flex items-center gap-2 text-sm text-mute'>
          <input
            type='checkbox'
            checked={isPublic}
            onChange={(event) => setPublic(event.target.checked)}
          />
          Tampilkan room baru di lobi publik
        </label>
        <form
          className='flex items-end gap-2'
          onSubmit={(event) => {
            event.preventDefault();
            if (!disabled && CODE_PATTERN.test(code)) void enter('join');
          }}
        >
          <label className='min-w-0 flex-1 space-y-1 text-sm'>
            <span>Kode room</span>
            <input
              value={code}
              onChange={(event) =>
                setCode(normalizeCode(event.target.value).slice(0, CODE_LENGTH))
              }
              className='min-h-11 w-full rounded-md border border-line px-3 font-mono'
              autoComplete='off'
            />
          </label>
          <button
            disabled={disabled || !CODE_PATTERN.test(code)}
            type='submit'
            className={secondary}
          >
            Gabung
          </button>
        </form>
        {ticket && (
          <div className='flex items-center justify-between gap-2'>
            <p role='status' className='text-sm text-mute'>
              Mencari lawan, maksimal 45 detik…
            </p>
            <button
              type='button'
              disabled={pending}
              className={secondary}
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
        )}
        {!ticket && message && (
          <p role='status' className='text-sm text-mute'>
            {message}
          </p>
        )}
        {error && (
          <p role='alert' className='text-sm text-err'>
            {error}
          </p>
        )}
      </section>
      <section
        aria-labelledby='public-rooms'
        className='space-y-2 rounded-lg border border-line bg-card p-4'
      >
        <div className='flex items-center justify-between gap-2'>
          <h2 id='public-rooms' className='font-semibold'>
            Lobi publik
          </h2>
          <button
            type='button'
            className={secondary}
            onClick={() => setRefresh((n) => n + 1)}
          >
            Muat ulang
          </button>
        </div>
        {lobbyError ? (
          <p role='status' className='text-sm text-mute'>
            {lobbyError}
          </p>
        ) : rooms?.length ? (
          <ul className='divide-y divide-line'>
            {rooms.map((room) => (
              <li
                key={room.code}
                className='flex items-center justify-between gap-2 py-2'
              >
                <div className='min-w-0'>
                  <p className='truncate font-medium'>{room.name}</p>
                  <p className='font-mono text-xs text-mute'>{room.code}</p>
                </div>
                <button
                  type='button'
                  disabled={disabled}
                  className={secondary}
                  onClick={() => enter('join', room.code)}
                >
                  Gabung
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className='text-sm text-mute'>
            {rooms ? 'Belum ada room terbuka.' : 'Memuat lobi…'}
          </p>
        )}
      </section>
    </div>
  );
}
