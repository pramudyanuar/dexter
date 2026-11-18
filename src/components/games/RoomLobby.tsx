'use client';

import * as React from 'react';

import { normalizeCode } from '@/lib/rooms/code-format';

import GameArt from '@/components/games/GameArt';
import useGameEntry from '@/components/games/useGameEntry';

import { GAME_HINTS } from '@/constant/game-hints';

export const NAME_MAX = 16;

interface PublicRoom {
  code: string;
  game: string;
  hostName: string;
  players: number;
  capacity: number;
  createdAt: number;
}

const field =
  'w-full rounded-lg border border-line-strong bg-surface px-3.5 py-2.5 placeholder:text-[var(--mute)] focus:border-[var(--mute)] focus:ring-0 focus:outline-none';

/** Create a room or enter a code. Reads `?room=CODE` so shared links fill it in. */
export default function RoomLobby({
  blurb,
  busy,
  error,
  name,
  onName,
  onCreate,
  onJoin,
}: {
  blurb: string;
  busy: boolean;
  error: string;
  /** The player's display name, remembered across games */
  name: string;
  onName: (name: string) => void;
  onCreate: (isPublic?: boolean) => void;
  onJoin: (code: string) => void;
}) {
  const game = useGameEntry();
  const hints = (game && GAME_HINTS[game.id]) ?? [];
  const [isPublic, setIsPublic] = React.useState(true);
  const [publicRooms, setPublicRooms] = React.useState<PublicRoom[]>([]);
  const [code, setCode] = React.useState(() =>
    normalizeCode(
      new URLSearchParams(window.location.search).get('room') ?? '',
    ),
  );
  const invited = code.length === 5;

  const gameId = game?.id;
  React.useEffect(() => {
    if (!gameId) return;
    let stopped = false;
    const load = async () => {
      if (stopped || document.visibilityState !== 'visible') return;
      try {
        const res = await fetch(
          `/api/rooms?game=${encodeURIComponent(gameId)}`,
          { cache: 'no-store' },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { rooms?: PublicRoom[] };
        if (!stopped && Array.isArray(data.rooms)) {
          setPublicRooms(data.rooms);
        }
      } catch {
        // ignore transient network errors
      }
    };
    const first = setTimeout(load, 0);
    const timer = setInterval(load, 5000);
    document.addEventListener('visibilitychange', load);
    return () => {
      stopped = true;
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', load);
    };
  }, [gameId]);

  return (
    <div className='mx-auto max-h-[calc(100dvh-4.75rem)] w-full max-w-md overflow-y-auto pb-4'>
      <section className='group overflow-hidden rounded-xl border border-line bg-surface/50'>
        {game && (
          <div className='aspect-[8/3] border-b border-line bg-[#0e1015]'>
            <GameArt id={game.id} />
          </div>
        )}
        <div className='p-4'>
          <div className='flex items-baseline justify-between gap-3'>
            <h1 className='text-lg font-semibold tracking-tight'>
              {game?.title ?? 'Main online'}
            </h1>
            {game && (
              <span className='shrink-0 text-xs text-[var(--mute)]'>
                {game.players} pemain
              </span>
            )}
          </div>
          <p className='mt-1.5 text-sm leading-relaxed text-[var(--mute)]'>
            {blurb.replace(/^#\s*/, '')}
          </p>
          {hints.length > 0 && (
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
                {hints.map((h, i) => (
                  <li key={i} className='flex gap-2'>
                    <span aria-hidden className='text-[var(--mute)]'>
                      •
                    </span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </section>

      <label className='mt-5 block'>
        <span className='mb-1.5 flex items-baseline justify-between text-sm'>
          Namamu
          <span className='text-xs text-[var(--mute)]'>
            dipakai di semua game
          </span>
        </span>
        <input
          value={name}
          onChange={(e) => onName(e.target.value.slice(0, NAME_MAX))}
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
          <button
            type='button'
            onClick={() => onCreate(isPublic)}
            disabled={busy}
            className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-[transform,opacity] active:scale-[0.99] disabled:opacity-50 ${
              invited
                ? 'border border-line-strong text-ink hover:border-[var(--mute)]'
                : 'bg-ink text-paper hover:opacity-90'
            }`}
          >
            Buat room baru
          </button>
          <label className='mt-2.5 flex items-center justify-center gap-2 text-xs text-[var(--mute)]'>
            <input
              type='checkbox'
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
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
          onSubmit={(e) => {
            e.preventDefault();
            if (invited) onJoin(code);
          }}
          className='mt-4 flex gap-2'
        >
          <input
            value={code}
            onChange={(e) => setCode(normalizeCode(e.target.value).slice(0, 5))}
            placeholder='ABCDE'
            aria-label='Kode room'
            autoCapitalize='characters'
            autoCorrect='off'
            spellCheck={false}
            maxLength={5}
            className={`min-w-0 flex-1 text-center font-mono text-lg tracking-[0.35em] uppercase ${field}`}
          />
          <button
            type='submit'
            disabled={busy || !invited}
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

      {error && (
        <p
          role='alert'
          className='mt-4 rounded-lg border border-err/50 bg-err/10 px-3 py-2 text-center text-sm text-err'
        >
          {error}
        </p>
      )}

      {publicRooms.length > 0 && (
        <div className='mt-6 rounded-xl border border-line bg-surface/40 p-3.5'>
          <div className='mb-2.5 flex items-center justify-between text-xs text-[var(--mute)]'>
            <span>Room terbuka ({publicRooms.length})</span>
            <span>Klik untuk langsung gabung</span>
          </div>
          <ul className='flex flex-col gap-2'>
            {publicRooms.map((r) => (
              <li
                key={r.code}
                className='flex items-center justify-between gap-3 rounded-lg border border-line bg-paper px-3 py-2'
              >
                <div className='min-w-0 flex-1'>
                  <div className='flex items-center gap-2'>
                    <span className='font-mono text-xs font-semibold text-accent'>
                      #{r.code}
                    </span>
                    <span className='truncate text-xs font-medium text-ink'>
                      {r.hostName}
                    </span>
                  </div>
                  <span className='text-[11px] text-[var(--mute)]'>
                    {r.players}/{r.capacity} pemain
                  </span>
                </div>
                <button
                  type='button'
                  disabled={busy}
                  onClick={() => onJoin(r.code)}
                  className='shrink-0 rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-paper transition hover:opacity-90 disabled:opacity-40'
                >
                  Gabung
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
