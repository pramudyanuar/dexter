'use client';

import * as React from 'react';

/** Milliseconds left until a deadline expressed in the browser's clock. */
export function useRemainingMs(deadline: number | null) {
  const [now, setNow] = React.useState(Date.now);
  const active = deadline !== null;
  React.useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [active]);
  return deadline === null ? 0 : Math.max(0, deadline - now);
}

/** Shows a server deadline translated to the browser's clock. */
export default function Countdown({
  seconds,
  deadline,
  className = '',
}: {
  seconds: number;
  deadline: number;
  className?: string;
}) {
  const leftMs = useRemainingMs(deadline);
  const left = Math.ceil(leftMs / 1000);
  const urgent = left <= 3;
  return (
    <div className={className} data-testid='countdown'>
      <div className='h-2 overflow-hidden rounded-full bg-line'>
        <div
          className={`h-full rounded-full ${urgent ? 'bg-err' : 'bg-accent'}`}
          style={{
            width: `${Math.min(100, leftMs / (seconds * 10))}%`,
          }}
        />
      </div>
      <p
        className={`mt-1 text-center text-xs ${
          urgent ? 'a-tick font-bold text-err' : 'text-mute'
        }`}
      >
        {left} detik
      </p>
    </div>
  );
}
