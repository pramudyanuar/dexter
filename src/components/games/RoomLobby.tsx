'use client';

import * as React from 'react';

import { normalizeCode } from '@/lib/rooms/code-format';

import GameArt from '@/components/games/GameArt';
import useGameEntry from '@/components/games/useGameEntry';

export const NAME_MAX = 16;

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
  onCreate: () => void;
  onJoin: (code: string) => void;
}) {
  const game = useGameEntry();
  const [code, setCode] = React.useState(() =>
    normalizeCode(
      new URLSearchParams(window.location.search).get('room') ?? '',
    ),
  );
  const invited = code.length === 5;

  return (
    <div className='mx-auto w-full max-w-md'>
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
            onClick={onCreate}
            disabled={busy}
            className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-[transform,opacity] active:scale-[0.99] disabled:opacity-50 ${
              invited
                ? 'border border-line-strong text-ink hover:border-[var(--mute)]'
                : 'bg-ink text-paper hover:opacity-90'
            }`}
          >
            Buat room baru
          </button>
          <p className='mt-1.5 text-center text-xs text-[var(--mute)]'>
            Kamu jadi pembuat, lalu bagikan kodenya ke teman.
          </p>
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
    </div>
  );
}
