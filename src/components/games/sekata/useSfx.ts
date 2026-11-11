'use client';

import * as React from 'react';

import useStoredState from '@/lib/useStoredState';

export type Sfx =
  'tap' | 'ok' | 'bad' | 'draw' | 'win' | 'tick' | 'cut' | 'alarm' | 'boom';

const TONES: Record<Sfx, [number, number, number][]> = {
  // [frequency, start (s), length (s)]
  tap: [[620, 0, 0.05]],
  tick: [[900, 0, 0.04]],
  ok: [
    [520, 0, 0.09],
    [780, 0.09, 0.14],
  ],
  bad: [
    [220, 0, 0.12],
    [160, 0.1, 0.18],
  ],
  cut: [
    [1400, 0, 0.03],
    [700, 0.03, 0.06],
  ],
  alarm: [
    [880, 0, 0.12],
    [660, 0.14, 0.12],
    [880, 0.28, 0.12],
  ],
  boom: [
    [110, 0, 0.5],
    [70, 0.05, 0.6],
    [45, 0.1, 0.7],
  ],
  draw: [
    [330, 0, 0.06],
    [440, 0.06, 0.06],
    [560, 0.12, 0.08],
  ],
  win: [
    [523, 0, 0.12],
    [659, 0.12, 0.12],
    [784, 0.24, 0.12],
    [1047, 0.36, 0.3],
  ],
};

/** Small synthesised sounds, with a mute switch that is remembered. */
export default function useSfx() {
  const [muted, setMuted] = useStoredState<boolean>('sekata-muted', false);
  const ctx = React.useRef<AudioContext | null>(null);

  const play = React.useCallback(
    (kind: Sfx) => {
      if (muted) return;
      try {
        const AC =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!AC) return;
        ctx.current ??= new AC();
        const ac = ctx.current;
        if (ac.state === 'suspended') void ac.resume();
        const t0 = ac.currentTime;
        for (const [freq, at, len] of TONES[kind]) {
          const osc = ac.createOscillator();
          const gain = ac.createGain();
          osc.type =
            kind === 'bad' || kind === 'boom' || kind === 'alarm'
              ? 'sawtooth'
              : 'triangle';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.0001, t0 + at);
          gain.gain.exponentialRampToValueAtTime(0.12, t0 + at + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len);
          osc.connect(gain).connect(ac.destination);
          osc.start(t0 + at);
          osc.stop(t0 + at + len + 0.02);
        }
      } catch {
        // no audio available: the game works without it
      }
    },
    [muted],
  );

  return { play, muted, toggle: () => setMuted(!muted) };
}
