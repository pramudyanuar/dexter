import * as React from 'react';

const COLORS = ['#e5484d', '#f5c518', '#30a46c', '#3e63dd', '#ab4aba'];

/** Falling confetti for a win. Pure CSS, decorative, never blocks clicks. */
export default function Confetti({ count = 36 }: { count?: number }) {
  const pieces = React.useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: (i * 97) % 100,
        dx: ((i * 53) % 120) - 60,
        dur: 2.4 + ((i * 7) % 15) / 10,
        delay: ((i * 13) % 10) / 10,
        color: COLORS[i % COLORS.length],
        w: 6 + (i % 3) * 2,
      })),
    [count],
  );

  return (
    <div
      aria-hidden
      className='pointer-events-none fixed inset-0 z-50 overflow-hidden'
    >
      {pieces.map((p, i) => (
        <span
          key={i}
          className='a-confetti absolute top-0 block rounded-[1px]'
          style={
            {
              left: `${p.left}%`,
              width: p.w,
              height: p.w * 1.6,
              background: p.color,
              '--dx': `${p.dx}px`,
              '--dur': `${p.dur}s`,
              '--delay': `${p.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
