'use client';

import * as React from 'react';

/** Copy text to the clipboard and say what was copied for a moment. */
export function useCopy() {
  const [copied, setCopied] = React.useState('');
  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      // clipboard unavailable (e.g. insecure context)
    }
  };
  return { copied, copy };
}

export const inviteLink = (code: string) =>
  `${window.location.origin}${window.location.pathname}?room=${code}`;

const small =
  'rounded-md border border-line-strong px-2.5 py-1 text-xs text-[var(--mute)] transition-colors hover:border-[var(--mute)] hover:text-ink';

/** The room code (tap to copy), anything game-specific, and a way out. */
export default function RoomBar({
  code,
  share,
  right,
  onLeave,
}: {
  code: string;
  /** Also offer to copy the invite link (while players are still joining) */
  share: boolean;
  right?: React.ReactNode;
  onLeave: () => void;
}) {
  const { copied, copy } = useCopy();

  return (
    <div className='mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-line bg-surface/50 px-3 py-2'>
      <button
        type='button'
        onClick={() => copy('code', code)}
        aria-label={`Salin kode room ${code}`}
        className='group flex items-center gap-2 text-left'
      >
        <span className='text-xs text-[var(--mute)]'>Room</span>
        <span className='font-mono text-sm font-medium tracking-[0.2em] text-ink'>
          {code}
        </span>
        <span className='text-xs text-[var(--mute)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100'>
          {copied === 'code' ? 'tersalin' : 'salin'}
        </span>
      </button>

      {right && <div className='text-xs'>{right}</div>}

      <div className='flex items-center gap-2'>
        {share && (
          <button
            type='button'
            onClick={() => copy('link', inviteLink(code))}
            className={small}
          >
            {copied === 'link' ? 'Link tersalin' : 'Salin link'}
          </button>
        )}
        <button
          type='button'
          onClick={onLeave}
          className={`${small} hover:border-err hover:text-err`}
        >
          Keluar
        </button>
      </div>
    </div>
  );
}
