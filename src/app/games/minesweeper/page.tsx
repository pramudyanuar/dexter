'use client';

import * as React from 'react';

import {
  chord,
  Level,
  LEVELS,
  MinesGame,
  newGame,
  reveal,
  toggleFlag,
} from '@/lib/games/minesweeper';
import { seededRandom } from '@/lib/games/seeded-random';
import type { MinesMove } from '@/lib/leaderboard/replay';
import useStoredState from '@/lib/useStoredState';

import Confetti from '@/components/games/Confetti';
import GameShell from '@/components/games/GameShell';
import SubmitScore from '@/components/games/SubmitScore';

type Best = Partial<Record<Level, number>>;
const NO_BEST: Best = {};

const NUMBER_COLOR = [
  '',
  'text-info',
  'text-accent',
  'text-err',
  'text-hash',
  'text-err',
  'text-info',
  'text-ink',
  'text-mute',
];

const pad = (n: number) => String(Math.min(n, 999)).padStart(3, '0');

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
  const [ranked, setRanked] = React.useState<
    { receipt: string; score: number } | 'checking' | 'unavailable' | null
  >(null);
  const [flagMode, setFlagMode] = React.useState(false);
  const [seconds, setSeconds] = React.useState(0);
  const [best, setBest] = useStoredState<Best>('mines-best', NO_BEST);
  const holdTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = React.useRef<number | null>(null);

  const playing = game.status === 'playing';
  React.useEffect(() => {
    run.current = newRun();
    return () => {
      run.current?.controller.abort();
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
    run.current = newRun();
    if (holdTimer.current !== null) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    held.current = null;
    setLevel(next);
    latest.current = newGame(next);
    setGame(latest.current);
    setRanked(null);
    setSeconds(0);
  };

  const apply = (
    next: MinesGame,
    move: MinesMove,
    active: ReturnType<typeof newRun>,
  ) => {
    const before = latest.current;
    if (next === before) return;
    active.moves.push(move);
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

  const { width } = game;
  const small = width >= 16;

  return (
    <>
      {game.status === 'won' && <Confetti />}

      <div className='mb-3 flex justify-center gap-4 text-xs'>
        {(Object.keys(LEVELS) as Level[]).map((name) => (
          <button
            key={name}
            type='button'
            onClick={() => start(name)}
            className={
              name === level ? 'text-info' : 'text-mute hover:text-ink'
            }
          >
            {name}
          </button>
        ))}
      </div>

      <div className='mb-3 flex items-center justify-between text-xs text-mute'>
        <span>
          ranjau{' '}
          <span className='text-ink'>{pad(game.mines - game.flags)}</span>
        </span>
        <button
          type='button'
          onClick={() => start(level)}
          className='text-info'
        >
          {game.status === 'lost'
            ? '😵 main lagi'
            : game.status === 'won'
              ? '😎 main lagi'
              : 'mulai ulang'}
        </button>
        <span>
          waktu <span className='text-ink'>{pad(seconds)}</span>
        </span>
      </div>

      <div
        role='grid'
        aria-label='Papan Minesweeper'
        onContextMenu={(e) => e.preventDefault()}
        style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }}
        className={`grid touch-manipulation gap-px overflow-hidden rounded-md border border-line bg-line/40 select-none ${
          game.status === 'lost' ? 'a-shake' : ''
        }`}
      >
        {game.cells.map((cell, i) => {
          const x = i % width;
          const y = Math.floor(i / width);
          const lost = game.status === 'lost';
          const isOpen = cell.state === 'open';
          const wrongFlag = lost && cell.state === 'flag' && !cell.mine;

          let label = '';
          if (wrongFlag) label = '✗';
          else if (cell.state === 'flag') label = '⚑';
          else if (isOpen && cell.mine) label = '✱';
          else if (isOpen && cell.adjacent > 0) label = String(cell.adjacent);

          return (
            <button
              key={i}
              type='button'
              role='gridcell'
              data-state={wrongFlag ? 'wrong' : cell.state}
              data-mine={isOpen && cell.mine ? 'true' : undefined}
              aria-label={`Baris ${y + 1}, kolom ${x + 1}`}
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
              className={`flex aspect-square items-center justify-center font-bold transition-colors ${
                small ? 'text-[11px]' : 'text-sm'
              } ${
                isOpen
                  ? cell.mine
                    ? 'bg-err/40 text-err'
                    : `a-pop bg-paper ${NUMBER_COLOR[cell.adjacent] ?? ''}`
                  : 'bg-card shadow-[inset_1px_1px_0_rgb(255_255_255/0.25),inset_-1px_-1px_0_rgb(0_0_0/0.18)] hover:bg-line/60 active:scale-90'
              } ${cell.state === 'flag' ? (wrongFlag ? 'text-err' : 'text-hash') : ''}`}
            >
              {cell.state === 'flag' && !wrongFlag ? (
                <span key='flag' className='a-wiggle inline-block'>
                  {label}
                </span>
              ) : isOpen && cell.mine ? (
                <span
                  key='mine'
                  aria-label='ranjau'
                  className='a-reveal inline-block size-2.5 rounded-full bg-err'
                  style={{ animationDelay: `${(i % 9) * 0.05}s` }}
                />
              ) : (
                label
              )}
            </button>
          );
        })}
      </div>

      <div className='mt-3 flex items-center justify-between text-xs'>
        <button
          type='button'
          onClick={() => setFlagMode((m) => !m)}
          aria-pressed={flagMode}
          className={flagMode ? 'text-info' : 'text-mute hover:text-ink'}
        >
          mode: {flagMode ? 'bendera ⚑' : 'buka'}
        </button>
        <span className='text-mute'>
          rekor {level}: {best[level] ? `${best[level]}s` : '-'}
        </span>
      </div>

      <p className='a-slide-up mt-3 text-center text-sm' aria-live='polite'>
        {game.status === 'won' && (
          <span className='text-accent'>
            Selamat! Selesai dalam {seconds} detik.
          </span>
        )}
        {game.status === 'lost' && (
          <span className='text-err'>Kena ranjau.</span>
        )}
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

      <p className='mt-auto pt-4 text-center text-xs text-mute'>
        Klik kiri buka, klik kanan atau tahan lama untuk bendera. Klik angka
        yang benderanya pas untuk membuka sekitarnya.
      </p>
    </>
  );
}

export default function MinesweeperPage() {
  return (
    <GameShell name='minesweeper' wide>
      <Minesweeper />
    </GameShell>
  );
}
