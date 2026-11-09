'use client';

import * as React from 'react';

import { normalizeCode } from '@/lib/rooms/code-format';

export const NAME_MAX = 16;

/** Create a room or enter a code. Reads `?room=CODE` so shared links fill it in. */
export default function RoomLobby({
  command,
  blurb,
  busy,
  error,
  name,
  onName,
  onCreate,
  onJoin,
}: {
  /** Shown after the prompt, e.g. "suit --online" */
  command: string;
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

  return (
    <>
      <p>
        <span className='text-accent select-none'>$</span> {command}
      </p>
      <p className='mt-1 text-mute'>{blurb}</p>

      <label className='mt-5 flex items-center gap-2'>
        <span className='text-accent select-none'>nama:</span>
        <input
          value={name}
          onChange={(e) => onName(e.target.value.slice(0, NAME_MAX))}
          placeholder='username kamu'
          aria-label='Username'
          autoComplete='nickname'
          maxLength={NAME_MAX}
          className='w-44 rounded-sm border border-line bg-transparent px-2 py-1 placeholder:text-mute focus:border-accent focus:ring-0 focus:outline-none'
        />
      </label>

      <button
        type='button'
        onClick={onCreate}
        disabled={busy}
        className='mt-5 self-start text-info hover:underline disabled:opacity-40'
      >
        [buat room baru]
      </button>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (code.length === 5) onJoin(code);
        }}
        className='mt-5 flex items-center gap-2'
      >
        <span className='text-accent select-none'>kode:</span>
        <input
          value={code}
          onChange={(e) => setCode(normalizeCode(e.target.value).slice(0, 5))}
          placeholder='ABCDE'
          aria-label='Kode room'
          autoCapitalize='characters'
          autoCorrect='off'
          spellCheck={false}
          maxLength={5}
          className='w-24 rounded-sm border border-line bg-transparent px-2 py-1 tracking-widest uppercase placeholder:text-mute focus:border-accent focus:ring-0 focus:outline-none'
        />
        <button
          type='submit'
          disabled={busy || code.length !== 5}
          className='text-info hover:underline disabled:opacity-40'
        >
          [gabung]
        </button>
      </form>

      {error && <p className='mt-4 text-err'>{error}</p>}
    </>
  );
}
