'use client';

import * as React from 'react';

/** One colour per seat, so a player is recognised at a glance. */
const SEAT_HUE = [205, 340, 45, 150, 275, 20, 180, 95];
export const seatColor = (seat: number) =>
  `hsl(${SEAT_HUE[seat % SEAT_HUE.length]} 62% 42%)`;

/**
 * A player's initial in their colour. While it is their turn a ring around it
 * runs down with the turn clock, and turns red for the last ten seconds.
 */
export function Avatar({
  seat,
  name,
  clock,
}: {
  seat: number;
  name: string;
  /** Seconds left of how many, when this seat is on the clock */
  clock?: { left: number; of: number; key: React.Key } | null;
}) {
  return (
    <span
      aria-hidden
      className='relative flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white uppercase'
      style={{ background: seatColor(seat) }}
    >
      {name.trim().charAt(0) || '?'}
      {clock && (
        <svg
          viewBox='0 0 36 36'
          data-testid='seat-clock'
          className='absolute -inset-[3px] size-[calc(100%+6px)] -rotate-90'
        >
          <circle
            cx='18'
            cy='18'
            r='16'
            fill='none'
            stroke='var(--line-strong)'
            strokeWidth='3.5'
          />
          <circle
            key={clock.key}
            cx='18'
            cy='18'
            r='16'
            fill='none'
            strokeWidth='3.5'
            strokeLinecap='round'
            pathLength='100'
            strokeDasharray='100'
            className='uno-ring'
            style={
              {
                '--from': 100 - Math.min(100, (clock.left / clock.of) * 100),
                '--left': `${Math.max(0, clock.left)}s`,
              } as React.CSSProperties
            }
          />
        </svg>
      )}
    </span>
  );
}

/**
 * A number that counts up (or down) to its new value instead of jumping, one
 * step every `step` ms: in time with cards arriving one at a time.
 */
export function CountUp({
  value,
  from,
  step = 70,
}: {
  value: number;
  /** Where to start counting the first time (otherwise it starts at the value) */
  from?: number;
  step?: number;
}) {
  const [shown, setShown] = React.useState(from ?? value);
  React.useEffect(() => {
    const timer = setInterval(
      () =>
        setShown((now) => {
          if (now === value) {
            clearInterval(timer);
            return now;
          }
          return now + Math.sign(value - now);
        }),
      step,
    );
    return () => clearInterval(timer);
  }, [value, step]);
  return <>{shown}</>;
}

/** A reaction floating up from whoever sent it, then gone. */
export function EmoteBubble({
  emoji,
  style,
}: {
  emoji: string;
  style: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden
      data-testid='emote'
      className='a-emote pointer-events-none absolute z-[46] -translate-x-1/2 -translate-y-1/2 leading-none drop-shadow-[0_4px_6px_rgb(0_0_0/0.6)]'
      style={{ fontSize: 'min(13cqw, 15cqh)', ...style }}
    >
      {emoji}
    </span>
  );
}
