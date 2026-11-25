'use client';

import * as React from 'react';

import type { Dir } from '@/lib/games/snake';

const KEYS: Partial<Record<string, Dir>> = {
  arrowup: 'up',
  arrowdown: 'down',
  arrowleft: 'left',
  arrowright: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
};

export function isInteractive(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        'input, textarea, select, button, a[href], [contenteditable], [role="button"]',
      ),
    )
  );
}

export function shouldIgnoreGameKey(event: KeyboardEvent) {
  const { key, target } = event;
  return (
    event.defaultPrevented ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    (target instanceof Element &&
      Boolean(target.closest('input, textarea, select, [contenteditable]'))) ||
    ((key === 'Enter' || key === ' ') && isInteractive(target))
  );
}

export function useSnakeKeys(
  turn: (dir: Dir) => boolean,
  pause?: () => boolean,
  restart?: () => boolean,
) {
  const handleKey = React.useEffectEvent((event: KeyboardEvent) => {
    if (shouldIgnoreGameKey(event)) return;
    const dir = KEYS[event.key.toLowerCase()];
    if (dir && !event.repeat && turn(dir)) event.preventDefault();
    if (event.key === ' ' && !event.repeat && pause?.()) event.preventDefault();
    if (event.key === 'Enter' && !event.repeat && restart?.()) {
      event.preventDefault();
    }
  });

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => handleKey(event);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

const arrows: [Dir, string, string, string][] = [
  ['up', 'Atas', '↑', 'col-start-2'],
  ['left', 'Kiri', '←', 'col-start-1 row-start-2'],
  ['down', 'Bawah', '↓', 'col-start-2 row-start-2'],
  ['right', 'Kanan', '→', 'col-start-3 row-start-2'],
];

export function SnakePad({
  onDirection,
  disabled,
}: {
  onDirection: (dir: Dir) => void;
  disabled?: boolean;
}) {
  return (
    <div className='mx-auto grid w-[10.75rem] grid-cols-3 gap-2 pointer-fine:hidden'>
      {arrows.map(([dir, label, symbol, placement]) => (
        <button
          key={dir}
          type='button'
          aria-label={label}
          disabled={disabled}
          onClick={() => onDirection(dir)}
          className={`min-h-11 cursor-pointer touch-manipulation border border-line-strong bg-card font-mono text-lg active:border-accent active:text-accent disabled:cursor-default disabled:opacity-40 ${placement}`}
        >
          {symbol}
        </button>
      ))}
    </div>
  );
}
