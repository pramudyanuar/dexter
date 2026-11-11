'use client';

import * as React from 'react';

/** How fast the marker sweeps from one end to the other and back, in seconds. */
const PERIOD = 1.4;

/**
 * The timing bar for Skill mode. A marker sweeps back and forth; the middle is
 * the sweet spot. `valueRef` always holds how well timed a throw would be right
 * now, from 0 (an end) to 1 (dead centre).
 */
export default function PowerMeter({
  valueRef,
  running,
}: {
  valueRef: React.MutableRefObject<number>;
  running: boolean;
}) {
  const [pos, setPos] = React.useState(0.5);

  React.useEffect(() => {
    if (!running) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const phase = (((now - t0) / 1000) % PERIOD) / PERIOD; // 0..1
      const p = phase < 0.5 ? phase * 2 : 2 - phase * 2; // triangle wave
      valueRef.current = 1 - Math.abs(p - 0.5) * 2;
      setPos(p);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, valueRef]);

  return (
    <div
      className='mx-auto w-full max-w-sm'
      aria-label='Timing meter'
      role='img'
    >
      <div className='relative h-4 overflow-hidden rounded-full bg-[#2a2d36]'>
        <div className='absolute inset-y-0 left-[30%] w-[40%] bg-[#caa22a]/30' />
        <div className='absolute inset-y-0 left-[42%] w-[16%] bg-[#2fa860]/60' />
        <div
          data-testid='meter-marker'
          className='absolute top-0 h-full w-1.5 -translate-x-1/2 rounded bg-white shadow'
          style={{ left: `${pos * 100}%` }}
        />
      </div>
      <p className='mt-1 text-center text-[11px] text-[var(--mute)]'>
        Throw when the marker is in the green
      </p>
    </div>
  );
}
