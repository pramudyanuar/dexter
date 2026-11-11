'use client';

import * as React from 'react';

import {
  DEFAULT_REMO,
  MODE_INFO,
  modeDefaults,
  REMO_MODES,
  RemoConfig,
  sanitizeRemo,
} from '@/lib/games/remo-config';
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

/**
 * The waiting room for Remo: who is here, the code to share, the game mode and
 * the rules. The host sets it up; everyone sees the settings change.
 */
export default function RemoLobby({ r }: { r: Api }) {
  const { copied, copy } = useCopy();
  if (!r.session || !r.room) return null;
  const { code, you } = r.session;
  const room = r.room as RoomView;
  const cfg = sanitizeRemo(room.options ?? DEFAULT_REMO);
  const isHost = room.host === you;
  const seats = room.joined.flatMap((taken, seat) => (taken ? [seat] : []));
  const enough = seats.length >= room.minPlayers;
  const locked = !isHost || r.busy;

  const set = (patch: Partial<RemoConfig>) =>
    void r.setOptions({ ...cfg, ...patch });
  const setMode = (mode: RemoConfig['mode']) =>
    void r.setOptions({ ...DEFAULT_REMO, ...modeDefaults(mode), mode });

  return (
    <div className='mx-auto w-full max-w-3xl'>
      <header className='mb-6 text-center'>
        <h1 className='text-5xl font-black tracking-[0.2em] text-[#d9b45a]'>
          REMO
        </h1>
        <p className='mx-auto mt-2 max-w-md text-sm text-[var(--mute)]'>
          Rummy for two to four. Build sequences and sets, and be the first to
          get rid of every card.
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
                {seats.length} of {room.capacity} · at least {room.minPlayers}
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
                        <span className='ml-2 rounded-full bg-[#d9b45a]/20 px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#d9b45a] uppercase'>
                          Host
                        </span>
                      )}
                    </span>
                    <span className='flex items-center gap-1.5 text-xs text-[#7cc576]'>
                      <span className='size-2 rounded-full bg-[#7cc576]' />
                      Ready
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
            {!enough && (
              <p className='mt-3 text-center text-xs text-[var(--mute)]'>
                Waiting for another player.
              </p>
            )}
            <NameEditor r={r} />
          </section>
        </div>

        <div className='space-y-4'>
          <section className='rounded-2xl border border-line bg-surface/50 p-4'>
            <h2 className='mb-2 text-sm font-semibold'>Mode</h2>
            <div className='grid grid-cols-2 gap-2'>
              {REMO_MODES.map((m) => (
                <button
                  key={m}
                  type='button'
                  disabled={locked}
                  aria-pressed={cfg.mode === m}
                  onClick={() => setMode(m)}
                  className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold transition-colors disabled:opacity-60 ${
                    cfg.mode === m
                      ? 'border-[#d9b45a] bg-[#d9b45a]/10'
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
          </section>

          <details
            open
            className='group rounded-2xl border border-line bg-surface/40'
          >
            <summary className='flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium select-none'>
              Cards and combinations
              <span className='text-[var(--mute)] transition-transform group-open:rotate-90'>
                ›
              </span>
            </summary>
            <div className='divide-y divide-line px-4 pb-3'>
              <Stepper
                label='Cards each'
                value={cfg.handSize}
                min={4}
                max={10}
                disabled={locked}
                onChange={(v) => set({ handSize: v })}
              />
              <Stepper
                label='Jokers'
                value={cfg.jokers}
                min={0}
                max={4}
                zero='none'
                disabled={locked}
                onChange={(v) => set({ jokers: v })}
              />
              {cfg.jokers > 0 && (
                <Stepper
                  label='Jokers per combination'
                  value={cfg.jokerLimit}
                  min={1}
                  max={4}
                  disabled={locked}
                  onChange={(v) => set({ jokerLimit: v })}
                />
              )}
              <Switch
                label='Ace can be low (A-2-3)'
                on={cfg.aceLow}
                disabled={locked}
                onChange={(v) => set({ aceLow: v })}
              />
              <Switch
                label='Ace can be high (Q-K-A)'
                on={cfg.aceHigh}
                disabled={locked}
                onChange={(v) => set({ aceHigh: v })}
              />
              <Switch
                label='Add cards to combinations on the table'
                on={cfg.layoff}
                disabled={locked}
                onChange={(v) => set({ layoff: v })}
              />
            </div>
          </details>

          <details className='group rounded-2xl border border-line bg-surface/40'>
            <summary className='flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium select-none'>
              Turns and finishing
              <span className='text-[var(--mute)] transition-transform group-open:rotate-90'>
                ›
              </span>
            </summary>
            <div className='divide-y divide-line px-4 pb-3'>
              <Switch
                label='Going out needs every card laid down'
                on={cfg.finish === 'melded'}
                disabled={locked}
                onChange={(v) => set({ finish: v ? 'melded' : 'discard' })}
              />
              <Stepper
                label='Opening must be worth'
                value={cfg.initialMeld}
                min={0}
                max={60}
                step={5}
                zero='any'
                disabled={locked}
                onChange={(v) => set({ initialMeld: v })}
              />
              <Switch
                label='No discarding the card just taken'
                on={cfg.noSameDiscard}
                disabled={locked}
                onChange={(v) => set({ noSameDiscard: v })}
              />
              <Stepper
                label='Turn clock (seconds)'
                value={cfg.turnSeconds}
                min={0}
                max={300}
                step={15}
                zero='none'
                disabled={locked}
                onChange={(v) => set({ turnSeconds: v })}
              />
              {cfg.mode === 'point' && (
                <Stepper
                  label='Rounds'
                  value={cfg.rounds}
                  min={1}
                  max={10}
                  disabled={locked}
                  onChange={(v) => set({ rounds: v })}
                />
              )}
            </div>
          </details>

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
            disabled={!enough || r.busy}
            className='rounded-full bg-[#d9b45a] px-10 py-3 text-base font-black tracking-wider text-[#2b2208] shadow-[0_4px_0_#9c7d2e] transition-[transform,box-shadow,opacity] hover:-translate-y-0.5 active:translate-y-1 active:shadow-none disabled:opacity-40 disabled:shadow-none'
          >
            DEAL THE CARDS
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
