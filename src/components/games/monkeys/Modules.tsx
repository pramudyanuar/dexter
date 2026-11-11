'use client';

import * as React from 'react';

import type { BlindMod, DeafMod, Dir } from '@/lib/games/monkeys';
import { DIRS } from '@/lib/games/monkeys';
import { MODULE_INFO, ModuleKind } from '@/lib/games/monkeys-config';

/** What the Blind Monkey can do to a module */
export type Act = (
  m: number,
  a: string,
  extra?: { i?: number; d?: number; dir?: string },
) => void;

/** The colours the Deaf Monkey sees; the Blind Monkey gets none of them. */
export const PAINT: Record<string, string> = {
  red: '#e5484d',
  blue: '#3e8bff',
  yellow: '#f5c518',
  green: '#30a46c',
  white: '#e9e9ec',
  purple: '#ab4aba',
};
const GREY = ['#6c717c', '#858a95', '#5a5f69', '#979ca6', '#70757f', '#80858f'];

/** A slow counter for things that blink in a pattern */
function useBeat(ms: number) {
  const [beat, setBeat] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setBeat((b) => b + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
  return beat;
}

const ARROW: Record<Dir, number> = { up: 0, right: 90, down: 180, left: 270 };

function Lamp({ lit }: { lit: boolean | null }) {
  if (lit === null) return null;
  return (
    <span
      role='img'
      aria-label={lit ? 'Lamp is lit' : 'Lamp is dark'}
      title={lit ? 'Lamp: lit' : 'Lamp: dark'}
      className={`inline-block size-3.5 rounded-full border ${
        lit
          ? 'a-spark border-[#f5c518] bg-[#f5c518] shadow-[0_0_10px_2px_#f5c518aa]'
          : 'border-line-strong bg-[#23262b]'
      }`}
    />
  );
}

const key =
  'select-none rounded-xl border border-line-strong transition-[transform,background-color,border-color] active:scale-95 disabled:opacity-50';

// ---------------------------------------------------------------- wires

function Wires({
  blind,
  count,
  colors,
  cut,
  onCut,
  disabled,
}: {
  blind: boolean;
  count: number;
  colors?: string[];
  cut: boolean[];
  onCut: (i: number) => void;
  disabled: boolean;
}) {
  return (
    <ul className='space-y-1.5' aria-label={`${count} wires`}>
      {Array.from({ length: count }, (_, i) => {
        const paint = blind ? GREY[i % GREY.length] : PAINT[colors?.[i] ?? ''];
        return (
          <li key={i}>
            <button
              type='button'
              disabled={disabled || cut[i]}
              onClick={() => onCut(i)}
              aria-label={
                blind
                  ? `Wire ${i + 1}${cut[i] ? ' (cut)' : ''}`
                  : `${colors?.[i]} wire, number ${i + 1}${cut[i] ? ' (cut)' : ''}`
              }
              className='group relative flex h-8 w-full items-center'
            >
              <span className='size-2.5 shrink-0 rounded-full bg-[#9aa0aa]' />
              {cut[i] ? (
                <>
                  <span
                    className='h-1.5 flex-1 rounded-full'
                    style={{ background: paint, maxWidth: '38%' }}
                  />
                  <span className='flex-1' />
                  <span
                    className='h-1.5 rounded-full'
                    style={{ background: paint, width: '30%' }}
                  />
                </>
              ) : (
                <span
                  className='h-1.5 flex-1 rounded-full transition-[height] group-hover:h-2 group-enabled:cursor-pointer'
                  style={{ background: paint }}
                />
              )}
              <span className='size-2.5 shrink-0 rounded-full bg-[#9aa0aa]' />
              {!blind && (
                <span className='absolute -top-0.5 right-6 text-[10px] text-[var(--mute)] uppercase'>
                  {i + 1} · {colors?.[i]}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------- keypad

function Keypad({
  labels,
  onPress,
  disabled,
  progress,
}: {
  labels?: number[];
  onPress: (i: number) => void;
  disabled: boolean;
  progress?: { step: number; steps: number };
}) {
  return (
    <div>
      <div className='grid grid-cols-3 gap-2'>
        {[0, 1, 2].map((i) => (
          <button
            key={i}
            type='button'
            disabled={disabled}
            onClick={() => onPress(i)}
            aria-label={
              labels ? `Button showing ${labels[i]}` : `Button ${i + 1}`
            }
            className={`${key} h-16 text-3xl font-black ${
              labels
                ? 'bg-[#2b2118] text-[#f5c518] hover:border-[#f5c518]'
                : 'bg-[#2a2d33] hover:border-[#9aa0aa]'
            }`}
          >
            {labels ? labels[i] : ''}
          </button>
        ))}
      </div>
      {progress && (
        <div
          className='mt-2 flex justify-center gap-1'
          aria-label={`${progress.step} of ${progress.steps} entered`}
        >
          {Array.from({ length: progress.steps }, (_, i) => (
            <span
              key={i}
              className={`size-2 rounded-full ${i < progress.step ? 'bg-accent' : 'bg-line-strong'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- knobs

function Knobs({
  blind,
  dirs,
  onTurn,
  onLock,
  disabled,
}: {
  blind: boolean;
  dirs: Dir[];
  onTurn: (i: number, dir: Dir) => void;
  onLock: () => void;
  disabled: boolean;
}) {
  return (
    <div>
      <div className='flex justify-around gap-2'>
        {dirs.map((d, i) => (
          <button
            key={i}
            type='button'
            disabled={disabled}
            onClick={() => onTurn(i, DIRS[(DIRS.indexOf(d) + 1) % DIRS.length])}
            aria-label={`Knob ${i + 1}, facing ${d}. Press to turn it`}
            className={`${key} relative size-14 rounded-full ${
              blind ? 'bg-[#2a2d33]' : 'bg-[#1d2a2a] hover:border-[#5fb3a1]'
            }`}
          >
            <span
              className='absolute inset-0 transition-transform duration-300'
              style={{ transform: `rotate(${ARROW[d]}deg)` }}
            >
              <span
                className='absolute top-1 left-1/2 h-5 w-1.5 -translate-x-1/2 rounded-full'
                style={{ background: blind ? '#aab0ba' : '#5fb3a1' }}
              />
            </span>
            {!blind && (
              <span className='absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-[var(--mute)]'>
                {i + 1}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className='mt-6 flex justify-center'>
        <button
          type='button'
          disabled={disabled}
          onClick={onLock}
          className={`${key} px-5 py-1.5 text-sm font-semibold ${blind ? 'bg-[#2a2d33]' : 'bg-accent/15 text-accent'}`}
        >
          {blind ? '▣' : 'Lock in'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- sums

function Sum({
  blind,
  deaf,
  entry,
  onDigit,
  onClear,
  onEnter,
  disabled,
}: {
  blind: boolean;
  deaf?: { a: number; b: number; op: string };
  entry: string;
  onDigit: (d: number) => void;
  onClear: () => void;
  onEnter: () => void;
  disabled: boolean;
}) {
  return (
    <div>
      <div className='mb-2 flex items-center justify-between rounded-lg bg-[#14110d] px-3 py-2 font-mono text-xl'>
        {deaf ? (
          <span className='text-[#f5c518]'>
            {deaf.a} {deaf.op} {deaf.b} = ?
          </span>
        ) : (
          <span
            aria-label='A sum you cannot read'
            className='tracking-widest text-[#707682] blur-[2px]'
          >
            ▒▒ ▒ ▒▒ = ?
          </span>
        )}
        <span
          aria-label={`Entered ${entry || 'nothing'}`}
          className={blind ? 'text-[#c4c9d2]' : 'text-ink'}
        >
          {entry || '·'}
        </span>
      </div>
      <div className='grid grid-cols-5 gap-1.5'>
        {Array.from({ length: 10 }, (_, d) => (
          <button
            key={d}
            type='button'
            disabled={disabled}
            onClick={() => onDigit(d)}
            className={`${key} h-9 font-mono text-base ${blind ? 'bg-[#2a2d33]' : 'bg-surface'}`}
          >
            {d}
          </button>
        ))}
      </div>
      <div className='mt-1.5 flex gap-1.5'>
        <button
          type='button'
          disabled={disabled}
          onClick={onClear}
          className={`${key} h-9 flex-1 text-xs text-[var(--mute)]`}
        >
          Clear
        </button>
        <button
          type='button'
          disabled={disabled || !entry}
          onClick={onEnter}
          className={`${key} h-9 flex-[2] text-sm font-semibold ${blind ? 'bg-[#2a2d33]' : 'bg-accent/15 text-accent'}`}
        >
          Enter
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- flashes

const PAD_AT: { x: number; y: number }[] = [
  { x: 1, y: 0 }, // up
  { x: 2, y: 1 }, // right
  { x: 1, y: 2 }, // down
  { x: 0, y: 1 }, // left
];

function Flashes({
  colors,
  seq,
  onPad,
  disabled,
  progress,
}: {
  colors?: string[];
  seq: number[];
  onPad: (i: number) => void;
  disabled: boolean;
  progress?: number;
}) {
  const beat = useBeat(520);
  // the pattern, then a pause of two beats
  const at = beat % (seq.length * 2 + 3);
  const lit = at < seq.length * 2 && at % 2 === 0 ? seq[at / 2] : -1;
  return (
    <div>
      <div className='mx-auto grid w-44 grid-cols-3 grid-rows-3 gap-1.5'>
        {PAD_AT.map((p, i) => {
          const on = lit === i;
          const paint = colors ? PAINT[colors[i]] : '#aab0ba';
          return (
            <button
              key={i}
              type='button'
              disabled={disabled}
              onClick={() => onPad(i)}
              aria-label={`${['Top', 'Right', 'Bottom', 'Left'][i]} pad${colors ? `, ${colors[i]}` : ''}${on ? ', flashing' : ''}`}
              className={`${key} h-12 transition-[filter,opacity,box-shadow]`}
              style={{
                gridColumn: p.x + 1,
                gridRow: p.y + 1,
                background: paint,
                opacity: on ? 1 : 0.28,
                boxShadow: on ? `0 0 22px 4px ${paint}` : undefined,
              }}
            />
          );
        })}
      </div>
      {progress !== undefined && (
        <div
          className='mt-2 flex justify-center gap-1'
          aria-label={`${progress} of ${seq.length} pressed`}
        >
          {seq.map((_, i) => (
            <span
              key={i}
              className={`size-2 rounded-full ${i < progress ? 'bg-accent' : 'bg-line-strong'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- the lot

export function BombModules({
  mods,
  look,
  act,
  disabled,
}: {
  mods: (BlindMod | DeafMod)[];
  look: 'blind' | 'deaf';
  /** Only the Blind Monkey acts; the Deaf Monkey just looks */
  act?: Act;
  disabled?: boolean;
}) {
  const blind = look === 'blind';
  const off = (m: { solved: boolean }) => !act || !!disabled || m.solved;
  const noop: Act = () => {};
  const go = act ?? noop;

  return (
    <ul className='grid gap-3 sm:grid-cols-2'>
      {mods.map((m, n) => {
        const info = MODULE_INFO[m.kind as ModuleKind];
        return (
          <li
            key={m.id}
            className={`relative rounded-2xl border p-3 transition-colors ${
              m.solved
                ? 'border-accent/50 bg-accent/5'
                : blind
                  ? 'border-[#444a55] bg-[#1c1f25]'
                  : 'border-line-strong bg-[#18130e]'
            } ${m.kind === 'wires' || m.kind === 'math' ? 'sm:col-span-1' : ''}`}
          >
            <div className='mb-2 flex items-center justify-between text-xs'>
              <span className='font-semibold tracking-wide text-[var(--mute)] uppercase'>
                {blind ? `Module ${n + 1}` : `Module ${n + 1} · ${info.title}`}
              </span>
              <span className='flex items-center gap-2'>
                {!blind && 'lamp' in m && <Lamp lit={m.lamp} />}
                {m.solved && <span className='font-bold text-accent'>✓</span>}
              </span>
            </div>
            <div className={m.solved ? 'pointer-events-none opacity-40' : ''}>
              {m.kind === 'wires' && (
                <Wires
                  blind={blind}
                  count={'count' in m ? m.count : m.colors.length}
                  colors={'colors' in m ? m.colors : undefined}
                  cut={m.cut}
                  disabled={off(m)}
                  onCut={(i) => go(m.id, 'cut', { i })}
                />
              )}
              {m.kind === 'keypad' && (
                <Keypad
                  labels={'labels' in m ? m.labels : undefined}
                  progress={
                    'steps' in m ? { step: m.step, steps: m.steps } : undefined
                  }
                  disabled={off(m)}
                  onPress={(i) => go(m.id, 'press', { i })}
                />
              )}
              {m.kind === 'knobs' && (
                <Knobs
                  blind={blind}
                  dirs={m.dirs}
                  disabled={off(m)}
                  onTurn={(i, dir) => go(m.id, 'turn', { i, dir })}
                  onLock={() => go(m.id, 'lock')}
                />
              )}
              {m.kind === 'math' && (
                <Sum
                  blind={blind}
                  deaf={'a' in m ? { a: m.a, b: m.b, op: m.op } : undefined}
                  entry={m.entry}
                  disabled={off(m)}
                  onDigit={(d) => go(m.id, 'digit', { d })}
                  onClear={() => go(m.id, 'clear')}
                  onEnter={() => go(m.id, 'enter')}
                />
              )}
              {m.kind === 'flash' && (
                <Flashes
                  colors={'colors' in m ? m.colors : undefined}
                  seq={m.seq}
                  progress={'step' in m ? m.step : undefined}
                  disabled={off(m)}
                  onPad={(i) => go(m.id, 'pad', { i })}
                />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
