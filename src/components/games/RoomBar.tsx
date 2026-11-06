'use client';

import * as React from 'react';

/** Room code, share buttons while waiting, and a way out. */
export default function RoomBar({
  code,
  share,
  right,
  onLeave,
}: {
  code: string;
  /** Show the copy buttons (while players are still joining) */
  share: boolean;
  right?: React.ReactNode;
  onLeave: () => void;
}) {
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

  const link = `${window.location.origin}${window.location.pathname}?room=${code}`;

  return (
    <div className='mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs'>
      <span className='text-mute'>
        room <span className='tracking-widest text-ink'>{code}</span>
      </span>
      {share && (
        <span className='flex gap-3'>
          <button
            type='button'
            onClick={() => copy('code', code)}
            className='text-info hover:underline'
          >
            [{copied === 'code' ? 'tersalin' : 'salin kode'}]
          </button>
          <button
            type='button'
            onClick={() => copy('link', link)}
            className='text-info hover:underline'
          >
            [{copied === 'link' ? 'tersalin' : 'salin link'}]
          </button>
        </span>
      )}
      {right}
      <button
        type='button'
        onClick={onLeave}
        className='text-mute hover:text-err'
      >
        [keluar]
      </button>
    </div>
  );
}
