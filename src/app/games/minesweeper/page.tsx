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
import useStoredState from '@/lib/useStoredState';

import Confetti from '@/components/games/Confetti';
import GameShell from '@/components/games/GameShell';

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

function Minesweeper() {
  const [level, setLevel] = React.useState<Level>('mudah');
  const [game, setGame] = React.useState<MinesGame>(() => newGame('mudah'));
  const [flagMode, setFlagMode] = React.useState(false);
  const [seconds, setSeconds] = React.useState(0);
  const [best, setBest] = useStoredState<Best>('mines-best', NO_BEST);
  const startedAt = React.useRef(0);
  const holdTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = React.useRef(false);

  const playing = game.status === 'playing';

  React.useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () => setSeconds(Math.floor((Date.now() - startedAt.current) / 1000)),
      250,
    );
    return () => clearInterval(timer);
  }, [playing]);

  const start = (next: Level) => {
    setLevel(next);
    setGame(newGame(next));
    setSeconds(0);
  };

  const apply = (next: MinesGame) => {
    if (game.status === 'ready' && next.status !== 'ready') {
      startedAt.current = Date.now();
    }
    if (next.status === 'won' && game.status !== 'won') {
      const time = Math.max(
        1,
        Math.round((Date.now() - startedAt.current) / 1000),
      );
      setSeconds(time);
      if (!best[level] || time < best[level]!)
        setBest({ ...best, [level]: time });
    }
    setGame(next);
  };

  const open = (x: number, y: number) => {
    const cell = game.cells[y * game.width + x];
    apply(cell.state === 'open' ? chord(game, x, y) : reveal(game, x, y));
  };

  const flag = (x: number, y: number) => apply(toggleFlag(game, x, y));

  const press = (x: number, y: number) => {
    if (held.current) {
      held.current = false; // the long press already placed a flag
      return;
    }
    if (flagMode) flag(x, y);
    else open(x, y);
  };

  // long press on touch screens places a flag
  const holdStart = (x: number, y: number) => {
    held.current = false;
    holdTimer.current = setTimeout(() => {
      held.current = true;
      flag(x, y);
    }, 450);
  };
  const holdEnd = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
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
              name === level ? 'text-accent' : 'text-mute hover:text-ink'
            }
          >
            [{name}]
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
          className='hover:text-accent'
        >
          {game.status === 'lost'
            ? '[:( main lagi]'
            : game.status === 'won'
              ? '[:D main lagi]'
              : '[mulai ulang]'}
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
                flag(x, y);
              }}
              onTouchStart={() => holdStart(x, y)}
              onTouchEnd={holdEnd}
              onTouchMove={holdEnd}
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
                  className='a-reveal inline-block text-base'
                  style={{ animationDelay: `${(i % 9) * 0.05}s` }}
                >
                  💣
                </span>
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
          className={flagMode ? 'text-hash' : 'text-mute hover:text-ink'}
        >
          [mode: {flagMode ? 'bendera ⚑' : 'buka'}]
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
