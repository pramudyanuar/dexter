'use client';

import * as React from 'react';

import { RoomView } from '@/lib/rooms/types';

import { seatName, useLang, useText } from '@/components/games/lang';
import { useCopy } from '@/components/games/RoomBar';

/** Re-renders once a second, so countdowns tick. */
function useTick(active: boolean) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

const outline =
  'rounded-md border border-line-strong px-2.5 py-1 text-xs text-[var(--mute)] transition-colors hover:border-[var(--mute)] hover:text-ink disabled:opacity-40';

/**
 * The admin's way to remove a player in the middle of a game: a gear in the top
 * bar that opens a small menu. Asks twice, in place, since it cannot be undone.
 */
function AdminMenu({
  room,
  you,
  busy,
  onKick,
  code,
  onLeave,
}: {
  room: RoomView;
  you: number;
  busy?: boolean;
  onKick: (seat: number) => void;
  /** The room code to copy, and the way out, kept here with the admin's tools */
  code?: string;
  onLeave?: () => void;
}) {
  const { copied, copy } = useCopy();
  const t = useText();
  const lang = useLang();
  const [open, setOpen] = React.useState(false);
  const [confirming, setConfirming] = React.useState<number | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const seats = room.joined.flatMap((taken, seat) =>
    taken && seat !== you && !room.out[seat] ? [seat] : [],
  );
  if (!seats.length && !code && !onLeave) return null;

  return (
    <div ref={ref} className='fixed top-3 left-14 z-40'>
      <button
        type='button'
        onClick={() => setOpen((o) => !o)}
        aria-label={t.manage}
        aria-expanded={open}
        title={t.manage}
        className={`flex size-8 items-center justify-center rounded-md border transition-colors ${
          open
            ? 'border-[var(--mute)] text-ink'
            : 'border-transparent text-[var(--mute)] hover:text-ink'
        }`}
      >
        <svg
          viewBox='0 0 24 24'
          className='size-[18px]'
          fill='none'
          stroke='currentColor'
          strokeWidth='1.8'
          strokeLinecap='round'
          strokeLinejoin='round'
          aria-hidden
        >
          <circle cx='12' cy='12' r='3' />
          <path d='M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z' />
        </svg>
      </button>
      {open && (
        <div className='a-pop absolute top-full left-0 z-50 mt-2 w-72 origin-top-left rounded-lg border border-line-strong bg-card text-sm shadow-2xl'>
          <p className='border-b border-line px-3 py-2 text-xs text-[var(--mute)]'>
            {t.youAdmin}
          </p>
          {(code || onLeave) && (
            <div className='flex items-center justify-between gap-3 border-b border-line px-3 py-2'>
              {code && (
                <button
                  type='button'
                  onClick={() => copy('code', code)}
                  aria-label={`${t.copyCode} ${code}`}
                  className='group flex items-center gap-2'
                >
                  <span className='text-xs text-[var(--mute)]'>Room</span>
                  <span className='font-mono font-medium tracking-[0.2em]'>
                    {code}
                  </span>
                  <span className='text-xs text-[var(--mute)]'>
                    {copied === 'code' ? t.copied : t.copy}
                  </span>
                </button>
              )}
              {onLeave && (
                <button
                  type='button'
                  onClick={onLeave}
                  className={`${outline} hover:border-err hover:text-err`}
                >
                  {t.leave}
                </button>
              )}
            </div>
          )}
          <ul className='space-y-1.5 p-2'>
            {seats.map((seat) => (
              <li
                key={seat}
                className='flex items-center justify-between gap-3 px-1 py-0.5'
              >
                <span className='min-w-0 truncate'>
                  {seatName(lang, seat, you, room.names)}
                </span>
                {confirming === seat ? (
                  <span className='flex shrink-0 items-center gap-2'>
                    <span className='text-xs text-[var(--mute)]'>{t.sure}</span>
                    <button
                      type='button'
                      disabled={busy}
                      onClick={() => {
                        setConfirming(null);
                        onKick(seat);
                      }}
                      className='rounded-md bg-err px-2.5 py-1 text-xs font-medium text-paper disabled:opacity-40'
                    >
                      {t.remove}
                    </button>
                    <button
                      type='button'
                      onClick={() => setConfirming(null)}
                      className={outline}
                    >
                      {t.cancel}
                    </button>
                  </span>
                ) : (
                  <button
                    type='button'
                    onClick={() => setConfirming(seat)}
                    className={`${outline} hover:border-err hover:text-err`}
                  >
                    {t.remove}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** A pop-up message: dismissable, and gone by itself after `autoClose` ms. */
function Toast({
  tone,
  autoClose,
  children,
}: {
  tone: 'err' | 'warn' | 'mute';
  autoClose?: number;
  children: React.ReactNode;
}) {
  const t = useText();
  const [gone, setGone] = React.useState(false);
  React.useEffect(() => {
    if (!autoClose) return;
    const timer = setTimeout(() => setGone(true), autoClose);
    return () => clearTimeout(timer);
  }, [autoClose]);
  if (gone) return null;
  return (
    <div
      role={tone === 'err' ? 'alert' : 'status'}
      className={`a-pop pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur ${
        tone === 'err'
          ? 'border-err/60 bg-card text-err'
          : tone === 'warn'
            ? 'border-hash/60 bg-card text-hash'
            : 'border-line-strong bg-card text-ink'
      }`}
    >
      <p className='flex-1'>{children}</p>
      {autoClose ? (
        <button
          type='button'
          onClick={() => setGone(true)}
          aria-label={t.close}
          className='-mr-1 text-[var(--mute)] hover:text-ink'
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

/**
 * What every player should know about the table: who is on their way out (and
 * how long they have to come back), whose turn is about to run out, missed-turn
 * warnings, who left or was removed, who the admin is now, and for the admin a
 * way to remove someone.
 */
export default function RoomNotice({
  room,
  you,
  receivedAt,
  onKick,
  busy,
  code,
  onLeave,
}: {
  room: RoomView | null;
  you: number;
  /** When the room view arrived, so countdowns can run from there */
  receivedAt: number;
  onKick?: (seat: number) => void;
  busy?: boolean;
  code?: string;
  onLeave?: () => void;
}) {
  const t = useText();
  const lang = useLang();
  const live = room?.status === 'playing';
  const now = useTick(!!live || !!room?.hostNotice);
  if (!room || room.status === 'waiting') return null;

  const elapsed = Math.floor((now - receivedAt) / 1000);
  const nameOf = (seat: number) => seatName(lang, seat, you, room.names);
  const lines: {
    key: string;
    tone: 'err' | 'warn' | 'mute';
    text: React.ReactNode;
    /** ms until it closes by itself; none keeps it up while it holds */
    autoClose?: number;
  }[] = [];

  if (room.out[you]) {
    lines.push({
      key: 'me-out',
      tone: 'err',
      text: t.meOut[room.outWhy[you] ?? 'left'],
    });
  }

  // who left, so a win (or an empty seat) is explained
  room.out.forEach((gone, seat) => {
    if (!gone || seat === you) return;
    lines.push({
      key: `out-${seat}-${room.outWhy[seat] ?? 'left'}`,
      tone: 'mute',
      autoClose: 8000,
      text: `${nameOf(seat)} ${t.other[room.outWhy[seat] ?? 'left']}`,
    });
  });

  if (live) {
    for (const a of room.leaving) {
      if (a.seat === you) continue;
      const left = Math.max(0, a.goneIn - elapsed);
      lines.push({
        key: `leaving-${a.seat}`,
        tone: 'warn',
        text: t.leaving(nameOf(a.seat), left),
      });
    }
  }

  if (room.hostNotice - elapsed > 0 && room.joined[room.host]) {
    lines.push({
      key: `host-${room.host}`,
      tone: 'mute',
      autoClose: 8000,
      text: t.nowAdmin(room.host === you ? null : nameOf(room.host)),
    });
  }

  const strikes = room.strikes[you] ?? 0;
  if (live && strikes > 0 && !room.out[you]) {
    lines.push({
      key: `strikes-${strikes}`,
      tone: 'warn',
      autoClose: 9000,
      text: t.strike(strikes, room.maxStrikes),
    });
  }

  // the turn clock, for whoever is being waited on
  let clock: React.ReactNode = null;
  const waiting = live ? room.waiting : null;
  if (waiting && !room.out[you]) {
    const left = Math.max(0, waiting.remaining - elapsed);
    const mine = waiting.seats.includes(you);
    const urgent = left <= 10;
    clock = (
      <div data-testid='turn-clock'>
        <div className='h-1 overflow-hidden rounded-full bg-line'>
          <div
            className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${
              mine && urgent ? 'bg-err' : 'bg-accent'
            }`}
            style={{
              width: `${Math.min(100, (left / waiting.seconds) * 100)}%`,
            }}
          />
        </div>
        <p
          className={`mt-1 text-center text-xs ${
            mine && urgent ? 'font-medium text-err' : 'text-[var(--mute)]'
          }`}
        >
          {mine
            ? t.yourClock(left)
            : t.theirClock(waiting.seats.map(nameOf).join(', '), left)}
        </p>
      </div>
    );
  }

  const admin =
    onKick && room.host === you && !room.out[you] ? (
      <AdminMenu
        room={room}
        you={you}
        busy={busy}
        onKick={onKick}
        code={code}
        onLeave={onLeave}
      />
    ) : null;

  if (!lines.length && !clock && !admin) return null;
  return (
    <>
      {lines.length > 0 && (
        <div
          className='pointer-events-none fixed top-16 left-1/2 z-[70] flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2'
          aria-live='polite'
        >
          {lines.map((l) => (
            <Toast key={l.key} tone={l.tone} autoClose={l.autoClose}>
              {l.text}
            </Toast>
          ))}
        </div>
      )}
      {clock && <div className='mt-1'>{clock}</div>}
      {admin}
    </>
  );
}
