'use client';

import * as React from 'react';

/** Small controls shared by the lobbies that have settings. */

export function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className='flex items-center justify-between gap-3 py-2'>
      <span className='text-sm'>{label}</span>
      {children}
    </div>
  );
}

export function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  zero,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  zero?: string;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  const bump = (d: number) =>
    onChange(Math.min(max, Math.max(min, value + d * step)));
  return (
    <Row label={label}>
      <span className='flex items-center gap-2'>
        <button
          type='button'
          aria-label={`Decrease ${label}`}
          disabled={disabled || value <= min}
          onClick={() => bump(-1)}
          className='flex size-7 items-center justify-center rounded-md border border-line-strong text-lg leading-none disabled:opacity-30'
        >
          −
        </button>
        <span className='min-w-12 text-center text-sm font-semibold tabular-nums'>
          {value === 0 && zero ? zero : value}
        </span>
        <button
          type='button'
          aria-label={`Increase ${label}`}
          disabled={disabled || value >= max}
          onClick={() => bump(1)}
          className='flex size-7 items-center justify-center rounded-md border border-line-strong text-lg leading-none disabled:opacity-30'
        >
          +
        </button>
      </span>
    </Row>
  );
}

export function Switch({
  label,
  on,
  disabled,
  onChange,
}: {
  label: string;
  on: boolean;
  disabled: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <Row label={label}>
      <input
        type='checkbox'
        role='switch'
        aria-label={label}
        checked={on}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className='size-4 accent-[#d9b45a]'
      />
    </Row>
  );
}
