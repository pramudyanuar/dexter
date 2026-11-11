'use client';

import * as React from 'react';

import {
  DEFAULT_CONFIG,
  modeDefaults,
  MODES,
  sanitizeConfig,
  SekataConfig,
  WordTag,
} from '@/lib/games/sekata-config';
import type { RoomView } from '@/lib/rooms/types';
import type { useRoom } from '@/lib/rooms/useRoom';

import { inviteLink, useCopy } from '@/components/games/RoomBar';
import { seatLabel } from '@/components/games/RoomGate';
import { MODE_INFO, seatColor } from '@/components/games/sekata/labels';

type Api = ReturnType<typeof useRoom>;

const CATEGORY_LABEL: Record<Exclude<WordTag, 'standard'>, string> = {
  proper: 'Nama orang',
  place: 'Nama tempat',
  foreign: 'Kata asing',
  abbr: 'Singkatan',
  slang: 'Bahasa gaul',
  regional: 'Bahasa daerah',
};

const outline =
  'rounded-lg border border-line-strong px-3 py-1.5 text-sm text-[var(--mute)] transition-colors hover:border-[var(--mute)] hover:text-ink disabled:opacity-40';

function Toggle({
  label,
  hint,
  on,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  on: boolean;
  disabled: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label
      className={`flex items-start justify-between gap-3 py-1.5 ${
        disabled ? 'opacity-70' : 'cursor-pointer'
      }`}
    >
      <span className='min-w-0'>
        <span className='block text-sm'>{label}</span>
        {hint && (
          <span className='block text-xs text-[var(--mute)]'>{hint}</span>
        )}
      </span>
      <input
        type='checkbox'
        role='switch'
        checked={on}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className='mt-1 size-4 shrink-0 accent-[#f08fb0]'
      />
    </label>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  zero,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  /** What to say for 0, when it means "off" */
  zero?: string;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const bump = (d: number) =>
    onChange(Math.min(max, Math.max(min, value + d * step)));
  return (
    <div className='flex items-center justify-between gap-3 py-1.5'>
      <span className='text-sm'>{label}</span>
      <span className='flex items-center gap-2'>
        <button
          type='button'
          aria-label={`Kurangi ${label}`}
          disabled={disabled || value <= min}
          onClick={() => bump(-1)}
          className='flex size-7 items-center justify-center rounded-md border border-line-strong text-lg leading-none disabled:opacity-30'
        >
          −
        </button>
        <span className='min-w-14 text-center text-sm font-semibold tabular-nums'>
          {value === 0 && zero ? zero : `${value}${unit ? ` ${unit}` : ''}`}
        </span>
        <button
          type='button'
          aria-label={`Tambah ${label}`}
          disabled={disabled || value >= max}
          onClick={() => bump(1)}
          className='flex size-7 items-center justify-center rounded-md border border-line-strong text-lg leading-none disabled:opacity-30'
        >
          +
        </button>
      </span>
    </div>
  );
}

function Group({
  title,
  children,
  open,
}: {
  title: string;
  children: React.ReactNode;
  open?: boolean;
}) {
  return (
    <details
      open={open}
      className='group rounded-xl border border-line bg-surface/40'
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
 * The waiting room for Sekata: who is here, the code to share, the mode and the
 * rules. The admin changes them; everyone else watches them change.
 */
export default function SekataLobby({ r }: { r: Api }) {
  const { copied, copy } = useCopy();
  if (!r.session || !r.room) return null;
  const { code, you } = r.session;
  const room = r.room as RoomView;
  const cfg = sanitizeConfig(room.options ?? DEFAULT_CONFIG);
  const isHost = room.host === you;
  const seats = room.joined.flatMap((taken, seat) => (taken ? [seat] : []));
  const enough = seats.length >= room.minPlayers;
  const locked = !isHost || r.busy;

  const set = (patch: Partial<SekataConfig>) =>
    void r.setOptions({ ...cfg, ...patch });
  const setMode = (mode: SekataConfig['mode']) =>
    void r.setOptions({ ...cfg, mode, ...modeDefaults(mode) });

  return (
    <div className='mx-auto w-full max-w-3xl'>
      <header className='mb-6 text-center'>
        <h1 className='text-5xl font-black tracking-[0.18em] text-[#f08fb0]'>
          SEKATA
        </h1>
        <p className='mx-auto mt-2 max-w-md text-sm text-[var(--mute)]'>
          Susun kartu suku kata jadi kata bahasa Indonesia yang bermakna,
          secepat mungkin. Yang pertama menghabiskan kartunya menang.
        </p>
      </header>

      <div className='grid gap-5 md:grid-cols-[1fr_1.4fr]'>
        <div className='space-y-5'>
          <section className='rounded-2xl border border-line bg-surface/50 p-5 text-center'>
            <p className='text-xs text-[var(--mute)]'>Kode room</p>
            <button
              type='button'
              onClick={() => copy('code', code)}
              aria-label={`Salin kode room ${code}`}
              className='mt-1 font-mono text-4xl font-medium tracking-[0.3em] transition-opacity hover:opacity-80'
            >
              {code}
            </button>
            <p
              className='mt-1 h-4 text-xs text-[var(--mute)]'
              aria-live='polite'
            >
              {copied === 'code' ? 'Kode tersalin' : 'Ketuk untuk menyalin'}
            </p>
            <button
              type='button'
              onClick={() => copy('link', inviteLink(code))}
              className={`${outline} mt-2`}
            >
              {copied === 'link' ? 'Link tersalin' : 'Salin link undangan'}
            </button>
          </section>

          <section>
            <div className='mb-2 flex items-baseline justify-between'>
              <h2 className='text-sm font-semibold'>Pemain</h2>
              <span className='text-xs text-[var(--mute)]' aria-live='polite'>
                {seats.length} dari {room.capacity} · minimal {room.minPlayers}
              </span>
            </div>
            <ul className='space-y-2'>
              {seats.map((seat) => {
                const label = seatLabel(seat, you, room.names);
                return (
                  <li
                    key={seat}
                    className='a-pop flex items-center gap-3 rounded-xl border border-line bg-surface/50 px-3 py-2'
                  >
                    <span
                      aria-hidden
                      className='flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-[#2b2430] uppercase'
                      style={{ background: seatColor(seat) }}
                    >
                      {(room.names[seat] || 'P').charAt(0)}
                    </span>
                    <span className='min-w-0 flex-1 truncate text-sm'>
                      {label}
                      {room.host === seat && (
                        <span className='ml-2 rounded-full bg-[#f08fb0]/20 px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#f08fb0] uppercase'>
                          Host
                        </span>
                      )}
                    </span>
                    <span className='flex items-center gap-1.5 text-xs text-[#7cc576]'>
                      <span className='size-2 rounded-full bg-[#7cc576]' />
                      Siap
                    </span>
                    {isHost && seat !== you && (
                      <button
                        type='button'
                        onClick={() => r.kick(seat)}
                        disabled={r.busy}
                        aria-label={`Keluarkan ${label}`}
                        className='text-xs text-[var(--mute)] hover:text-err'
                      >
                        keluarkan
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            {!enough && (
              <p className='mt-3 text-center text-xs text-[var(--mute)]'>
                Menunggu pemain lain: butuh {room.minPlayers - seats.length}{' '}
                lagi.
              </p>
            )}
          </section>
        </div>

        <div className='space-y-3'>
          <section className='rounded-2xl border border-line bg-surface/50 p-4'>
            <h2 className='mb-2 text-sm font-semibold'>Mode</h2>
            <div className='grid grid-cols-2 gap-2'>
              {MODES.map((m) => (
                <button
                  key={m}
                  type='button'
                  disabled={locked}
                  onClick={() => setMode(m)}
                  aria-pressed={cfg.mode === m}
                  className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors disabled:opacity-60 ${
                    cfg.mode === m
                      ? 'border-[#f08fb0] bg-[#f08fb0]/15'
                      : 'border-line hover:border-line-strong'
                  }`}
                >
                  <span className='block font-semibold'>
                    {MODE_INFO[m].title}
                  </span>
                </button>
              ))}
            </div>
            <p className='mt-3 text-sm text-[var(--mute)]' aria-live='polite'>
              {MODE_INFO[cfg.mode].blurb}
            </p>
          </section>

          <Group title='Kartu' open>
            <Stepper
              label='Kartu awal per pemain'
              value={cfg.handSize}
              min={4}
              max={15}
              disabled={locked}
              onChange={(v) => set({ handSize: v })}
            />
            <Stepper
              label='Kartu kuning di tengah'
              value={cfg.sharedYellow}
              min={0}
              max={6}
              disabled={locked}
              onChange={(v) => set({ sharedYellow: v })}
            />
            <Stepper
              label='Kartu hijau per pemain'
              value={cfg.greenPerPlayer}
              min={0}
              max={3}
              zero='tidak ada'
              disabled={locked}
              onChange={(v) => set({ greenPerPlayer: v })}
            />
            <Toggle
              label='Kartu kuning habis dipakai'
              hint='Kalau mati, kartu kuning tetap di tengah dan bisa dipakai lagi.'
              on={cfg.yellowConsumed}
              disabled={locked}
              onChange={(v) => set({ yellowConsumed: v })}
            />
            <Toggle
              label='Kartu hijau habis dipakai'
              on={cfg.greenConsumed}
              disabled={locked}
              onChange={(v) => set({ greenConsumed: v })}
            />
            <Toggle
              label='Tambahkan 3 kartu kosong (joker)'
              on={cfg.blankCards === 3}
              disabled={locked}
              onChange={(v) => set({ blankCards: v ? 3 : 0 })}
            />
            <Toggle
              label='Boleh tukar kartu'
              hint={`Maksimal ${cfg.replaceLimit}x per pemain.`}
              on={cfg.replacement}
              disabled={locked}
              onChange={(v) => set({ replacement: v })}
            />
          </Group>

          <Group title='Aturan kata'>
            <Stepper
              label='Hukuman kata salah'
              value={cfg.penalty}
              min={0}
              max={3}
              unit='kartu'
              zero='tanpa'
              disabled={locked}
              onChange={(v) => set({ penalty: v })}
            />
            <Stepper
              label='Minimal kartu per kata'
              value={cfg.minWordCards}
              min={1}
              max={4}
              disabled={locked}
              onChange={(v) => set({ minWordCards: v })}
            />
            <Toggle
              label='Kata boleh diulang'
              on={cfg.allowRepeats}
              disabled={locked || cfg.mode === 'norepeat'}
              onChange={(v) => set({ allowRepeats: v })}
            />
            <Toggle
              label='Kata di luar kamus langsung ditolak'
              hint='Kalau mati, moderator (host) yang memutuskan.'
              on={cfg.unknownWords === 'reject'}
              disabled={locked}
              onChange={(v) => set({ unknownWords: v ? 'reject' : 'review' })}
            />
            <Toggle
              label='Pemain bisa menantang kata'
              on={cfg.challenges}
              disabled={locked}
              onChange={(v) => set({ challenges: v })}
            />
            <Toggle
              label='Wajib menjelaskan arti kata'
              on={cfg.needMeaning}
              disabled={locked || cfg.mode === 'vocabulary'}
              onChange={(v) => set({ needMeaning: v })}
            />
            <Toggle
              label='Jeda setelah menyusun kata'
              hint='Tunggu pemain lain menyusun kata dulu sebelum menyusun lagi.'
              on={cfg.cooldown}
              disabled={locked}
              onChange={(v) => set({ cooldown: v })}
            />
            {(
              Object.keys(CATEGORY_LABEL) as (keyof typeof CATEGORY_LABEL)[]
            ).map((k) => (
              <Toggle
                key={k}
                label={`Boleh: ${CATEGORY_LABEL[k].toLowerCase()}`}
                on={cfg.categories[k]}
                disabled={locked}
                onChange={(v) =>
                  set({ categories: { ...cfg.categories, [k]: v } })
                }
              />
            ))}
          </Group>

          <Group title='Waktu dan skor'>
            <Stepper
              label='Batas waktu'
              value={cfg.timeLimit}
              min={0}
              max={900}
              step={30}
              unit='dtk'
              zero='tanpa batas'
              disabled={locked || cfg.mode === 'speed'}
              onChange={(v) => set({ timeLimit: v })}
            />
            <Stepper
              label='Poin per kartu'
              value={cfg.scoring.perCard}
              min={0}
              max={100}
              step={5}
              disabled={locked}
              onChange={(v) => set({ scoring: { ...cfg.scoring, perCard: v } })}
            />
            <Stepper
              label='Poin tambahan per huruf (>3)'
              value={cfg.scoring.perLetter}
              min={0}
              max={50}
              disabled={locked}
              onChange={(v) =>
                set({ scoring: { ...cfg.scoring, perLetter: v } })
              }
            />
            <Stepper
              label='Bonus selesai duluan'
              value={cfg.scoring.finishBonus}
              min={0}
              max={500}
              step={10}
              disabled={locked}
              onChange={(v) =>
                set({ scoring: { ...cfg.scoring, finishBonus: v } })
              }
            />
            <Stepper
              label='Potongan poin kata salah'
              value={cfg.scoring.invalidPenalty}
              min={0}
              max={100}
              step={5}
              disabled={locked}
              onChange={(v) =>
                set({ scoring: { ...cfg.scoring, invalidPenalty: v } })
              }
            />
          </Group>

          {!isHost && (
            <p className='text-center text-xs text-[var(--mute)]'>
              Hanya host yang bisa mengubah pengaturan.
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
            className='rounded-full bg-[#f08fb0] px-10 py-3 text-base font-black tracking-wider text-[#2b1420] shadow-[0_4px_0_#b85b7d] transition-[transform,box-shadow,opacity] hover:-translate-y-0.5 active:translate-y-1 active:shadow-none disabled:opacity-40 disabled:shadow-none'
          >
            MULAI MAIN
          </button>
        ) : (
          <p className='text-sm text-[var(--mute)]' aria-live='polite'>
            Menunggu host memulai permainan…
          </p>
        )}
        <button
          type='button'
          onClick={r.leave}
          className={`${outline} hover:border-err hover:text-err`}
        >
          Keluar
        </button>
      </div>
    </div>
  );
}
