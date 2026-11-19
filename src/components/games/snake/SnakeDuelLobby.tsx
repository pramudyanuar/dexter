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
import usePlayerName from '@/lib/usePlayerName';
import useStoredState from '@/lib/useStoredState';

import GameArt from '@/components/games/GameArt';
import { NAME_MAX } from '@/components/games/RoomLobby';

const field =
  'w-full rounded-lg border border-line-strong bg-surface px-3.5 py-2.5 placeholder:text-[var(--mute)] focus:border-[var(--mute)] focus:ring-0 focus:outline-none';
const primary =
  'w-full rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-paper transition-[transform,opacity] hover:opacity-90 active:scale-[0.99] disabled:opacity-50';
const secondary =
  'w-full rounded-lg border border-line-strong px-4 py-2.5 text-sm font-medium text-ink transition-[transform,opacity] hover:border-[var(--mute)] active:scale-[0.99] disabled:opacity-50';

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
  const [name, setName] = usePlayerName();
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
  const cleanName = name.trim().slice(0, NAME_MAX);
  const invited = CODE_PATTERN.test(code);
  const hasPublic = Boolean(rooms?.length);

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
    <div
      className={
        hasPublic
          ? 'relative left-1/2 grid w-[min(56rem,calc(100vw-2rem))] -translate-x-1/2 items-stretch gap-5 pb-6 md:grid-cols-2'
          : 'mx-auto w-full max-w-md pb-6'
      }
    >
      <div className='flex flex-col overflow-hidden rounded-xl border border-line bg-surface/50'>
        <section className='group'>
          <div className='aspect-[8/3] border-b border-line bg-[#0e1015]'>
            <GameArt id='snake' />
          </div>
          <div className='p-4'>
            <div className='flex items-baseline justify-between gap-3'>
              <h2
                id='duel-access'
                className='text-lg font-semibold tracking-tight'
              >
                Snake Duel
              </h2>
              <span className='shrink-0 text-xs text-[var(--mute)]'>
                2 pemain
              </span>
            </div>
            <p className='mt-1.5 text-sm leading-relaxed text-[var(--mute)]'>
              Duel ular 1 lawan 1 real-time. Cari lawan otomatis atau buat room
              untuk main bareng teman.
            </p>
            <details className='group mt-3 rounded-lg border border-line bg-surface/50'>
              <summary className='flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-medium select-none'>
                Cara main
                <span
                  aria-hidden
                  className='text-[var(--mute)] transition-transform group-open:rotate-90'
                >
                  ›
                </span>
              </summary>
              <ul className='space-y-1.5 px-3 pb-3 text-sm text-[var(--mute)]'>
                <li className='flex gap-2'>
                  <span aria-hidden className='text-[var(--mute)]'>
                    •
                  </span>
                  <span>
                    Makan apel untuk memanjangkan ular, hindari dinding dan
                    tubuh ular lain.
                  </span>
                </li>
                <li className='flex gap-2'>
                  <span aria-hidden className='text-[var(--mute)]'>
                    •
                  </span>
                  <span>
                    Bertahan paling lama atau paksa lawan menabrak untuk menang.
                  </span>
                </li>
              </ul>
            </details>
          </div>
        </section>

        <div className='flex flex-1 flex-col border-t border-line p-4'>
          <label className='block'>
            <span className='mb-1.5 flex items-baseline justify-between text-sm'>
              Namamu
              <span className='text-xs text-[var(--mute)]'>
                dipakai di semua game
              </span>
            </span>
            <input
              value={name.slice(0, NAME_MAX)}
              onChange={(event) =>
                setName(event.target.value.slice(0, NAME_MAX))
              }
              placeholder='mis. Budi'
              aria-label='Username'
              autoComplete='nickname'
              maxLength={NAME_MAX}
              className={field}
            />
          </label>

          {/* an invite link fills the code in, so joining comes first then */}
          <div className={invited ? 'flex flex-col-reverse' : ''}>
            <div className='mt-5'>
              <div className='grid grid-cols-2 gap-2'>
                <button
                  type='button'
                  className={invited ? secondary : primary}
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
                  Buat room baru
                </button>
              </div>
              <label className='mt-2.5 flex items-center justify-center gap-2 text-xs text-[var(--mute)]'>
                <input
                  type='checkbox'
                  checked={isPublic}
                  onChange={(event) => setPublic(event.target.checked)}
                />
                Room publik (bisa langsung di-join orang lain)
              </label>
            </div>

            <div className='mt-5 flex items-center gap-3 text-xs text-[var(--mute)]'>
              <span className='h-px flex-1 bg-line' />
              {invited ? 'kamu diundang ke room ini' : 'atau gabung pakai kode'}
              <span className='h-px flex-1 bg-line' />
            </div>

            <form
              className='mt-4 flex gap-2'
              onSubmit={(event) => {
                event.preventDefault();
                if (!disabled && invited) void enter('join');
              }}
            >
              <input
                value={code}
                onChange={(event) =>
                  setCode(
                    normalizeCode(event.target.value).slice(0, CODE_LENGTH),
                  )
                }
                placeholder='ABCDE'
                aria-label='Kode room'
                autoCapitalize='characters'
                autoCorrect='off'
                spellCheck={false}
                maxLength={CODE_LENGTH}
                className={`min-w-0 flex-1 text-center font-mono text-lg tracking-[0.35em] uppercase ${field}`}
              />
              <button
                disabled={disabled || !invited}
                type='submit'
                className={`shrink-0 rounded-lg px-5 text-sm font-medium transition-[transform,opacity] active:scale-[0.99] disabled:opacity-40 ${
                  invited
                    ? 'bg-ink text-paper hover:opacity-90'
                    : 'border border-line-strong text-ink'
                }`}
              >
                Gabung
              </button>
            </form>
          </div>

          {ticket && (
            <div className='mt-4 flex items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2'>
              <p role='status' className='text-xs text-[var(--mute)]'>
                Mencari lawan, maksimal 45 detik…
              </p>
              <button
                type='button'
                disabled={pending}
                className='shrink-0 rounded-lg border border-line-strong px-3 py-1 text-xs font-medium text-ink transition hover:border-[var(--mute)] disabled:opacity-40'
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
            <p
              role='status'
              className='mt-4 rounded-lg border border-line bg-surface px-3 py-2 text-center text-sm text-[var(--mute)]'
            >
              {message}
            </p>
          )}

          {lobbyError && (
            <p
              role='status'
              className='mt-4 rounded-lg border border-line bg-surface px-3 py-2 text-center text-sm text-[var(--mute)]'
            >
              {lobbyError}
            </p>
          )}

          {error && (
            <p
              role='alert'
              className='mt-4 rounded-lg border border-err/50 bg-err/10 px-3 py-2 text-center text-sm text-err'
            >
              {error}
            </p>
          )}
        </div>
      </div>

      {hasPublic && rooms && (
        <aside className='flex flex-col rounded-xl border border-line bg-surface/50 p-4'>
          <div className='mb-3 flex items-center justify-between border-b border-line pb-3'>
            <div className='flex items-center gap-2'>
              <h2 id='public-rooms' className='text-sm font-semibold text-ink'>
                Room terbuka
              </h2>
              <span className='rounded-full bg-line px-2 py-0.5 text-[11px] font-medium text-ink'>
                {rooms.length}
              </span>
            </div>
            <button
              type='button'
              onClick={() => setRefresh((n) => n + 1)}
              className='text-xs text-[var(--mute)] transition hover:text-ink'
            >
              Muat ulang
            </button>
          </div>
          <ul className='flex flex-1 flex-col gap-2.5 overflow-y-auto'>
            {rooms.map((room) => (
              <li
                key={room.code}
                className='flex items-center justify-between gap-3 rounded-lg border border-line bg-paper px-3 py-2'
              >
                <div className='min-w-0 flex-1'>
                  <div className='flex items-center gap-2'>
                    <span className='font-mono text-xs font-semibold text-accent'>
                      #{room.code}
                    </span>
                    <span className='truncate text-xs font-medium text-ink'>
                      {room.name}
                    </span>
                  </div>
                  <span className='text-[11px] text-[var(--mute)]'>
                    1/2 pemain
                  </span>
                </div>
                <button
                  type='button'
                  disabled={disabled}
                  onClick={() => enter('join', room.code)}
                  className='shrink-0 rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-paper transition hover:opacity-90 disabled:opacity-40'
                >
                  Gabung
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}
