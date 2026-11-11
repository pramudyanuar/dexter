'use client';

import * as React from 'react';

import type { Pos } from '@/lib/games/mahjong-layouts';

const COLS = 18;
const ROWS = 9;
const LAYERS = 4;

const key = (c: number, r: number, z: number) => `${c},${r},${z}`;

/**
 * Draw a board: tap a square to put a tile there (or take it away), one layer at
 * a time. A tile needs a partner, so the count must be even.
 */
export default function CustomEditor({
  initial,
  onPlay,
  onCancel,
}: {
  initial: Pos[];
  onPlay: (positions: Pos[]) => void;
  onCancel: () => void;
}) {
  const [cells, setCells] = React.useState<Set<string>>(
    () => new Set(initial.map((p) => key(p.x / 2, p.y / 2, p.z))),
  );
  const [layer, setLayer] = React.useState(0);

  const toggle = (c: number, r: number) =>
    setCells((prev) => {
      const next = new Set(prev);
      const k = key(c, r, layer);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const count = cells.size;
  const valid = count >= 2 && count <= 144 && count % 2 === 0;
  const positions = (): Pos[] =>
    [...cells].map((k) => {
      const [c, r, z] = k.split(',').map(Number);
      return { x: c * 2, y: r * 2, z };
    });

  return (
    <div className='mx-auto w-full max-w-3xl'>
      <h1 className='text-2xl font-black tracking-widest text-[#d9b45a]'>
        Custom layout
      </h1>
      <p className='mt-1 text-sm text-[var(--mute)]'>
        Tap a square to add or remove a tile. Tiles on higher layers sit on top
        of the ones below. You need an even number of tiles, between 2 and 144.
      </p>

      <div className='mt-4 flex flex-wrap items-center gap-2'>
        {Array.from({ length: LAYERS }, (_, z) => (
          <button
            key={z}
            type='button'
            aria-pressed={layer === z}
            onClick={() => setLayer(z)}
            className={`rounded-full border px-3 py-1 text-sm ${
              layer === z ? 'border-[#d9b45a] bg-[#d9b45a]/15' : 'border-line'
            }`}
          >
            Layer {z + 1}
          </button>
        ))}
        <span
          className={`ml-auto text-sm font-semibold ${valid ? 'text-accent' : 'text-err'}`}
          data-testid='count'
          aria-live='polite'
        >
          {count} tiles{count % 2 ? ' (needs a partner)' : ''}
        </span>
      </div>

      <div
        role='group'
        aria-label='Layout grid'
        className='mt-3 grid gap-[3px] rounded-2xl bg-[#123b2b] p-3'
        style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: ROWS * COLS }, (_, i) => {
          const r = Math.floor(i / COLS);
          const c = i % COLS;
          const here = cells.has(key(c, r, layer));
          const below = layer > 0 && cells.has(key(c, r, layer - 1));
          const others = [...Array(LAYERS).keys()].some(
            (z) => z !== layer && cells.has(key(c, r, z)),
          );
          return (
            <button
              key={i}
              type='button'
              aria-label={`Row ${r + 1}, column ${c + 1}${here ? ', tile' : ''}`}
              aria-pressed={here}
              onClick={() => toggle(c, r)}
              className={`aspect-[3/4] rounded-[4px] border text-[9px] ${
                here
                  ? 'border-[#cdbf94] bg-[#efe6cc] text-[#26231f] shadow-[1px_1px_0_#1f5a40]'
                  : below
                    ? 'border-[#d9b45a]/40 bg-[#1f6b4d]'
                    : others
                      ? 'border-white/20 bg-[#1a4f39]'
                      : 'border-white/10 bg-[#164a34] hover:bg-[#1d5a42]'
              }`}
            />
          );
        })}
      </div>

      <div className='mt-4 flex flex-wrap gap-2'>
        <button
          type='button'
          onClick={() => setCells(new Set())}
          className='rounded-full border-2 border-line-strong px-4 py-2 text-sm font-semibold'
        >
          Clear
        </button>
        <button
          type='button'
          onClick={onCancel}
          className='rounded-full border-2 border-line-strong px-4 py-2 text-sm font-semibold'
        >
          Back
        </button>
        <button
          type='button'
          disabled={!valid}
          onClick={() => onPlay(positions())}
          className='ml-auto rounded-full bg-[#d9b45a] px-8 py-2 text-sm font-black text-[#2b2208] shadow-[0_3px_0_#9c7d2e] disabled:opacity-40 disabled:shadow-none'
        >
          PLAY THIS LAYOUT
        </button>
      </div>
    </div>
  );
}
