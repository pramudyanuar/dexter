'use client';

import * as React from 'react';

import { normalizeCode } from '@/lib/rooms/code-format';

export const NAME_MAX = 16;

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
  const [code, setCode] = React.useState(() =>
    normalizeCode(
      new URLSearchParams(window.location.search).get('room') ?? '',
    ),
  );

  const field =
    'rounded-md border border-line bg-card px-3 py-2 placeholder:text-mute focus:border-mute focus:ring-0 focus:outline-none';

  return (
    <div>
      <p className='text-sm leading-relaxed text-mute'>
        {blurb.replace(/^#\s*/, '')}
      </p>

      <label className='mt-5 block'>
        <span className='mb-1.5 block text-sm'>Nama</span>
        <input
          value={name}
          onChange={(e) => onName(e.target.value.slice(0, NAME_MAX))}
          placeholder='username kamu'
          aria-label='Username'
          autoComplete='nickname'
          maxLength={NAME_MAX}
          className={`w-full ${field}`}
        />
      </label>

      <div className='mt-5 grid gap-4 sm:grid-cols-2'>
        <div className='flex flex-col justify-between gap-2 rounded-lg border border-line p-4'>
          <p className='text-sm text-mute'>Buat room, lalu bagikan kodenya.</p>
          <button
            type='button'
            onClick={onCreate}
            disabled={busy}
            className='text-info disabled:opacity-40'
          >
            buat room baru
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length === 5) onJoin(code);
          }}
          className='flex flex-col gap-2 rounded-lg border border-line p-4'
        >
          <p className='text-sm text-mute'>Punya kode dari teman?</p>
          <div className='flex gap-2'>
            <input
              value={code}
              onChange={(e) =>
                setCode(normalizeCode(e.target.value).slice(0, 5))
              }
              placeholder='ABCDE'
              aria-label='Kode room'
              autoCapitalize='characters'
              autoCorrect='off'
              spellCheck={false}
              maxLength={5}
              className={`w-full min-w-0 font-mono tracking-widest uppercase ${field}`}
            />
            <button
              type='submit'
              disabled={busy || code.length !== 5}
              className='text-info disabled:opacity-40'
            >
              gabung
            </button>
          </div>
        </form>
      </div>

      {error && <p className='mt-4 text-err'>{error}</p>}
    </div>
  );
}
