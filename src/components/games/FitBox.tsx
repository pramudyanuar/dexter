'use client';

import * as React from 'react';

/** Below this the game would be too small to play, so it scrolls instead. */
const MIN_ZOOM = 0.55;

/**
 * Keeps a game on one screen. The game is laid out as it always was; when that
 * comes out taller than the room there is, the whole of it is scaled down until
 * it fits, and scaled back up when there is room again (a bigger window, a
 * phone turned round, a shorter state of the game). Nothing scrolls unless the
 * game would have to shrink past the point of being playable.
 */
export default function FitBox({ children }: { children: React.ReactNode }) {
  const outer = React.useRef<HTMLDivElement>(null);
  const inner = React.useRef<HTMLDivElement>(null);
  const zoom = React.useRef(1);

  React.useLayoutEffect(() => {
    const box = outer.current;
    const el = inner.current;
    if (!box || !el || typeof ResizeObserver === 'undefined') return;

    const fit = () => {
      // a few passes: scaling changes the width the game has to lay out in,
      // which can change how tall it is
      for (let pass = 0; pass < 4; pass++) {
        const room = box.clientHeight;
        const tall = el.getBoundingClientRect().height;
        if (!room || !tall) return;
        const next = Math.max(
          MIN_ZOOM,
          Math.min(1, (zoom.current * room) / tall),
        );
        if (Math.abs(next - zoom.current) < 0.004) break;
        zoom.current = next;
        el.style.zoom = next === 1 ? '' : next.toFixed(3);
      }
      el.dataset.fit = zoom.current.toFixed(2);
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={outer}
      className='flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto'
    >
      <div ref={inner} data-fit='1.00' className='flex flex-col'>
        {children}
      </div>
    </div>
  );
}
