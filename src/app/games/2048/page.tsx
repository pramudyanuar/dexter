'use client';

import * as React from 'react';

import {
  Action2048,
  maxTile,
  Move,
  play2048,
  start2048,
} from '@/lib/games/game2048';
import useMounted from '@/lib/useMounted';
import useStoredState from '@/lib/useStoredState';

import Confetti from '@/components/games/Confetti';
import GameShell from '@/components/games/GameShell';
import { shouldIgnoreGameKey } from '@/components/games/snake/controls';
import SubmitScore from '@/components/games/SubmitScore';

interface Game {
  seed: number;
  moves: Action2048[];
  run: ReturnType<typeof start2048>;
}

const KEYS: Record<string, Move> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
};

function fresh(): Game {
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  return { seed, moves: [], run: start2048(seed) };
}

const TILE_BG: Record<number, string> = {
  2: '#eee4da',
  4: '#ede0c8',
  8: '#f2b179',
  16: '#f59563',
  32: '#f67c5f',
  64: '#f65e3b',
  128: '#edcf72',
  256: '#edcc61',
  512: '#edc850',
  1024: '#edc53f',
  2048: '#edc22e',
};

/** Classic warm palette; fixed colours keep the numbers readable in both themes. */
function tileStyle(value: number): React.CSSProperties {
  if (!value) return { background: 'var(--card)' };
  const glow =
    value >= 128
      ? `0 0 ${Math.min(24, Math.log2(value) * 2)}px color-mix(in oklab, ${TILE_BG[Math.min(value, 2048)] ?? '#3c3a32'} 70%, transparent)`
      : undefined;
  return {
    background: TILE_BG[value] ?? '#3c3a32',
    color: value <= 4 ? '#776e65' : '#f9f6f2',
    boxShadow: glow,
  };
}

function Game2048() {
  // the board is random, so it is only created on the client
  const [game, setGame] = React.useState<Game>(fresh);
  const latest = React.useRef(game);
  const [best, setBest] = useStoredState<number>('g2048-best', 0);
  const touchStart = React.useRef<{ x: number; y: number } | null>(null);
  const { board, score, over, previous } = game.run;
  const reached = maxTile(board);

  const restart = () => {
    latest.current = fresh();
    setGame(latest.current);
  };

  const play = (action: Action2048) => {
    const current = latest.current;
    const run = play2048(current.run, action);
    if (!run) return;
    latest.current = {
      ...current,
      run,
      moves: [...current.moves, action],
    };
    setGame(latest.current);
    if (run.score > best) setBest(run.score);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (shouldIgnoreGameKey(e)) return;
    const dir = KEYS[e.key] ?? KEYS[e.key.toLowerCase()];
    if (dir) {
      e.preventDefault(); // arrow keys would scroll the page
      play(dir);
    }
  };

  // re-bound on each render so it always sees the current board
  React.useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    const end = e.changedTouches[0];
    touchStart.current = null;
    if (!start) return;

    const dx = end.clientX - start.x;
    const dy = end.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    play(
      Math.abs(dx) > Math.abs(dy)
        ? dx > 0
          ? 'right'
          : 'left'
        : dy > 0
          ? 'down'
          : 'up',
    );
  };

  return (
    <>
      <div className='mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-mute'>
        <span>
          skor <span className='text-ink'>{score}</span>
        </span>
        <span>
          terbaik <span className='text-ink'>{best}</span>
        </span>
        <div className='flex gap-2'>
          <button
            type='button'
            disabled={!previous}
            onClick={() => play('undo')}
            className='text-mute'
          >
            Undo
          </button>
          <button type='button' onClick={restart} className='text-info'>
            game baru
          </button>
        </div>
      </div>

      <div
        role='grid'
        aria-label='Papan 2048'
        onTouchStart={(e) => {
          touchStart.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
          };
        }}
        onTouchEnd={onTouchEnd}
        className='relative grid touch-none grid-cols-4 gap-2 rounded-sm border border-line bg-line/50 p-2'
      >
        {board.flat().map((value, i) => (
          <div
            key={`${i}-${value}`}
            role='gridcell'
            style={tileStyle(value)}
            className={`flex aspect-square items-center justify-center rounded-md font-bold ${
              value ? 'a-pop' : ''
            } ${
              value >= 1000 ? 'text-lg' : value >= 100 ? 'text-xl' : 'text-2xl'
            }`}
          >
            {value || ''}
          </div>
        ))}

        {over && (
          <div className='a-fade absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-sm bg-paper/80 backdrop-blur-[2px]'>
            <p className='text-err'>Tidak ada gerakan lagi. Skor {score}.</p>
            <button
              type='button'
              onClick={restart}
              className='text-info hover:underline'
            >
              main lagi
            </button>
          </div>
        )}
      </div>

      {reached >= 2048 && <Confetti count={24} />}
      <p className='mt-4 text-center text-xs text-mute'>
        {reached >= 2048
          ? `Sampai ${reached}! Lanjutkan kalau masih mau.`
          : 'Panah atau WASD, atau geser di papan.'}
      </p>

      {over && score > 0 && (
        <SubmitScore
          game='2048'
          score={score}
          replay={{ seed: game.seed, moves: game.moves }}
        />
      )}
    </>
  );
}

export default function Page2048() {
  const mounted = useMounted();

  return <GameShell name='2048'>{mounted ? <Game2048 /> : null}</GameShell>;
}
