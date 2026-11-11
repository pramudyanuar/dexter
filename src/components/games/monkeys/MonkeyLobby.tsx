'use client';

import * as React from 'react';

import {
  CAMPAIGN,
  CAMPAIGN_KEY,
  Mode,
  MODE_INFO,
  MODES,
  MODULE_INFO,
  MODULE_KINDS,
  MonkeyConfig,
  Role,
  ROLE_INFO,
  ROLES,
  sanitizeMonkeys,
  Spec,
} from '@/lib/games/monkeys-config';
import type { RoomView } from '@/lib/rooms/types';
import type { useRoom } from '@/lib/rooms/useRoom';
import useStoredState from '@/lib/useStoredState';

import { seatName } from '@/components/games/lang';
import { Stepper } from '@/components/games/LobbyControls';
import MonkeyArt from '@/components/games/monkeys/MonkeyArt';
import { inviteLink, useCopy } from '@/components/games/RoomBar';
import { NameEditor } from '@/components/games/RoomGate';
import { seatColor } from '@/components/games/sekata/labels';

type Api = ReturnType<typeof useRoom>;

const outline =
  'rounded-lg border border-line-strong px-3 py-1.5 text-sm text-[var(--mute)] transition-colors hover:border-[var(--mute)] hover:text-ink disabled:opacity-40';

/** The waiting room: three seats, the bomb to build, and who plays which monkey. */
export default function MonkeyLobby({ r }: { r: Api }) {
  const { copied, copy } = useCopy();
  const [progress] = useStoredState<{ cleared: number; endless: number }>(
    CAMPAIGN_KEY,
    { cleared: 0, endless: 0 },
  );
  if (!r.session || !r.room) return null;
  const { code, you } = r.session;
  const room = r.room as RoomView;
  const cfg = sanitizeMonkeys(room.options);
  const isHost = room.host === you;
  const locked = !isHost || r.busy;
  const seats = [0, 1, 2];
  const taken = room.joined.filter(Boolean).length;
  const full = taken === 3;

  const set = (patch: Partial<MonkeyConfig>) =>
    void r.setOptions({ ...cfg, ...patch });
  const setSpec = (patch: Partial<Spec>) =>
    set({ custom: { ...cfg.custom, ...patch } });
  const unlocked = Math.min(CAMPAIGN.length, progress.cleared + 1);
  const spec = cfg.mode === 'campaign' ? CAMPAIGN[cfg.level - 1] : cfg.custom;

  const setRole = (seat: number, role: Role) => {
    // swap with whoever has it, so the three roles stay one each
    const next = [...cfg.assign];
    const other = next.indexOf(role);
    next[other] = next[seat];
    next[seat] = role;
    set({ assign: next });
  };

  return (
    <div className='mx-auto w-full max-w-3xl'>
      <header className='mb-6 text-center'>
        <div className='mb-2 flex justify-center gap-1'>
          {ROLES.map((role) => (
            <MonkeyArt key={role} role={role} className='size-16' />
          ))}
        </div>
        <h1 className='text-3xl font-black tracking-[0.12em] text-[#e0b84c] sm:text-4xl'>
          THREE MONKEYS
        </h1>
        <p className='text-sm font-semibold tracking-[0.3em] text-[var(--mute)]'>
          BOMB DEFUSAL
        </p>
        <p className='mx-auto mt-2 max-w-md text-sm text-[var(--mute)]'>
          Exactly three players. One can touch the bomb but not see it, one can
          read the manual but not speak, one can see and talk but not hear.
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
                {taken} of 3
              </span>
            </div>
            <ul className='space-y-2'>
              {seats.map((seat) => {
                if (!room.joined[seat])
                  return (
                    <li
                      key={seat}
                      className='rounded-xl border border-dashed border-line px-3 py-3 text-sm text-[var(--mute)]'
                    >
                      Waiting for a player…
                    </li>
                  );
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
                    {cfg.roles === 'host' && (
                      <select
                        aria-label={`Role for ${label}`}
                        value={cfg.assign[seat]}
                        disabled={locked}
                        onChange={(e) => setRole(seat, e.target.value as Role)}
                        className='rounded-md border border-line bg-card px-1.5 py-1 text-xs'
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_INFO[role].title}
                          </option>
                        ))}
                      </select>
                    )}
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
            <h2 className='mb-2 text-sm font-semibold'>Mode</h2>
            <div className='grid grid-cols-2 gap-2'>
              {MODES.map((m: Mode) => (
                <button
                  key={m}
                  type='button'
                  disabled={locked}
                  aria-pressed={cfg.mode === m}
                  onClick={() => set({ mode: m })}
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

            {cfg.mode === 'campaign' && (
              <div className='mt-3'>
                <p className='mb-1.5 text-xs text-[var(--mute)]'>
                  Level (you have cleared {progress.cleared} of{' '}
                  {CAMPAIGN.length})
                </p>
                <div className='grid grid-cols-5 gap-1.5'>
                  {CAMPAIGN.map((_, i) => {
                    const n = i + 1;
                    const open = n <= unlocked;
                    return (
                      <button
                        key={n}
                        type='button'
                        disabled={locked || !open}
                        aria-pressed={cfg.level === n}
                        aria-label={open ? `Level ${n}` : `Level ${n}, locked`}
                        onClick={() => set({ level: n })}
                        className={`h-9 rounded-lg border text-sm font-bold transition-colors disabled:opacity-40 ${
                          cfg.level === n
                            ? 'border-[#e0b84c] bg-[#e0b84c]/10'
                            : 'border-line'
                        }`}
                      >
                        {open ? n : '🔒'}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {cfg.mode === 'endless' && (
              <p className='mt-2 text-xs text-[var(--mute)]'>
                Your best on this device: {progress.endless} bombs.
              </p>
            )}

            {(cfg.mode === 'campaign' || cfg.mode === 'custom') && spec && (
              <p className='mt-3 text-xs text-[var(--mute)]'>
                {spec.modules} modules · {Math.floor(spec.seconds / 60)}:
                {String(spec.seconds % 60).padStart(2, '0')} · {spec.mistakes}{' '}
                mistakes allowed
              </p>
            )}

            {cfg.mode === 'custom' && (
              <div className='mt-2 divide-y divide-line'>
                <Stepper
                  label='Seconds on the clock'
                  value={cfg.custom.seconds}
                  min={60}
                  max={900}
                  step={30}
                  disabled={locked}
                  onChange={(v) => setSpec({ seconds: v })}
                />
                <Stepper
                  label='Modules'
                  value={cfg.custom.modules}
                  min={3}
                  max={5}
                  disabled={locked}
                  onChange={(v) => setSpec({ modules: v })}
                />
                <Stepper
                  label='Difficulty'
                  value={cfg.custom.difficulty}
                  min={1}
                  max={3}
                  disabled={locked}
                  onChange={(v) => setSpec({ difficulty: v as 1 | 2 | 3 })}
                />
                <Stepper
                  label='Mistakes allowed'
                  value={cfg.custom.mistakes}
                  min={1}
                  max={9}
                  disabled={locked}
                  onChange={(v) => setSpec({ mistakes: v })}
                />
                <Stepper
                  label='Seconds lost per mistake'
                  value={cfg.custom.penalty}
                  min={0}
                  max={60}
                  step={5}
                  disabled={locked}
                  onChange={(v) => setSpec({ penalty: v })}
                />
                <div className='py-2'>
                  <p className='mb-1.5 text-sm'>Puzzles</p>
                  <div className='flex flex-wrap gap-1.5'>
                    {MODULE_KINDS.map((k) => {
                      const on = cfg.custom.kinds.includes(k);
                      return (
                        <button
                          key={k}
                          type='button'
                          disabled={
                            locked || (on && cfg.custom.kinds.length === 1)
                          }
                          aria-pressed={on}
                          onClick={() =>
                            setSpec({
                              kinds: on
                                ? cfg.custom.kinds.filter((x) => x !== k)
                                : [...cfg.custom.kinds, k],
                            })
                          }
                          className={`rounded-full border px-3 py-1 text-xs font-semibold disabled:opacity-60 ${
                            on
                              ? 'border-[#e0b84c] bg-[#e0b84c]/10'
                              : 'border-line text-[var(--mute)]'
                          }`}
                        >
                          {MODULE_INFO[k].glyph} {MODULE_INFO[k].title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className='rounded-2xl border border-line bg-surface/50 p-4'>
            <h2 className='mb-2 text-sm font-semibold'>Roles</h2>
            <div className='flex gap-2'>
              {(['random', 'host'] as const).map((v) => (
                <button
                  key={v}
                  type='button'
                  disabled={locked}
                  aria-pressed={cfg.roles === v}
                  onClick={() => set({ roles: v })}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-60 ${
                    cfg.roles === v
                      ? 'border-[#e0b84c] bg-[#e0b84c]/10'
                      : 'border-line'
                  }`}
                >
                  {v === 'random' ? 'Random' : 'Host chooses'}
                </button>
              ))}
            </div>
            <ul className='mt-3 space-y-1.5 text-xs text-[var(--mute)]'>
              {ROLES.map((role) => (
                <li key={role}>
                  <strong className='text-ink'>{ROLE_INFO[role].title}:</strong>{' '}
                  {ROLE_INFO[role].can}
                </li>
              ))}
            </ul>
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
            disabled={r.busy || !full}
            className='rounded-full bg-[#e0b84c] px-10 py-3 text-base font-black tracking-wider text-[#2a1f00] shadow-[0_4px_0_#9c7d2e] transition-[transform,box-shadow,opacity] hover:-translate-y-0.5 active:translate-y-1 active:shadow-none disabled:opacity-40 disabled:shadow-none'
          >
            {full ? 'START' : `NEED ${3 - taken} MORE`}
          </button>
        ) : (
          <p className='text-sm text-[var(--mute)]' aria-live='polite'>
            {full
              ? 'Waiting for the host to start…'
              : 'Waiting for the third monkey…'}
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
