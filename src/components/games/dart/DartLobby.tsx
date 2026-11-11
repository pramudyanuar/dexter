'use client';

import * as React from 'react';

import {
  DART_MODES,
  DartConfig,
  DEFAULT_DART,
  MODE_INFO,
  sanitizeDart,
  startFor,
} from '@/lib/games/dart-config';
import type { RoomView } from '@/lib/rooms/types';
import type { useRoom } from '@/lib/rooms/useRoom';

import { seatName } from '@/components/games/lang';
import { Stepper, Switch } from '@/components/games/LobbyControls';
import { inviteLink, useCopy } from '@/components/games/RoomBar';
import { NameEditor } from '@/components/games/RoomGate';
import { seatColor } from '@/components/games/sekata/labels';

type Api = ReturnType<typeof useRoom>;

const outline =
  'rounded-lg border border-line-strong px-3 py-1.5 text-sm text-[var(--mute)] transition-colors hover:border-[var(--mute)] hover:text-ink disabled:opacity-40';

function Choice<T extends string>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; title: string; hint?: string }[];
  disabled: boolean;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <h3 className='mb-1.5 text-sm font-semibold'>{label}</h3>
      <div className='flex gap-2'>
        {options.map((o) => (
          <button
            key={o.id}
            type='button'
            aria-pressed={value === o.id}
            disabled={disabled}
            onClick={() => onChange(o.id)}
            className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${
              value === o.id
                ? 'border-[#e0b84c] bg-[#e0b84c]/10'
                : 'border-line hover:border-line-strong'
            }`}
          >
            {o.title}
          </button>
        ))}
      </div>
      <p className='mt-1.5 text-xs text-[var(--mute)]'>
        {options.find((o) => o.id === value)?.hint}
      </p>
    </div>
  );
}

/**
 * The waiting room for Dart: who is here, the code to share, the game and how
 * darts are thrown. The host sets it up; everyone sees the settings change.
 */
export default function DartLobby({ r }: { r: Api }) {
  const { copied, copy } = useCopy();
  if (!r.session || !r.room) return null;
  const { code, you } = r.session;
  const room = r.room as RoomView;
  const cfg = sanitizeDart(room.options ?? DEFAULT_DART);
  const isHost = room.host === you;
  const seats = room.joined.flatMap((taken, seat) => (taken ? [seat] : []));
  const locked = !isHost || r.busy;
  const x01 = cfg.mode === '301' || cfg.mode === '501';

  const set = (patch: Partial<DartConfig>) =>
    void r.setOptions({ ...cfg, ...patch });

  return (
    <div className='mx-auto w-full max-w-3xl'>
      <header className='mb-6 text-center'>
        <h1 className='text-5xl font-black tracking-[0.2em] text-[#e0b84c]'>
          DART
        </h1>
        <p className='mx-auto mt-2 max-w-md text-sm text-[var(--mute)]'>
          Aim, throw, and compete to become the ultimate dart champion. One to
          four players.
        </p>
      </header>

      <div className='grid gap-5 md:grid-cols-[1fr_1.3fr]'>
        <div className='space-y-5'>
          <section className='rounded-2xl border border-line bg-surface/50 p-5 text-center'>
            <p className='text-xs text-[var(--mute)]'>Room code</p>
            <button
              type='button'
              onClick={() => copy('code', code)}
              aria-label={`Copy room code ${code}`}
              className='mt-1 font-mono text-4xl font-medium tracking-[0.3em] transition-opacity hover:opacity-80'
            >
              {code}
            </button>
            <p
              className='mt-1 h-4 text-xs text-[var(--mute)]'
              aria-live='polite'
            >
              {copied === 'code' ? 'Copied' : 'Tap to copy'}
            </p>
            <button
              type='button'
              onClick={() => copy('link', inviteLink(code))}
              className={`${outline} mt-2`}
            >
              {copied === 'link' ? 'Link copied' : 'Copy invite link'}
            </button>
          </section>

          <section>
            <div className='mb-2 flex items-baseline justify-between'>
              <h2 className='text-sm font-semibold'>Players</h2>
              <span className='text-xs text-[var(--mute)]' aria-live='polite'>
                {seats.length} of {room.capacity}
              </span>
            </div>
            <ul className='space-y-2'>
              {seats.map((seat) => {
                const label = seatName('en', seat, you, room.names);
                return (
                  <li
                    key={seat}
                    className='a-pop flex items-center gap-3 rounded-xl border border-line bg-surface/50 px-3 py-2'
                  >
                    <span
                      aria-hidden
                      className='flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-[#17181c] uppercase'
                      style={{ background: seatColor(seat) }}
                    >
                      {(room.names[seat] || 'P').charAt(0)}
                    </span>
                    <span className='min-w-0 flex-1 truncate text-sm'>
                      {label}
                      {room.host === seat && (
                        <span className='ml-2 rounded-full bg-[#e0b84c]/20 px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#e0b84c] uppercase'>
                          Host
                        </span>
                      )}
                    </span>
                    {isHost && seat !== you && (
                      <button
                        type='button'
                        onClick={() => r.kick(seat)}
                        disabled={r.busy}
                        aria-label={`Remove ${label}`}
                        className='text-xs text-[var(--mute)] hover:text-err'
                      >
                        remove
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            <NameEditor r={r} />
          </section>
        </div>

        <div className='space-y-4'>
          <section className='rounded-2xl border border-line bg-surface/50 p-4'>
            <h2 className='mb-2 text-sm font-semibold'>Game</h2>
            <div className='grid grid-cols-2 gap-2'>
              {DART_MODES.map((m) => (
                <button
                  key={m}
                  type='button'
                  disabled={locked}
                  aria-pressed={cfg.mode === m}
                  onClick={() => set({ mode: m, startScore: startFor(m) })}
                  className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold transition-colors disabled:opacity-60 ${
                    cfg.mode === m
                      ? 'border-[#e0b84c] bg-[#e0b84c]/10'
                      : 'border-line hover:border-line-strong'
                  }`}
                >
                  {MODE_INFO[m].title}
                </button>
              ))}
            </div>
            <p className='mt-3 text-sm text-[var(--mute)]' aria-live='polite'>
              {MODE_INFO[cfg.mode].blurb}
            </p>
            <div className='mt-2 divide-y divide-line'>
              {x01 && (
                <Stepper
                  label='Starting score'
                  value={cfg.startScore}
                  min={61}
                  max={1001}
                  step={20}
                  disabled={locked}
                  onChange={(v) => set({ startScore: v })}
                />
              )}
              {x01 && (
                <Switch
                  label='Double out'
                  on={cfg.doubleOut}
                  disabled={locked}
                  onChange={(v) => set({ doubleOut: v })}
                />
              )}
              {cfg.mode === 'countup' && (
                <Stepper
                  label='Rounds'
                  value={cfg.rounds}
                  min={1}
                  max={20}
                  disabled={locked}
                  onChange={(v) => set({ rounds: v })}
                />
              )}
              {cfg.mode === 'clock' && (
                <Switch
                  label='Bullseye finale'
                  on={cfg.clockBull}
                  disabled={locked}
                  onChange={(v) => set({ clockBull: v })}
                />
              )}
              {cfg.mode !== 'countup' && (
                <Stepper
                  label='Round limit'
                  value={cfg.maxRounds}
                  min={0}
                  max={50}
                  zero='none'
                  disabled={locked}
                  onChange={(v) => set({ maxRounds: v })}
                />
              )}
            </div>
          </section>

          <section className='space-y-4 rounded-2xl border border-line bg-surface/50 p-4'>
            <Choice
              label='Throwing'
              value={cfg.throwMode}
              disabled={locked}
              onChange={(v) => set({ throwMode: v })}
              options={[
                {
                  id: 'casual',
                  title: 'Casual',
                  hint: 'The dart goes almost exactly where you aim, with a tiny wobble.',
                },
                {
                  id: 'skill',
                  title: 'Skill',
                  hint: 'Your aim shakes and you must time the throw. Better timing, tighter darts.',
                },
              ]}
            />
            <Choice
              label='Difficulty'
              value={cfg.difficulty}
              disabled={locked}
              onChange={(v) => set({ difficulty: v })}
              options={[
                { id: 'easy', title: 'Easy', hint: 'A steadier hand.' },
                { id: 'normal', title: 'Normal', hint: 'The standard spread.' },
                {
                  id: 'hard',
                  title: 'Hard',
                  hint: 'Shaky hands and wild darts.',
                },
              ]}
            />
          </section>

          {!isHost && (
            <p className='text-center text-xs text-[var(--mute)]'>
              Only the host can change the settings.
            </p>
          )}
        </div>
      </div>

      {r.error && (
        <p className='mt-4 text-center text-sm text-err' role='alert'>
          {r.error}
        </p>
      )}

      <div className='mt-6 flex flex-col items-center gap-3'>
        {isHost ? (
          <button
            type='button'
            onClick={r.start}
            disabled={r.busy}
            className='rounded-full bg-[#e0b84c] px-10 py-3 text-base font-black tracking-wider text-[#2a1f00] shadow-[0_4px_0_#9c7d2e] transition-[transform,box-shadow,opacity] hover:-translate-y-0.5 active:translate-y-1 active:shadow-none disabled:opacity-40 disabled:shadow-none'
          >
            START MATCH
          </button>
        ) : (
          <p className='text-sm text-[var(--mute)]' aria-live='polite'>
            Waiting for the host to start…
          </p>
        )}
        <button
          type='button'
          onClick={r.leave}
          className={`${outline} hover:border-err hover:text-err`}
        >
          Leave
        </button>
      </div>
    </div>
  );
}
