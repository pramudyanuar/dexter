'use client';

import * as React from 'react';

import type { Sign } from '@/lib/games/monkeys';
import {
  Gesture,
  GESTURE_INFO,
  GESTURES,
  Role,
} from '@/lib/games/monkeys-config';

import MonkeyArt from '@/components/games/monkeys/MonkeyArt';
import type { Voice } from '@/components/games/monkeys/useVoice';

/** Milliseconds left on the clock, counted down smoothly between server updates. */
export function useClock(
  remaining: number,
  receivedAt: number,
  paused: boolean,
) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [paused]);
  return paused
    ? remaining
    : Math.max(0, remaining - Math.max(0, now - receivedAt));
}

export const clockText = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** The countdown, the mistakes allowed, and where we are. Roles see it differently. */
export function Hud({
  ms,
  total,
  mistakes,
  allowed,
  role,
  label,
  penalty,
}: {
  ms: number;
  total: number;
  mistakes: number;
  allowed: number;
  role: Role | null;
  label: string;
  penalty: number;
}) {
  const hot = ms < 30_000;
  const blind = role === 'blind';
  return (
    <div
      className={`mb-4 flex items-center justify-between gap-3 rounded-2xl border px-4 py-2.5 ${
        hot ? 'a-alarm border-err/60' : 'border-line'
      } ${blind ? 'bg-[#1c1f25]' : 'bg-surface/50'}`}
    >
      <div className='min-w-0'>
        <p className='truncate text-[11px] tracking-wide text-[var(--mute)] uppercase'>
          {label}
        </p>
        {blind ? (
          <div
            role='img'
            aria-label='Time is running down'
            className='mt-1.5 h-2.5 w-36 overflow-hidden rounded-full bg-[#2e323b] sm:w-56'
          >
            <div
              className='h-full rounded-full bg-[#9aa0aa] transition-[width] duration-200'
              style={{ width: `${Math.min(100, (ms / total) * 100)}%` }}
            />
          </div>
        ) : (
          <p
            className={`font-mono text-3xl leading-none font-black tabular-nums ${hot ? 'text-err' : ''}`}
            aria-label={`${clockText(ms)} left`}
          >
            {clockText(ms)}
          </p>
        )}
      </div>
      <div className='text-right'>
        <p className='text-[11px] tracking-wide text-[var(--mute)] uppercase'>
          Mistakes
        </p>
        <div
          className='mt-1 flex justify-end gap-1.5'
          role='img'
          aria-label={`${mistakes} of ${allowed + 1} mistakes. One more than ${allowed} and it blows.`}
        >
          {Array.from({ length: allowed + 1 }, (_, i) => (
            <span
              key={i}
              className={`size-3.5 rounded-full border ${
                i < mistakes
                  ? blind
                    ? 'border-[#c4c9d2] bg-[#c4c9d2]'
                    : 'border-err bg-err'
                  : 'border-line-strong'
              }`}
            />
          ))}
        </div>
        {penalty > 0 && !blind && (
          <p className='mt-1 text-[10px] text-[var(--mute)]'>
            −{penalty}s each
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- gestures

const WHEEL = 340;
const RADIUS = 122;

/** The Mute Monkey's only voice: a wheel of gestures. */
export function GestureWheel({
  onSign,
  last,
  disabled,
}: {
  onSign: (g: Gesture) => void;
  last?: Sign;
  disabled: boolean;
}) {
  return (
    <div
      className='relative mx-auto max-w-full'
      style={{ width: WHEEL, height: WHEEL }}
      role='group'
      aria-label='Gesture wheel'
    >
      <div className='absolute inset-0 rounded-full border border-line bg-surface/40' />
      <div className='absolute top-1/2 left-1/2 flex size-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-card'>
        {last ? (
          <span key={last.seq} className='a-sign text-5xl'>
            {GESTURE_INFO[last.g].glyph}
          </span>
        ) : (
          <MonkeyArt role='mute' className='size-20' />
        )}
      </div>
      {GESTURES.map((g, i) => {
        const a = (i / GESTURES.length) * Math.PI * 2 - Math.PI / 2;
        return (
          <button
            key={g}
            type='button'
            disabled={disabled}
            onClick={() => onSign(g)}
            aria-label={GESTURE_INFO[g].label}
            title={GESTURE_INFO[g].label}
            className='absolute flex size-[50px] items-center justify-center rounded-full border border-line-strong bg-card text-2xl transition-[transform,border-color,background-color] hover:border-[#e0b84c] hover:bg-[#e0b84c]/10 focus-visible:border-[#e0b84c] active:scale-90 disabled:opacity-50'
            style={{
              left: WHEEL / 2 + Math.cos(a) * RADIUS - 25,
              top: WHEEL / 2 + Math.sin(a) * RADIUS - 25,
            }}
          >
            {GESTURE_INFO[g].glyph}
          </button>
        );
      })}
    </div>
  );
}

/** What the Mute Monkey has said lately, newest on the right. */
export function SignStrip({ signs }: { signs: Sign[] }) {
  return (
    <ol
      className='flex min-h-11 flex-wrap items-center gap-1.5'
      aria-label='Recent gestures'
    >
      {signs.length === 0 && (
        <li className='text-xs text-[var(--mute)]'>Nothing yet</li>
      )}
      {signs.map((s, i) => (
        <li
          key={s.seq}
          title={GESTURE_INFO[s.g].label}
          className={`flex size-10 items-center justify-center rounded-lg border text-xl ${
            i === signs.length - 1
              ? 'border-[#e0b84c] bg-[#e0b84c]/10'
              : 'border-line opacity-60'
          }`}
        >
          {GESTURE_INFO[s.g].glyph}
        </li>
      ))}
    </ol>
  );
}

/** What each gesture means, for the Deaf Monkey who has no manual to ask. */
export function GestureLegend() {
  return (
    <ul className='grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-3'>
      {GESTURES.map((g) => (
        <li key={g} className='flex items-center gap-1.5'>
          <span className='text-base'>{GESTURE_INFO[g].glyph}</span>
          <span className='text-[var(--mute)]'>{GESTURE_INFO[g].hint}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- voice

const VOICE_TEXT: Record<Voice['status'], string> = {
  off: 'Voice is not available',
  asking: 'Allow the microphone to talk to the Blind Monkey…',
  denied: 'Microphone blocked. Allow it in the browser, then try again.',
  nomic: 'No microphone found',
  waiting: 'Waiting for the other monkey',
  connecting: 'Connecting…',
  live: 'Connected',
  lost: 'Connection lost, trying again…',
};

/** Voice status and the one switch each side needs. */
export function VoiceBar({
  voice,
  dir,
  dark,
}: {
  voice: Voice;
  dir: 'send' | 'receive';
  dark?: boolean;
}) {
  const send = dir === 'send';
  const bad = voice.status === 'denied' || voice.status === 'nomic';
  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-2xl border px-3 py-2 text-sm ${
        dark ? 'border-[#444a55] bg-[#1c1f25]' : 'border-line bg-surface/50'
      }`}
    >
      <span
        aria-hidden
        className={`size-2.5 shrink-0 rounded-full ${
          voice.status === 'live'
            ? 'bg-accent'
            : bad
              ? 'bg-err'
              : 'a-spark bg-[#e0b84c]'
        }`}
      />
      <span className='min-w-0 flex-1' role='status'>
        <span className='block text-xs text-[var(--mute)]'>
          {send ? 'Your voice → Blind Monkey' : 'Deaf Monkey’s voice'}
        </span>
        {VOICE_TEXT[voice.status]}
        {voice.blocked && ' · tap to hear'}
      </span>
      {voice.status === 'live' && (
        <span aria-hidden className='flex h-5 items-end gap-0.5'>
          {[0.25, 0.5, 0.75, 1].map((t) => (
            <span
              key={t}
              className={`w-1 rounded-sm transition-[height,background-color] ${
                voice.level >= t * 0.8 && !(send && voice.muted)
                  ? 'bg-accent'
                  : 'bg-line-strong'
              }`}
              style={{ height: `${t * 100}%` }}
            />
          ))}
        </span>
      )}
      {(bad || voice.blocked) && (
        <button
          type='button'
          onClick={voice.retry}
          className='rounded-lg border border-line-strong px-2.5 py-1 text-xs hover:border-[var(--mute)]'
        >
          {voice.blocked ? 'Hear' : 'Try again'}
        </button>
      )}
      {send ? (
        <button
          type='button'
          onClick={voice.toggleMute}
          aria-pressed={voice.muted}
          className={`rounded-lg border px-3 py-1 text-xs font-semibold ${
            voice.muted ? 'border-err text-err' : 'border-line-strong'
          }`}
        >
          {voice.muted ? '🔇 Mic off' : '🎙️ Mic on'}
        </button>
      ) : (
        <button
          type='button'
          onClick={voice.toggleDeafen}
          aria-pressed={voice.deafened}
          className={`rounded-lg border px-3 py-1 text-xs font-semibold ${
            voice.deafened ? 'border-err text-err' : 'border-line-strong'
          }`}
        >
          {voice.deafened ? '🔇 Sound off' : '🔊 Sound on'}
        </button>
      )}
    </div>
  );
}
