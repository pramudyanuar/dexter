'use client';

import * as React from 'react';

import type { Throw } from '@/lib/games/dart';
import { RADII, SEQUENCE } from '@/lib/games/dart-board';

/** The picture covers this far from the centre, so there is room for numbers and the wall. */
export const VIEW = 1.34;

const rad = (deg: number) => (deg * Math.PI) / 180;
const px = (r: number, deg: number) => Math.sin(rad(deg)) * r;
const py = (r: number, deg: number) => -Math.cos(rad(deg)) * r;
const f = (n: number) => n.toFixed(4);

/** A ring segment between two radii and two angles. */
function wedge(r1: number, r2: number, a1: number, a2: number) {
  return [
    `M${f(px(r2, a1))} ${f(py(r2, a1))}`,
    `A${r2} ${r2} 0 0 1 ${f(px(r2, a2))} ${f(py(r2, a2))}`,
    `L${f(px(r1, a2))} ${f(py(r1, a2))}`,
    `A${r1} ${r1} 0 0 0 ${f(px(r1, a1))} ${f(py(r1, a1))}Z`,
  ].join(' ');
}

const BLACK = '#17181c';
const CREAM = '#e9dcb8';
const RED = '#c9302c';
const GREEN = '#1c8049';
const WIRE = '#c4c7cf';

/** The board itself: it never changes, so it is drawn once. */
const Face = React.memo(function Face() {
  const segments = SEQUENCE.map((n, i) => {
    const a1 = i * 18 - 9;
    const a2 = i * 18 + 9;
    const dark = i % 2 === 0;
    const single = dark ? BLACK : CREAM;
    const ring = dark ? RED : GREEN;
    return (
      <g key={n}>
        <path
          d={wedge(RADII.outerBull, RADII.tripleIn, a1, a2)}
          fill={single}
        />
        <path d={wedge(RADII.tripleIn, RADII.tripleOut, a1, a2)} fill={ring} />
        <path
          d={wedge(RADII.tripleOut, RADII.doubleIn, a1, a2)}
          fill={single}
        />
        <path d={wedge(RADII.doubleIn, RADII.doubleOut, a1, a2)} fill={ring} />
      </g>
    );
  });

  return (
    <g>
      {/* the wall behind, the ring of numbers, and the wooden surround */}
      <circle r={VIEW} fill='#2a1b10' />
      <circle r='1.3' fill='#3b2616' />
      <circle r='1.24' fill='#101114' />
      <circle r='1.01' fill={BLACK} />
      {segments}
      <circle r={RADII.outerBull} fill={GREEN} />
      <circle r={RADII.innerBull} fill={RED} />

      {/* the wire */}
      <g fill='none' stroke={WIRE} strokeWidth='0.0045' opacity='0.9'>
        {[
          RADII.innerBull,
          RADII.outerBull,
          RADII.tripleIn,
          RADII.tripleOut,
          RADII.doubleIn,
          RADII.doubleOut,
        ].map((r) => (
          <circle key={r} r={r} />
        ))}
        {SEQUENCE.map((n, i) => (
          <line
            key={n}
            x1={f(px(RADII.outerBull, i * 18 + 9))}
            y1={f(py(RADII.outerBull, i * 18 + 9))}
            x2={f(px(RADII.doubleOut, i * 18 + 9))}
            y2={f(py(RADII.doubleOut, i * 18 + 9))}
          />
        ))}
      </g>

      {SEQUENCE.map((n, i) => (
        <text
          key={n}
          x={f(px(1.115, i * 18))}
          y={f(py(1.115, i * 18) + 0.045)}
          textAnchor='middle'
          fontSize='0.12'
          fontWeight='800'
          fontFamily='ui-sans-serif, system-ui, sans-serif'
          fill='#f1ead7'
        >
          {n}
        </text>
      ))}
    </g>
  );
});

/** A dart standing in the board, flights up and to the right. */
function Dart({
  t,
  color,
  fresh,
}: {
  t: Throw;
  color: string;
  fresh: boolean;
}) {
  // where it came from, so it flies in from below the board
  const dx = (0.15 + t.x * 0.2).toFixed(3);
  const dy = (1.5 - t.y * 0.3).toFixed(3);
  return (
    <g transform={`translate(${f(t.x)} ${f(t.y)})`} data-dart={t.seq}>
      {fresh && (
        <circle
          r='0.02'
          fill='none'
          stroke='#fff'
          strokeWidth='0.01'
          className='a-dart-ripple'
        />
      )}
      <g
        className={fresh ? 'a-dart' : ''}
        style={{ ['--dx' as string]: `${dx}px`, ['--dy' as string]: `${dy}px` }}
      >
        {/* shaft, barrel and flights, pointing back toward the thrower */}
        <line
          x1='0'
          y1='0'
          x2='0.055'
          y2='-0.09'
          stroke='#d7d9df'
          strokeWidth='0.013'
          strokeLinecap='round'
        />
        <line
          x1='0.03'
          y1='-0.05'
          x2='0.075'
          y2='-0.125'
          stroke='#8a8f9c'
          strokeWidth='0.028'
          strokeLinecap='round'
        />
        <path
          d='M0.075 -0.125 L0.15 -0.11 L0.13 -0.19 Z'
          fill={color}
          stroke='#00000066'
          strokeWidth='0.004'
        />
        <path
          d='M0.075 -0.125 L0.03 -0.2 L0.13 -0.19 Z'
          fill={color}
          opacity='0.8'
        />
        <circle
          r='0.011'
          fill='#f7f7f7'
          stroke='#000'
          strokeOpacity='0.5'
          strokeWidth='0.004'
        />
      </g>
    </g>
  );
}

export interface BoardHandlers {
  /** The pointer moved over the board (mouse), in board units */
  onAim: (x: number, y: number, touch: boolean) => void;
  /** The board was clicked or tapped */
  onPick: (x: number, y: number, touch: boolean) => void;
}

/**
 * The dartboard: the face, the darts in it, the crosshair, and what just
 * happened (a ripple where the dart landed, a score that floats up).
 */
export default function Dartboard({
  throws,
  color,
  aim,
  active,
  onAim,
  onPick,
  skill,
  label,
}: {
  throws: Throw[];
  color: string;
  aim: { x: number; y: number } | null;
  /** Whether the board takes aim from the pointer right now */
  active: boolean;
  skill: boolean;
  label: string;
} & BoardHandlers) {
  const ref = React.useRef<SVGSVGElement>(null);

  const toBoard = (e: React.PointerEvent | React.MouseEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 2 * VIEW - VIEW,
      y: ((e.clientY - rect.top) / rect.height) * 2 * VIEW - VIEW,
    };
  };
  const newest = throws[throws.length - 1];

  return (
    <div className='relative mx-auto aspect-square w-full max-w-[min(100%,46rem)]'>
      <svg
        ref={ref}
        viewBox={`${-VIEW} ${-VIEW} ${2 * VIEW} ${2 * VIEW}`}
        role='img'
        aria-label={label}
        data-testid='dartboard'
        className={`size-full touch-none select-none ${active ? 'cursor-crosshair' : ''}`}
        onPointerMove={(e) => {
          if (!active) return;
          const p = toBoard(e);
          onAim(p.x, p.y, e.pointerType === 'touch');
        }}
        onPointerDown={(e) => {
          if (!active) return;
          const p = toBoard(e);
          // a finger aims; the throw button throws. A mouse click throws.
          if (e.pointerType === 'touch') onAim(p.x, p.y, true);
        }}
        onClick={(e) => {
          if (!active) return;
          // a touch has already aimed; a click from a mouse throws
          if ((e.nativeEvent as PointerEvent).pointerType === 'touch') return;
          const p = toBoard(e);
          onPick(p.x, p.y, false);
        }}
      >
        <defs>
          <radialGradient id='dart-shade' cx='50%' cy='40%' r='65%'>
            <stop offset='0' stopColor='#fff' stopOpacity='0.07' />
            <stop offset='1' stopColor='#000' stopOpacity='0.28' />
          </radialGradient>
        </defs>
        <Face />
        <circle r={VIEW} fill='url(#dart-shade)' pointerEvents='none' />

        {throws.map((t) => (
          <Dart key={t.seq} t={t} color={color} fresh={t.seq === newest?.seq} />
        ))}

        {active && aim && (
          <g
            pointerEvents='none'
            data-testid='crosshair'
            transform={`translate(${f(aim.x)} ${f(aim.y)})`}
          >
            <circle
              r={skill ? 0.055 : 0.04}
              fill='none'
              stroke='#fff'
              strokeWidth='0.012'
              opacity='0.95'
            />
            <circle
              r={skill ? 0.055 : 0.04}
              fill='none'
              stroke='#000'
              strokeWidth='0.004'
              opacity='0.6'
            />
            <path
              d='M-0.09 0H-0.03M0.03 0H0.09M0 -0.09V-0.03M0 0.03V0.09'
              stroke='#fff'
              strokeWidth='0.012'
              strokeLinecap='round'
            />
            <circle r='0.006' fill='#ff3b3b' />
          </g>
        )}
      </svg>

      {/* what the newest dart scored, floating up from where it landed */}
      {newest && (
        <span
          key={newest.seq}
          aria-hidden
          className={`a-dart-score pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-2.5 py-0.5 text-sm font-black whitespace-nowrap shadow-lg ${
            newest.points === 0
              ? 'bg-[#3b3f48] text-[#cfd2da]'
              : newest.ring === 'triple' || newest.ring === 'ibull'
                ? 'bg-[#e8b923] text-[#2a1f00]'
                : newest.ring === 'double'
                  ? 'bg-[#2fa860] text-white'
                  : 'bg-white text-[#17181c]'
          }`}
          style={{
            left: `${((newest.x + VIEW) / (2 * VIEW)) * 100}%`,
            top: `${((newest.y + VIEW) / (2 * VIEW)) * 100}%`,
          }}
        >
          {newest.label === 'Miss'
            ? 'Miss'
            : `${newest.label}${newest.points ? ` · ${newest.points}` : ''}`}
        </span>
      )}
    </div>
  );
}
