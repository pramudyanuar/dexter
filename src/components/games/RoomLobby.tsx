'use client';

import * as React from 'react';

import {
  CODE_LENGTH,
  CODE_PATTERN,
  normalizeCode,
} from '@/lib/rooms/code-format';
import { cleanName, NAME_MAX } from '@/lib/rooms/player-name';
import { callRoom } from '@/lib/rooms/room-request';
import type { PublicRoom } from '@/lib/rooms/types';

import GameArt from '@/components/games/GameArt';
import useGameEntry from '@/components/games/useGameEntry';

import { GAME_HINTS } from '@/constant/game-hints';
import type { GameEntry } from '@/constant/games';

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
  guide,
  entry,
  publicRoomsUrl,
  initialCode,
  initialPublic = true,
  requireName = false,
  actions,
}: {
  blurb: string;
  busy: boolean;
  error: string;
  /** The player's display name, remembered across games */
  name: string;
  onName: (name: string) => void;
  onCreate: (isPublic?: boolean) => void;
  onJoin: (code: string) => void;
  guide?: React.ReactNode;
  entry?: Pick<GameEntry, 'id' | 'title' | 'players'>;
  publicRoomsUrl?: string;
  initialCode?: string;
  initialPublic?: boolean;
  requireName?: boolean;
  actions?: (disabled: boolean) => React.ReactNode;
}) {
  const currentGame = useGameEntry();
  const game = entry ?? currentGame;
  const hints = (game && GAME_HINTS[game.id]) ?? [];
  const [isPublic, setIsPublic] = React.useState(initialPublic);
  const [publicRooms, setPublicRooms] = React.useState<PublicRoom[] | null>(
    null,
  );
  const [listError, setListError] = React.useState('');
  const [refresh, setRefresh] = React.useState(0);
  const [code, setCode] = React.useState(() =>
    normalizeCode(
      initialCode ??
        new URLSearchParams(window.location.search).get('room') ??
        '',
    ),
  );
  const invited = CODE_PATTERN.test(code);

  const listUrl =
    publicRoomsUrl ??
    (game ? `/api/rooms?game=${encodeURIComponent(game.id)}` : null);
  React.useEffect(() => {
    if (!listUrl) return;
    const controller = new AbortController();
    const load = async () => {
      if (controller.signal.aborted || document.visibilityState !== 'visible')
        return;
      try {
        const data: { rooms?: PublicRoom[] } = await callRoom(listUrl, {
          signal: controller.signal,
        });
        if (!controller.signal.aborted && Array.isArray(data.rooms)) {
          setPublicRooms(data.rooms);
          setListError('');
        }
      } catch (err) {
        if (!controller.signal.aborted && publicRoomsUrl)
          setListError((err as Error).message);
      }
    };
    const first = setTimeout(load, 0);
    const timer = setInterval(load, 5000);
    document.addEventListener('visibilitychange', load);
    return () => {
      controller.abort();
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', load);
    };
  }, [listUrl, publicRoomsUrl, refresh]);

  const rooms = publicRooms ?? [];
  const showRoomList = rooms.length > 0 || Boolean(publicRoomsUrl);
  const unavailable = publicRooms === null && Boolean(listError);
  const disabled = busy || (requireName && !cleanName(name)) || unavailable;

  return (
    <div
      className={
        showRoomList
          ? 'relative left-1/2 grid w-[min(56rem,calc(100vw-2rem))] -translate-x-1/2 items-stretch gap-5 pb-6 md:grid-cols-2'
          : 'mx-auto w-full max-w-md pb-6'
      }
    >
      <div className='flex flex-col overflow-hidden rounded-xl border border-line bg-surface/50'>
        <section className='group'>
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
            {guide && <div className='mt-3'>{guide}</div>}
            {!guide && hints.length > 0 && (
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

        <div className='flex flex-1 flex-col border-t border-line p-4'>
          <label className='block'>
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
                disabled={disabled}
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
                if (!disabled && invited) onJoin(code);
              }}
              className='mt-4 flex gap-2'
            >
              <input
                value={code}
                onChange={(e) =>
                  setCode(normalizeCode(e.target.value).slice(0, CODE_LENGTH))
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
                type='submit'
                disabled={disabled || !invited}
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

          {actions?.(disabled)}
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

      {showRoomList && (
        <aside className='flex flex-col rounded-xl border border-line bg-surface/50 p-4'>
          <div className='mb-3 flex items-center justify-between border-b border-line pb-3'>
            <div className='flex items-center gap-2'>
              <h2 className='text-sm font-semibold text-ink'>Room terbuka</h2>
              <span className='rounded-full bg-line px-2 py-0.5 text-[11px] font-medium text-ink'>
                {rooms.length}
              </span>
            </div>
            {publicRoomsUrl ? (
              <button
                type='button'
                onClick={() => setRefresh((n) => n + 1)}
                className='text-xs text-[var(--mute)] hover:text-ink'
              >
                Muat ulang
              </button>
            ) : (
              <span className='text-xs text-[var(--mute)]'>
                Klik untuk gabung
              </span>
            )}
          </div>
          {listError && (
            <p role='status' className='text-sm text-mute'>
              {listError}
            </p>
          )}
          {!listError && rooms.length === 0 && (
            <p role='status' className='text-sm text-mute'>
              {publicRooms ? 'Belum ada room terbuka.' : 'Memuat lobi…'}
            </p>
          )}
          <ul className='flex flex-1 flex-col gap-2.5 overflow-y-auto'>
            {rooms.map((r) => (
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
                  disabled={disabled}
                  onClick={() => onJoin(r.code)}
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
