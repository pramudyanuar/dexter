'use client';

import * as React from 'react';

import {
  autoWolves,
  DEFAULT_WEREWOLF,
  enabled,
  MIN_PLAYERS,
  PRESET_INFO,
  presetConfig,
  PRESETS,
  ROLES,
  sanitizeWerewolf,
  Toggle,
  TOGGLES,
  WerewolfConfig,
} from '@/lib/games/werewolf-config';
import type { RoomView } from '@/lib/rooms/types';
import type { useRoom } from '@/lib/rooms/useRoom';

import { seatName } from '@/components/games/lang';
import { Stepper, Switch } from '@/components/games/LobbyControls';
import { inviteLink, useCopy } from '@/components/games/RoomBar';
import { NameEditor } from '@/components/games/RoomGate';
import { seatColor } from '@/components/games/sekata/labels';
import { RoleBadge } from '@/components/games/werewolf/RoleArt';

type Api = ReturnType<typeof useRoom>;

const outline =
  'rounded-lg border border-line-strong px-3 py-1.5 text-sm text-[var(--mute)] transition-colors hover:border-[var(--mute)] hover:text-ink disabled:opacity-40';

function Group({
  title,
  open,
  children,
}: {
  title: string;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={open}
      className='group rounded-2xl border border-line bg-surface/40'
    >
      <summary className='flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium select-none'>
        {title}
        <span className='text-[var(--mute)] transition-transform group-open:rotate-90'>
          ›
        </span>
      </summary>
      <div className='divide-y divide-line px-4 pb-3'>{children}</div>
    </details>
  );
}

/**
 * The waiting room for Werewolf: who is here, who is the host, the preset, the
 * roles and every rule. The host sets it up and everyone sees it change.
 */
export default function WerewolfLobby({ r }: { r: Api }) {
  const { copied, copy } = useCopy();
  if (!r.session || !r.room) return null;
  const { code, you } = r.session;
  const room = r.room as RoomView;
  const cfg = sanitizeWerewolf(room.options ?? DEFAULT_WEREWOLF);
  const isHost = room.host === you;
  const seats = room.joined.flatMap((taken, seat) => (taken ? [seat] : []));
  const enough = seats.length >= MIN_PLAYERS;
  const locked = !isHost || r.busy;

  const set = (patch: Partial<WerewolfConfig>) =>
    void r.setOptions({ ...cfg, ...patch, preset: patch.preset ?? 'custom' });
  const setPreset = (preset: WerewolfConfig['preset']) =>
    void r.setOptions({ ...DEFAULT_WEREWOLF, ...presetConfig(preset), preset });
  const setRole = (role: Toggle, on: boolean) =>
    set({ roles: { ...cfg.roles, [role]: on } });

  return (
    <div className='mx-auto w-full max-w-3xl'>
      <header className='mb-6 text-center'>
        <h1 className='text-5xl font-black tracking-[0.18em] text-[#d4584f]'>
          WEREWOLF
        </h1>
        <p className='mx-auto mt-2 max-w-md text-sm text-[var(--mute)]'>
          Secret roles, long nights and a village that must find the wolves
          among them. An automatic moderator runs the game for everyone.
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
            <p className='mt-3 text-xs text-[var(--mute)]'>
              Anyone with the code can join. Only people who have it can find
              the room.
            </p>
          </section>

          <section>
            <div className='mb-2 flex items-baseline justify-between'>
              <h2 className='text-sm font-semibold'>Players</h2>
              <span
                className='text-xs text-[var(--mute)]'
                aria-live='polite'
                data-testid='count'
              >
                {seats.length} of {room.capacity} ·{' '}
                {Math.max(0, room.capacity - seats.length)} open
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
                        <span className='ml-2 rounded-full bg-[#d4584f]/20 px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#e0786f] uppercase'>
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
                Needs at least {MIN_PLAYERS} players:{' '}
                {MIN_PLAYERS - seats.length} more.
              </p>
            )}
            <NameEditor r={r} />
          </section>
        </div>

        <div className='space-y-4'>
          <section className='rounded-2xl border border-line bg-surface/50 p-4'>
            <h2 className='mb-2 text-sm font-semibold'>Mode</h2>
            <div className='grid grid-cols-2 gap-2'>
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type='button'
                  disabled={locked}
                  aria-pressed={cfg.preset === p}
                  onClick={() => setPreset(p)}
                  className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold transition-colors disabled:opacity-60 ${
                    cfg.preset === p
                      ? 'border-[#d4584f] bg-[#d4584f]/10'
                      : 'border-line hover:border-line-strong'
                  }`}
                >
                  {PRESET_INFO[p].title}
                </button>
              ))}
            </div>
            <p className='mt-3 text-sm text-[var(--mute)]' aria-live='polite'>
              {PRESET_INFO[cfg.preset].blurb}
            </p>
          </section>

          <Group title='Players and roles' open>
            <Stepper
              label='Maximum players'
              value={cfg.maxPlayers}
              min={MIN_PLAYERS}
              max={20}
              disabled={locked}
              onChange={(v) => set({ maxPlayers: v })}
            />
            <Stepper
              label='Werewolves'
              value={cfg.wolves}
              min={0}
              max={6}
              zero={`auto (${autoWolves(Math.max(seats.length, MIN_PLAYERS))})`}
              disabled={locked}
              onChange={(v) => set({ wolves: v })}
            />
            <Switch
              label='Role variations (Alpha, Jester, Mayor, Serial Killer, Mason)'
              on={cfg.variations}
              disabled={locked}
              onChange={(v) => set({ variations: v })}
            />
            <ul className='grid gap-1 py-2 sm:grid-cols-2' aria-label='Roles'>
              {TOGGLES.map((role) => {
                const info = ROLES[role];
                const off = !!info.variation && !cfg.variations;
                return (
                  <li key={role}>
                    <label
                      className={`flex items-center gap-2 rounded-lg px-1 py-1 text-sm ${off ? 'opacity-40' : ''} ${locked ? '' : 'cursor-pointer'}`}
                    >
                      <RoleBadge role={role} size='size-8' />
                      <span className='flex-1'>{info.name}</span>
                      <input
                        type='checkbox'
                        aria-label={info.name}
                        checked={cfg.roles[role]}
                        disabled={locked || off}
                        onChange={(e) => setRole(role, e.target.checked)}
                        className='size-4 accent-[#d4584f]'
                      />
                    </label>
                  </li>
                );
              })}
            </ul>
            <p className='py-2 text-xs text-[var(--mute)]'>
              Active roles:{' '}
              {TOGGLES.filter((t) => enabled(cfg, t))
                .map((t) => ROLES[t].name)
                .join(', ') || 'none'}
              . Everyone else is a plain Villager.
            </p>
          </Group>

          <Group title='Timers'>
            <Stepper
              label='Night (seconds)'
              value={cfg.nightSeconds}
              min={10}
              max={300}
              step={5}
              disabled={locked}
              onChange={(v) => set({ nightSeconds: v })}
            />
            <Stepper
              label='Discussion (seconds)'
              value={cfg.discussionSeconds}
              min={15}
              max={600}
              step={15}
              disabled={locked}
              onChange={(v) => set({ discussionSeconds: v })}
            />
            <Stepper
              label='Voting (seconds)'
              value={cfg.votingSeconds}
              min={10}
              max={300}
              step={5}
              disabled={locked}
              onChange={(v) => set({ votingSeconds: v })}
            />
          </Group>

          <Group title='Rules'>
            <Switch
              label='Anonymous voting'
              on={cfg.anonymousVoting}
              disabled={locked}
              onChange={(v) => set({ anonymousVoting: v })}
            />
            <Switch
              label='Reveal roles of eliminated players'
              on={cfg.revealRoles}
              disabled={locked}
              onChange={(v) => set({ revealRoles: v })}
            />
            <Switch
              label='Votes can be changed'
              on={cfg.voteChange}
              disabled={locked}
              onChange={(v) => set({ voteChange: v })}
            />
            <Switch
              label='Dead players can chat together'
              on={cfg.deadChat}
              disabled={locked}
              onChange={(v) => set({ deadChat: v })}
            />
            <Switch
              label='Doctor can protect themselves'
              on={cfg.doctorSelf}
              disabled={locked}
              onChange={(v) => set({ doctorSelf: v })}
            />
            <Switch
              label='Bodyguard can guard the same player twice'
              on={cfg.bodyguardRepeat}
              disabled={locked}
              onChange={(v) => set({ bodyguardRepeat: v })}
            />
            <Switch
              label='Bodyguard dies in place of the guarded'
              on={cfg.bodyguardDies}
              disabled={locked}
              onChange={(v) => set({ bodyguardDies: v })}
            />
            <Switch
              label='Hunter shoots even when poisoned'
              on={cfg.hunterOnPoison}
              disabled={locked}
              onChange={(v) => set({ hunterOnPoison: v })}
            />
            <Switch
              label='The Seer sees the Alpha as innocent'
              on={cfg.alphaHidden}
              disabled={locked}
              onChange={(v) => set({ alphaHidden: v })}
            />
            <div className='flex items-center justify-between gap-3 py-2'>
              <span className='text-sm'>If a vote is tied</span>
              <select
                aria-label='Tie rule'
                value={cfg.tieRule}
                disabled={locked}
                onChange={(e) =>
                  set({ tieRule: e.target.value as WerewolfConfig['tieRule'] })
                }
                className='rounded-lg border border-line-strong bg-surface px-2 py-1 text-sm'
              >
                <option value='none'>Nobody is eliminated</option>
                <option value='random'>Pick one at random</option>
                <option value='revote'>Vote again between them</option>
              </select>
            </div>
          </Group>

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
            className='rounded-full bg-[#d4584f] px-10 py-3 text-base font-black tracking-wider text-white shadow-[0_4px_0_#8e2f29] transition-[transform,box-shadow,opacity] hover:-translate-y-0.5 active:translate-y-1 active:shadow-none disabled:opacity-40 disabled:shadow-none'
          >
            BEGIN THE NIGHT
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
