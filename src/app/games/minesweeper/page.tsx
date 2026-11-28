'use client';

import {
  Clock3,
  Flag,
  MousePointer2,
  RotateCcw,
  Trophy,
  X,
} from 'lucide-react';
import * as React from 'react';

import styles from './minesweeper.module.css';

import useStoredState from '@/hooks/useStoredState';

import Confetti from '@/features/games/components/Confetti';
import GameShell from '@/features/games/components/GameShell';
import {
  chord,
  Level,
  LEVELS,
  MinesGame,
  newGame,
  reveal,
  toggleFlag,
} from '@/features/games/logic/minesweeper';
import { seededRandom } from '@/features/games/logic/seeded-random';
import SubmitScore from '@/features/leaderboard/components/SubmitScore';
import type { MinesMove } from '@/features/leaderboard/replay';

type Best = Partial<Record<Level, number>>;
const NO_BEST: Best = {};
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const BOARD_SHAKE = [
  { transform: 'translate(0, 0)' },
  { transform: 'translate(-6px, 2px)' },
  { transform: 'translate(6px, -2px)' },
  { transform: 'translate(-4px, 1px)' },
  { transform: 'translate(2px, 0)' },
  { transform: 'translate(0, 0)' },
];

const NUMBER_COLOR = [
  '',
  'text-sky-300',
  'text-emerald-300',
  'text-rose-300',
  'text-violet-300',
  'text-amber-300',
  'text-cyan-200',
  'text-fuchsia-200',
  'text-slate-200',
];

const pad = (n: number) =>
  `${n < 0 ? '-' : ''}${String(Math.min(Math.abs(n), 999)).padStart(3, '0')}`;

function FlagArt({
  exiting,
  onExit,
}: {
  exiting: boolean;
  onExit: () => void;
}) {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 24 24'
      className={styles.flag}
      data-exiting={exiting}
      onAnimationEnd={(event) => {
        if (exiting && event.target === event.currentTarget) onExit();
      }}
    >
      <path
        d='M8 20V4'
        fill='none'
        stroke='currentColor'
        strokeWidth='1.8'
        strokeLinecap='round'
      />
      <path
        className={styles.flagCloth}
        d='M9 4c4-2 5 2 11 0l-2.6 4L20 12c-6 2-7-2-11 0Z'
        fill='currentColor'
      />
      <path
        d='M5 21h7'
        stroke='currentColor'
        strokeWidth='1.8'
        strokeLinecap='round'
      />
    </svg>
  );
}

function MineArt() {
  return (
    <svg aria-hidden='true' viewBox='0 0 24 24' className={styles.mine}>
      <path
        d='M12 2v20M2 12h20M5 5l14 14M19 5 5 19'
        fill='none'
        stroke='currentColor'
        strokeWidth='1.7'
        strokeLinecap='round'
      />
      <circle cx='12' cy='12' r='6.1' fill='currentColor' />
      <path
        d='M8.6 12a3.4 3.4 0 0 1 3.4-3.4'
        fill='none'
        stroke='var(--paper)'
        strokeWidth='1.25'
        strokeLinecap='round'
      />
      <g className={styles.burst}>
        <path d='m6 4 3-2 1 4-3 1zM17 17l4-1-1 4-4 1z' fill='var(--hash)' />
        <path d='m17 5 4 1-2 3-3-1zM3 15l4 1-1 4-3-2z' fill='currentColor' />
      </g>
    </svg>
  );
}

function newRun() {
  let startedAt = 0;
  return {
    controller: new AbortController(),
    opening: false,
    ticket: null as string | null,
    rng: Math.random,
    moves: [] as MinesMove[],
    startClock() {
      startedAt = performance.now();
    },
    elapsedSeconds: () => (performance.now() - startedAt) / 1000,
  };
}

async function requestRun<T>(body: object, signal: AbortSignal): Promise<T> {
  const response = await fetch('/api/leaderboard/mines', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.any([signal, AbortSignal.timeout(3500)]),
  });
  if (!response.ok) throw new Error('Peringkat tidak tersedia');
  return response.json();
}

function Minesweeper() {
  const [level, setLevel] = React.useState<Level>('mudah');
  const [game, setGame] = React.useState<MinesGame>(() => newGame('mudah'));
  const latest = React.useRef(game);
  const run = React.useRef<ReturnType<typeof newRun> | null>(null);
  const boardFrame = React.useRef<HTMLDivElement>(null);
  const boardShake = React.useRef<Animation | null>(null);
  const [ranked, setRanked] = React.useState<
    { receipt: string; score: number } | 'checking' | 'unavailable' | null
  >(null);
  const [flagMode, setFlagMode] = React.useState(false);
  const [pending, setPending] = React.useState<number | null>(null);
  const [focused, setFocused] = React.useState(0);
  const [reveals, setReveals] = React.useState<Record<number, number>>({});
  const [unflagged, setUnflagged] = React.useState<number[]>([]);
  const [seconds, setSeconds] = React.useState(0);
  const [best, setBest] = useStoredState<Best>('mines-best', NO_BEST);
  const holdTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = React.useRef<number | null>(null);

  const playing = game.status === 'playing';
  React.useEffect(() => {
    run.current = newRun();
    return () => {
      run.current?.controller.abort();
      boardShake.current?.cancel();
      if (holdTimer.current) clearTimeout(holdTimer.current);
    };
  }, []);

  React.useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () => setSeconds(Math.floor(run.current?.elapsedSeconds() ?? 0)),
      250,
    );
    return () => clearInterval(timer);
  }, [playing]);

  const start = (next: Level) => {
    run.current?.controller.abort();
    boardShake.current?.cancel();
    boardShake.current = null;
    run.current = newRun();
    if (holdTimer.current !== null) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    held.current = null;
    setLevel(next);
    latest.current = newGame(next);
    setGame(latest.current);
    setRanked(null);
    setSeconds(0);
    setPending(null);
    setFocused(0);
    setReveals({});
    setUnflagged([]);
  };

  const apply = (
    next: MinesGame,
    move: MinesMove,
    active: ReturnType<typeof newRun>,
  ) => {
    const before = latest.current;
    if (next === before) return;
    active.moves.push(move);
    const [action, x, y] = move;
    if (action === 'flag') {
      const i = y * next.width + x;
      const animateRemoval =
        next.cells[i].state === 'hidden' &&
        !window.matchMedia?.(REDUCED_MOTION).matches;
      setUnflagged((previous) =>
        animateRemoval
          ? [...previous, i]
          : previous.filter((cell) => cell !== i),
      );
    }
    if (action === 'open') {
      const additions: Record<number, number> = {};
      const clicked = y * next.width + x;
      next.cells.forEach((cell, i) => {
        if (cell.state !== 'open' || before.cells[i].state === 'open') return;
        const origin = cell.mine ? (next.detonated ?? clicked) : clicked;
        const distance =
          Math.abs((i % next.width) - (origin % next.width)) +
          Math.abs(
            Math.floor(i / next.width) - Math.floor(origin / next.width),
          );
        additions[i] =
          cell.mine && distance > 0
            ? 95 + distance * 45 + (i % 4) * 11
            : Math.min(280, distance * 22);
      });
      setReveals((previous) => ({ ...previous, ...additions }));
      if (
        (next.opened - before.opened > 1 || next.status === 'lost') &&
        !window.matchMedia?.(REDUCED_MOTION).matches
      ) {
        boardShake.current?.cancel();
        boardShake.current =
          boardFrame.current?.animate?.(BOARD_SHAKE, 320) ?? null;
      }
      setUnflagged((previous) =>
        previous.length
          ? previous.filter((cell) => next.cells[cell].state === 'hidden')
          : previous,
      );
    }
    if (before.status === 'ready' && next.status !== 'ready')
      active.startClock();
    if (next.status === 'won' && before.status !== 'won') {
      const time = Math.max(1, Math.round(active.elapsedSeconds()));
      setSeconds(time);
      if (!best[level] || time < best[level]!)
        setBest({ ...best, [level]: time });
      if (active.ticket) {
        setRanked('checking');
        void requestRun<{ receipt: string; score: number }>(
          { action: 'finish', ticket: active.ticket, moves: active.moves },
          active.controller.signal,
        )
          .then((result) => {
            if (run.current === active && !active.controller.signal.aborted)
              setRanked(result);
          })
          .catch(() => {
            if (run.current === active && !active.controller.signal.aborted)
              setRanked('unavailable');
          });
      } else {
        setRanked('unavailable');
      }
    }
    latest.current = next;
    setGame(next);
  };

  const open = async (x: number, y: number) => {
    const active = run.current;
    const board = latest.current;
    const cell = board.cells[y * board.width + x];
    if (!active || active.opening || !cell) return;
    if (board.status === 'ready' && cell.state === 'hidden') {
      active.opening = true;
      setPending(y * board.width + x);
      try {
        const { seed, ticket } = await requestRun<{
          seed: number;
          ticket: string;
        }>({ action: 'start', level }, active.controller.signal);
        active.ticket = ticket;
        active.rng = seededRandom(seed);
      } catch {
        // A local game can still start while the leaderboard is unavailable.
      } finally {
        active.opening = false;
      }
      if (run.current !== active || active.controller.signal.aborted) return;
      setPending(null);
    }
    apply(
      cell.state === 'open'
        ? chord(board, x, y, active.rng)
        : reveal(board, x, y, active.rng),
      ['open', x, y],
      active,
    );
  };

  const flag = (x: number, y: number) => {
    const active = run.current;
    const board = latest.current;
    if (!active || active.opening || !board.cells[y * board.width + x]) return;
    apply(toggleFlag(board, x, y), ['flag', x, y], active);
  };

  const press = (x: number, y: number) => {
    const alreadyFlagged = held.current === y * latest.current.width + x;
    held.current = null;
    if (alreadyFlagged) return;
    if (flagMode) flag(x, y);
    else void open(x, y);
  };

  // long press on touch screens places a flag
  const holdStart = (x: number, y: number) => {
    if (holdTimer.current !== null) clearTimeout(holdTimer.current);
    held.current = null;
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      held.current = y * latest.current.width + x;
      flag(x, y);
    }, 450);
  };
  const holdEnd = () => {
    if (holdTimer.current !== null) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  const { width, height, status } = game;
  const over = status === 'won' || status === 'lost';
  const headline =
    status === 'won'
      ? `Selesai dalam ${seconds} detik`
      : status === 'lost'
        ? 'Ranjau meledak'
        : pending !== null
          ? 'Menyiapkan papan…'
          : status === 'ready'
            ? 'Buka petak pertama'
            : 'Permainan berlangsung';

  return (
    <div className='mx-auto w-full max-w-4xl space-y-3'>
      {status === 'won' && <Confetti />}

      <header className='flex flex-wrap items-center justify-between gap-3'>
        <h1 className='text-2xl font-semibold tracking-tight text-ink'>
          Minesweeper
        </h1>
        <div
          className='flex gap-1 rounded-xl border border-line bg-surface p-1'
          role='group'
          aria-label='Tingkat kesulitan'
        >
          {(Object.keys(LEVELS) as Level[]).map((name) => (
            <button
              key={name}
              type='button'
              onClick={() => start(name)}
              aria-pressed={name === level}
              className='min-h-11 rounded-lg px-3 text-xs font-semibold text-ink capitalize transition-colors hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-pressed:bg-accent aria-pressed:text-paper aria-pressed:hover:bg-accent'
            >
              {name}
            </button>
          ))}
        </div>
      </header>

      <div className='grid grid-cols-3 gap-1 rounded-xl border border-line bg-surface p-2 sm:gap-2'>
        {[
          {
            Icon: Flag,
            title: 'Sisa bendera',
            value: pad(game.mines - game.flags),
            color: 'text-hash',
          },
          {
            Icon: Clock3,
            title: 'Waktu',
            value: `${pad(seconds)} dtk`,
            color: 'text-ink',
          },
          {
            Icon: Trophy,
            title: 'Rekor',
            value: best[level] ? `${best[level]} dtk` : '—',
            color: 'text-accent',
          },
        ].map(({ Icon, title, value, color }) => (
          <div key={title} className='rounded-lg bg-card px-2 py-2.5 sm:px-3'>
            <div className='flex items-center gap-1.5 text-[11px] text-mute'>
              <Icon size={13} aria-hidden='true' />
              <span>{title}</span>
            </div>
            <div
              className={`mt-0.5 font-mono text-sm font-semibold tabular-nums sm:text-lg ${color}`}
            >
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div
          className='flex gap-1 rounded-lg border border-line bg-surface p-1'
          role='group'
          aria-label='Aksi petak'
        >
          {[
            { Icon: MousePointer2, label: 'Buka', flag: false },
            { Icon: Flag, label: 'Bendera', flag: true },
          ].map(({ Icon, label, flag }) => (
            <button
              key={label}
              type='button'
              aria-pressed={flagMode === flag}
              onClick={() => setFlagMode(flag)}
              className='flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-xs text-mute transition-colors hover:text-ink aria-pressed:bg-accent/15 aria-pressed:text-accent'
            >
              <Icon size={15} aria-hidden='true' /> {label}
            </button>
          ))}
        </div>
        <button
          type='button'
          onClick={() => start(level)}
          className='flex min-h-10 items-center gap-1.5 rounded-lg border border-line-strong bg-card px-3 text-xs font-medium transition-colors hover:border-mute'
        >
          <RotateCcw size={15} aria-hidden='true' />{' '}
          {over ? 'Main lagi' : 'Mulai ulang'}
        </button>
      </div>

      <div
        ref={boardFrame}
        className={`${styles.boardFrame} rounded-xl border border-line-strong bg-card p-1.5 shadow-xl sm:p-2`}
      >
        <div
          role='grid'
          aria-label='Papan Minesweeper'
          aria-busy={pending !== null}
          onContextMenu={(e) => e.preventDefault()}
          style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }}
          className={styles.board}
        >
          {game.cells.map((cell, i) => {
            const x = i % width;
            const y = Math.floor(i / width);
            const isOpen = cell.state === 'open';
            const wrongFlag =
              status === 'lost' && cell.state === 'flag' && !cell.mine;
            const stateLabel = wrongFlag
              ? 'bendera salah'
              : cell.state === 'flag'
                ? 'bendera'
                : isOpen
                  ? cell.mine
                    ? 'ranjau'
                    : cell.adjacent
                      ? `${cell.adjacent} ranjau sekitar`
                      : 'kosong'
                  : '';
            return (
              <button
                key={i}
                type='button'
                role='gridcell'
                data-state={wrongFlag ? 'wrong' : cell.state}
                data-mine={isOpen && cell.mine ? 'true' : undefined}
                data-detonated={game.detonated === i || undefined}
                data-pending={pending === i ? 'true' : undefined}
                aria-label={`Baris ${y + 1}, kolom ${x + 1}${stateLabel ? `, ${stateLabel}` : ''}`}
                tabIndex={focused === i ? 0 : -1}
                onFocus={() => setFocused(i)}
                onKeyDown={(event) => {
                  const steps: Partial<Record<string, number>> = {
                    ArrowLeft: x > 0 ? -1 : 0,
                    ArrowRight: x < width - 1 ? 1 : 0,
                    ArrowUp: y > 0 ? -width : 0,
                    ArrowDown: y < height - 1 ? width : 0,
                  };
                  const step = steps[event.key];
                  if (step !== undefined) {
                    event.preventDefault();
                    event.currentTarget.parentElement
                      ?.querySelectorAll('button')
                      [i + step]?.focus();
                  } else if (event.key.toLowerCase() === 'f') {
                    event.preventDefault();
                    if (!event.repeat) flag(x, y);
                  }
                }}
                onClick={() => press(x, y)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (held.current === i) return;
                  if (holdTimer.current !== null) {
                    clearTimeout(holdTimer.current);
                    holdTimer.current = null;
                    held.current = i;
                  }
                  flag(x, y);
                }}
                onTouchStart={() => holdStart(x, y)}
                onTouchEnd={holdEnd}
                onTouchMove={holdEnd}
                onTouchCancel={() => {
                  holdEnd();
                  held.current = null;
                }}
                className={`${styles.cell} ${isOpen && !cell.mine ? NUMBER_COLOR[cell.adjacent] : ''}`}
                style={
                  reveals[i] === undefined
                    ? undefined
                    : ({
                        '--reveal-delay': `${reveals[i]}ms`,
                      } as React.CSSProperties)
                }
              >
                {isOpen && (
                  <span className={styles.fragments} aria-hidden='true'>
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </span>
                )}
                {wrongFlag ? (
                  <X aria-hidden='true' />
                ) : cell.state === 'flag' ||
                  (unflagged.includes(i) && cell.state === 'hidden') ? (
                  <FlagArt
                    exiting={cell.state !== 'flag'}
                    onExit={() =>
                      setUnflagged((previous) =>
                        previous.filter((cell) => cell !== i),
                      )
                    }
                  />
                ) : isOpen && cell.mine ? (
                  <MineArt />
                ) : isOpen && cell.adjacent ? (
                  cell.adjacent
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <p
        role='status'
        className={`rounded-lg border border-line bg-surface px-3 py-2.5 text-center text-sm ${status === 'won' ? 'text-accent' : status === 'lost' ? 'text-err' : 'text-mute'}`}
      >
        <span key={headline} className={styles.message}>
          {headline}
        </span>
      </p>

      {ranked && typeof ranked === 'object' && (
        <SubmitScore
          game='minesweeper'
          score={ranked.score}
          replay={ranked.receipt}
          label='Waktu'
          leaderboardHref={`/games/leaderboard?game=minesweeper&level=${level}`}
        />
      )}
      {typeof ranked === 'string' && (
        <p className='mt-2 text-center text-xs text-mute' role='status'>
          {ranked === 'checking'
            ? 'Memverifikasi waktu untuk leaderboard…'
            : 'Leaderboard tidak tersedia untuk ronde ini.'}
        </p>
      )}

      <p className='pt-1 text-center text-xs leading-relaxed text-mute'>
        Klik kanan, tahan, atau tekan F untuk memasang bendera. Buka angka yang
        jumlah benderanya sudah pas untuk membuka petak di sekitarnya.
      </p>
    </div>
  );
}

export default function MinesweeperPage() {
  return (
    <GameShell name='minesweeper' fit>
      <Minesweeper />
    </GameShell>
  );
}
