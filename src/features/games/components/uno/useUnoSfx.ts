'use client';

import * as React from 'react';

import useStoredState from '@/hooks/useStoredState';

export type UnoSound =
  | 'card'
  | 'draw'
  | 'turn'
  | 'uno'
  | 'bad'
  | 'skip'
  | 'reverse'
  | 'wild'
  | 'flip'
  | 'swap'
  | 'win'
  | 'lose'
  | 'emote';

/** [frequency, start (s), length (s)] */
const TONES: Partial<Record<UnoSound, [number, number, number][]>> = {
  turn: [
    [660, 0, 0.07],
    [880, 0.08, 0.1],
  ],
  uno: [
    [523, 0, 0.09],
    [784, 0.09, 0.09],
    [1047, 0.18, 0.22],
  ],
  bad: [
    [240, 0, 0.12],
    [170, 0.11, 0.2],
  ],
  skip: [
    [500, 0, 0.06],
    [320, 0.07, 0.12],
  ],
  reverse: [
    [400, 0, 0.07],
    [600, 0.07, 0.07],
    [400, 0.14, 0.1],
  ],
  wild: [
    [440, 0, 0.06],
    [554, 0.06, 0.06],
    [659, 0.12, 0.06],
    [880, 0.18, 0.14],
  ],
  flip: [
    [300, 0, 0.1],
    [900, 0.1, 0.16],
  ],
  swap: [
    [700, 0, 0.08],
    [500, 0.1, 0.08],
    [700, 0.2, 0.08],
    [500, 0.3, 0.12],
  ],
  win: [
    [523, 0, 0.12],
    [659, 0.12, 0.12],
    [784, 0.24, 0.12],
    [1047, 0.36, 0.3],
  ],
  lose: [
    [392, 0, 0.16],
    [330, 0.16, 0.16],
    [262, 0.32, 0.3],
  ],
  emote: [[980, 0, 0.05]],
};
const HARSH = new Set<UnoSound>(['bad', 'lose']);

/**
 * Small synthesised sounds for the table, with a mute switch that is
 * remembered. A card is a short burst of filtered noise, like one being flicked
 * down; everything else is a few notes.
 */
export default function useUnoSfx() {
  const [muted, setMuted] = useStoredState<boolean>('uno-muted', false);
  const ctx = React.useRef<AudioContext | null>(null);

  const play = React.useCallback(
    (kind: UnoSound) => {
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

        if (kind === 'card' || kind === 'draw') {
          const length = kind === 'card' ? 0.09 : 0.14;
          const buffer = ac.createBuffer(
            1,
            Math.ceil(ac.sampleRate * length),
            ac.sampleRate,
          );
          const data = buffer.getChannelData(0);
          for (let i = 0; i < data.length; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
          }
          const noise = ac.createBufferSource();
          noise.buffer = buffer;
          const filter = ac.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(kind === 'card' ? 2600 : 900, t0);
          filter.frequency.exponentialRampToValueAtTime(
            kind === 'card' ? 700 : 2400,
            t0 + length,
          );
          const gain = ac.createGain();
          gain.gain.value = 0.5;
          noise.connect(filter).connect(gain).connect(ac.destination);
          noise.start(t0);
          return;
        }

        for (const [freq, at, len] of TONES[kind] ?? []) {
          const osc = ac.createOscillator();
          const gain = ac.createGain();
          osc.type = HARSH.has(kind) ? 'sawtooth' : 'triangle';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.0001, t0 + at);
          gain.gain.exponentialRampToValueAtTime(0.11, t0 + at + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len);
          osc.connect(gain).connect(ac.destination);
          osc.start(t0 + at);
          osc.stop(t0 + at + len + 0.02);
        }
      } catch {
        // no audio here: the game is the same without it
      }
    },
    [muted],
  );

  /** A short buzz on phones that have one. */
  const buzz = React.useCallback(
    (pattern: number | number[]) => {
      if (muted) return;
      try {
        navigator.vibrate?.(pattern);
      } catch {
        // not allowed, or no motor
      }
    },
    [muted],
  );

  return { play, buzz, muted, setMuted };
}
