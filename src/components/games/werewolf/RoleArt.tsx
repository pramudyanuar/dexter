import * as React from 'react';

import { RoleId, ROLES, Team } from '@/lib/games/werewolf-config';

const TEAM_COLOR: Record<Team, string> = {
  village: '#e7c46a',
  wolf: '#d4584f',
  neutral: '#b58be0',
};

export const teamColor = (team: Team) => TEAM_COLOR[team];
export const teamName = (team: Team) =>
  ({ village: 'Village team', wolf: 'Werewolf team', neutral: 'Works alone' })[
    team
  ];

/** Simple emblems, drawn in one stroke style so the cards look like a set. */
function Emblem({ role }: { role: RoleId }) {
  const line = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (role) {
    case 'villager':
      return (
        <g {...line}>
          <path d='M10 30 L32 12 L54 30' />
          <path d='M16 28 V52 H48 V28' />
          <path d='M28 52 V38 H36 V52' />
        </g>
      );
    case 'seer':
      return (
        <g {...line}>
          <path d='M6 32 C16 16 48 16 58 32 C48 48 16 48 6 32Z' />
          <circle cx='32' cy='32' r='8' />
          <circle cx='32' cy='32' r='2.5' fill='currentColor' />
          <path d='M32 8 V13 M16 12 L19 16 M48 12 L45 16' />
        </g>
      );
    case 'doctor':
      return (
        <g {...line}>
          <rect x='10' y='10' width='44' height='44' rx='10' />
          <path d='M32 20 V44 M20 32 H44' strokeWidth={5} />
        </g>
      );
    case 'bodyguard':
      return (
        <g {...line}>
          <path d='M32 8 L52 16 V32 C52 44 42 52 32 57 C22 52 12 44 12 32 V16Z' />
          <path d='M32 20 V44 M22 30 H42' />
        </g>
      );
    case 'witch':
      return (
        <g {...line}>
          <path d='M26 8 H38' />
          <path d='M28 8 V22 L12 50 C10 54 13 57 17 57 H47 C51 57 54 54 52 50 L36 22 V8' />
          <path d='M20 42 H44' />
          <circle cx='30' cy='49' r='2' fill='currentColor' />
          <circle cx='38' cy='47' r='1.5' fill='currentColor' />
        </g>
      );
    case 'hunter':
      return (
        <g {...line}>
          <circle cx='32' cy='32' r='20' />
          <circle cx='32' cy='32' r='10' />
          <path d='M32 6 V16 M32 48 V58 M6 32 H16 M48 32 H58' />
        </g>
      );
    case 'werewolf':
      return (
        <g {...line}>
          <path d='M12 14 L22 26 H42 L52 14 L54 36 C54 48 44 56 32 56 C20 56 10 48 10 36Z' />
          <path d='M22 38 L27 36 M42 38 L37 36' />
          <path d='M26 46 L32 50 L38 46 M32 50 V42' />
        </g>
      );
    case 'alpha':
      return (
        <g {...line}>
          <path d='M14 20 L22 30 H42 L50 20 L52 38 C52 49 43 56 32 56 C21 56 12 49 12 38Z' />
          <path d='M16 12 L24 4 L32 12 L40 4 L48 12' />
          <path d='M24 41 L28 39 M40 41 L36 39 M27 48 L32 51 L37 48' />
        </g>
      );
    case 'jester':
      return (
        <g {...line}>
          <path d='M8 40 C8 20 18 14 22 6 C26 16 30 18 32 20 C34 18 38 16 42 6 C46 14 56 20 56 40Z' />
          <circle cx='22' cy='6' r='3' fill='currentColor' />
          <circle cx='42' cy='6' r='3' fill='currentColor' />
          <path d='M12 46 H52 M16 52 H48' />
        </g>
      );
    case 'mayor':
      return (
        <g {...line}>
          <path d='M32 8 L38 24 L55 24 L41 34 L46 52 L32 41 L18 52 L23 34 L9 24 L26 24Z' />
        </g>
      );
    case 'serialkiller':
      return (
        <g {...line}>
          <path d='M44 8 L56 20 L26 50 L14 50 L14 38Z' />
          <path d='M14 50 L8 56 M36 28 L42 34' />
        </g>
      );
    case 'mason':
      return (
        <g {...line}>
          <path d='M32 8 L56 52 H8Z' />
          <path d='M20 38 H44 M26 28 H38' />
          <circle cx='32' cy='42' r='4' />
        </g>
      );
  }
}

/** A role's emblem inside a round badge. */
export function RoleBadge({
  role,
  size = 'size-14',
}: {
  role: RoleId;
  size?: string;
}) {
  const color = TEAM_COLOR[ROLES[role].team];
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full border-2 ${size}`}
      style={{
        color,
        borderColor: `${color}99`,
        background: `radial-gradient(circle at 50% 30%, ${color}33, transparent 70%)`,
      }}
    >
      <svg viewBox='0 0 64 64' className='size-[62%]'>
        <Emblem role={role} />
      </svg>
    </span>
  );
}

/** The big card shown when you learn your role. */
export default function RoleCard({
  role,
  className = '',
}: {
  role: RoleId;
  className?: string;
}) {
  const info = ROLES[role];
  const color = TEAM_COLOR[info.team];
  return (
    <article
      data-role={role}
      className={`relative overflow-hidden rounded-3xl border-2 bg-[#14121c] p-6 text-center shadow-2xl ${className}`}
      style={{ borderColor: `${color}88` }}
    >
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 opacity-30'
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${color}66, transparent 65%)`,
        }}
      />
      <div className='relative flex flex-col items-center gap-3'>
        <RoleBadge role={role} size='size-28' />
        <p
          className='text-[11px] font-bold tracking-[0.25em] uppercase'
          style={{ color }}
        >
          {teamName(info.team)}
        </p>
        <h2 className='text-3xl font-black tracking-tight'>{info.name}</h2>
        <p className='max-w-xs text-sm text-[#cfcbd8]'>{info.blurb}</p>
      </div>
    </article>
  );
}
