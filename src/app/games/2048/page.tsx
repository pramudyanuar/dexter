'use client';

import * as React from 'react';

import {
  addTile,
  Board,
  canMove,
  maxTile,
  Move,
  move,
  newBoard,
} from '@/lib/games/game2048';
import useMounted from '@/lib/useMounted';
import useStoredState from '@/lib/useStoredState';

import Confetti from '@/components/games/Confetti';
import GameShell from '@/components/games/GameShell';

interface Game {
  board: Board;
  score: number;
  over: boolean;
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

const fresh = (): Game => ({ board: newBoard(), score: 0, over: false });

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
  const [best, setBest] = useStoredState<number>('g2048-best', 0);
  const touchStart = React.useRef<{ x: number; y: number } | null>(null);
  const reached = maxTile(game.board);

  const play = (dir: Move) => {
    if (game.over) return;
    const result = move(game.board, dir);
    if (!result.moved) return;

    const board = addTile(result.board);
    const score = game.score + result.gained;
    setGame({ board, score, over: !canMove(board) });
    if (score > best) setBest(score);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
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
      <div className='mb-3 flex items-center justify-between text-xs text-mute'>
        <span>
          skor <span className='text-ink'>{game.score}</span>
        </span>
        <button
          type='button'
          onClick={() => setGame(fresh())}
          className='hover:text-accent'
        >
          [game baru]
        </button>
        <span>
          terbaik <span className='text-ink'>{best}</span>
        </span>
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
        {game.board.flat().map((value, i) => (
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

        {game.over && (
          <div className='a-fade absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-sm bg-paper/80 backdrop-blur-[2px]'>
            <p className='text-err'>
              Tidak ada gerakan lagi. Skor {game.score}.
            </p>
            <button
              type='button'
              onClick={() => setGame(fresh())}
              className='text-info hover:underline'
            >
              [main lagi]
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
    </>
  );
}

export default function Page2048() {
  const mounted = useMounted();

  return <GameShell name='2048'>{mounted ? <Game2048 /> : null}</GameShell>;
}
