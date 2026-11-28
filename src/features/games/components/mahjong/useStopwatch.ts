'use client';

import * as React from 'react';

/**
 * Time played so far, in milliseconds, that can be paused. `base` is what was
 * already banked when the clock last started running.
 */
export default function useStopwatch(base: number, running: boolean) {
  const [since, setSince] = React.useState(() => Date.now());
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [running]);

  const elapsed = base + (running ? Math.max(0, now - since) : 0);

  return {
    elapsed,
    /** Banks the time run so far and returns it (call from an event handler). */
    stamp: () => {
      const t = Date.now();
      const total = base + (running ? t - since : 0);
      setSince(t);
      setNow(t);
      return total;
    },
    /** Starts counting again from this moment. */
    restart: () => {
      const t = Date.now();
      setSince(t);
      setNow(t);
    },
  };
}
