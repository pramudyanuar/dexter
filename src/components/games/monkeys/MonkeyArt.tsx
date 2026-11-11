import * as React from 'react';

import type { Role } from '@/lib/games/monkeys-config';

export type Mood = 'calm' | 'worried' | 'cheer' | 'boom';

export const ROLE_COLOR: Record<Role, string> = {
  blind: '#8a93a6',
  mute: '#e0b84c',
  deaf: '#5fb3a1',
};

/**
 * The three monkeys, drawn the same way: a round head, a pale face, and one
 * thing each that gives them away: a blindfold, taped mouth, or ear defenders.
 */
export default function MonkeyArt({
  role,
  mood = 'calm',
  className = 'size-24',
  title,
}: {
  role: Role;
  mood?: Mood;
  className?: string;
  title?: string;
}) {
  const fur = '#8a5a34';
  const furDark = '#6b4326';
  const face = '#f0cfa0';
  const eye = mood === 'boom' ? 'x' : 'o';
  return (
    <svg
      viewBox='0 0 100 100'
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {/* ears */}
      <circle cx='14' cy='52' r='12' fill={fur} />
      <circle cx='14' cy='52' r='7' fill={face} />
      <circle cx='86' cy='52' r='12' fill={fur} />
      <circle cx='86' cy='52' r='7' fill={face} />
      {/* head */}
      <circle cx='50' cy='50' r='38' fill={mood === 'boom' ? furDark : fur} />
      {/* face: two lobes joined, like a monkey's */}
      <path
        d='M50 30c-9-8-26-3-26 12 0 6 3 10 7 12 2 9 9 16 19 16s17-7 19-16c4-2 7-6 7-12 0-15-17-20-26-12z'
        fill={face}
      />
      {/* brows */}
      {mood === 'worried' && (
        <>
          <path
            d='M31 36l12 4'
            stroke={furDark}
            strokeWidth='3'
            strokeLinecap='round'
          />
          <path
            d='M69 36l-12 4'
            stroke={furDark}
            strokeWidth='3'
            strokeLinecap='round'
          />
        </>
      )}
      {/* eyes */}
      {eye === 'o' ? (
        <>
          <circle
            cx='38'
            cy='46'
            r={mood === 'worried' ? 5.5 : 4.5}
            fill='#fff'
          />
          <circle
            cx='62'
            cy='46'
            r={mood === 'worried' ? 5.5 : 4.5}
            fill='#fff'
          />
          <circle cx='38.8' cy='46.5' r='2.4' fill='#1b1208' />
          <circle cx='61.2' cy='46.5' r='2.4' fill='#1b1208' />
        </>
      ) : (
        <>
          <path
            d='M33 41l10 10M43 41L33 51M57 41l10 10M67 41L57 51'
            stroke='#1b1208'
            strokeWidth='3'
            strokeLinecap='round'
          />
        </>
      )}
      {/* nose */}
      <ellipse cx='46' cy='58' rx='1.6' ry='1.2' fill={furDark} />
      <ellipse cx='54' cy='58' rx='1.6' ry='1.2' fill={furDark} />
      {/* mouth */}
      {mood === 'cheer' ? (
        <path
          d='M40 65q10 11 20 0z'
          fill='#7a2b2b'
          stroke='#7a2b2b'
          strokeWidth='1.5'
          strokeLinejoin='round'
        />
      ) : mood === 'worried' || mood === 'boom' ? (
        <path
          d='M42 70q8-6 16 0'
          fill='none'
          stroke={furDark}
          strokeWidth='2.5'
          strokeLinecap='round'
        />
      ) : (
        <path
          d='M42 66q8 5 16 0'
          fill='none'
          stroke={furDark}
          strokeWidth='2.5'
          strokeLinecap='round'
        />
      )}

      {role === 'blind' && (
        <g>
          <rect
            x='20'
            y='38'
            width='60'
            height='15'
            rx='5'
            fill='#2a2f3a'
            stroke='#8a93a6'
            strokeWidth='1.5'
          />
          <path
            d='M20 44l-9 7M80 44l9 7'
            stroke='#2a2f3a'
            strokeWidth='4'
            strokeLinecap='round'
          />
          <path
            d='M30 45.5h10M60 45.5h10'
            stroke='#8a93a6'
            strokeWidth='1.5'
            strokeLinecap='round'
            opacity='0.6'
          />
        </g>
      )}
      {role === 'mute' && (
        <g>
          <rect
            x='34'
            y='60'
            width='32'
            height='12'
            rx='2'
            fill='#c9d1d9'
            stroke='#6e7681'
            strokeWidth='1.2'
            transform='rotate(-4 50 66)'
          />
          <path
            d='M41 63l18 6M59 63l-18 6'
            stroke='#6e7681'
            strokeWidth='2'
            strokeLinecap='round'
            transform='rotate(-4 50 66)'
          />
        </g>
      )}
      {role === 'deaf' && (
        <g>
          <path
            d='M16 50c0-26 14-38 34-38s34 12 34 38'
            fill='none'
            stroke='#3b4650'
            strokeWidth='4'
            strokeLinecap='round'
          />
          <rect
            x='5'
            y='42'
            width='15'
            height='24'
            rx='7'
            fill='#e5484d'
            stroke='#3b4650'
            strokeWidth='2'
          />
          <rect
            x='80'
            y='42'
            width='15'
            height='24'
            rx='7'
            fill='#e5484d'
            stroke='#3b4650'
            strokeWidth='2'
          />
          <path
            d='M12.5 49v10M7.5 54h10'
            stroke='#fff'
            strokeWidth='2.4'
            strokeLinecap='round'
          />
          <path
            d='M87.5 49v10M82.5 54h10'
            stroke='#fff'
            strokeWidth='2.4'
            strokeLinecap='round'
          />
        </g>
      )}
      {mood === 'boom' && (
        <g fill='#1b1208' opacity='0.55'>
          <circle cx='30' cy='30' r='3' />
          <circle cx='72' cy='28' r='2.5' />
          <circle cx='56' cy='24' r='2' />
        </g>
      )}
    </svg>
  );
}
