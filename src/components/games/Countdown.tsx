'use client';

import * as React from 'react';

/**
 * A shrinking bar with the seconds left. Remount it (change `key`) to restart.
 * `onExpire` runs once when time is up.
 */
export default function Countdown({
  seconds,
  onExpire,
  className = '',
}: {
  seconds: number;
  onExpire: () => void;
  className?: string;
}) {
  const [left, setLeft] = React.useState(seconds);
  const expire = React.useRef(onExpire);
  React.useEffect(() => {
    expire.current = onExpire;
  });

  React.useEffect(() => {
    const end = Date.now() + seconds * 1000;
    const timer = setInterval(() => {
      const remaining = Math.ceil((end - Date.now()) / 1000);
      setLeft(Math.max(remaining, 0));
      if (remaining <= 0) {
        clearInterval(timer);
        expire.current();
      }
    }, 200);
    return () => clearInterval(timer);
  }, [seconds]);

  const urgent = left <= 3;
  return (
    <div className={className} data-testid='countdown'>
      <div className='h-2 overflow-hidden rounded-full bg-line'>
        <div
          className={`h-full rounded-full ${urgent ? 'bg-err' : 'bg-accent'}`}
          style={{
            width: '100%',
            animation: `suit-shrink ${seconds}s linear forwards`,
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
