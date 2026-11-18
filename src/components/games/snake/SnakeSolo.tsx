'use client';

import * as React from 'react';

import {
  delayFor,
  Dir,
  initialSnake,
  SnakeState,
  step,
  turn,
} from '@/lib/games/snake';

import { SnakePad, useSnakeKeys } from '@/components/games/snake/controls';
import SnakeBoard from '@/components/games/snake/SnakeBoard';

type Phase = 'ready' | 'running' | 'paused' | 'ended';

const startPreview = () => initialSnake(() => 0.5);

export default function SnakeSolo({
  best,
  onBest,
  resultContent,
}: {
  best: number;
  onBest: (score: number) => void;
  resultContent: (board: SnakeState) => React.ReactNode;
}) {
  const [board, setBoard] = React.useState(startPreview);
  const [phase, setPhase] = React.useState<Phase>('ready');
  const game = React.useRef(board);
  const boardRef = React.useRef<HTMLDivElement>(null);

  const tick = React.useEffectEvent(() => {
    if (document.hidden) return null;
    const next = step(game.current);
    game.current = next;
    setBoard(next);
    if (!next.result) return delayFor(next.score);

    setPhase('ended');
    if (next.score > best) onBest(next.score);
    return null;
  });

  React.useEffect(() => {
    if (phase !== 'running') return;
    let timer = window.setTimeout(move, delayFor(game.current.score));
    function move() {
      const delay = tick();
      if (delay !== null) timer = window.setTimeout(move, delay);
    }
    return () => window.clearTimeout(timer);
  }, [phase]);

  React.useEffect(() => {
    function pauseHidden() {
      if (document.hidden) {
        setPhase((current) => (current === 'running' ? 'paused' : current));
      }
    }
    document.addEventListener('visibilitychange', pauseHidden);
    return () => document.removeEventListener('visibilitychange', pauseHidden);
  }, []);

  const focusBoard = () => boardRef.current?.focus({ preventScroll: true });

  function start(dir?: Dir) {
    const initial = initialSnake();
    game.current = dir ? turn(initial, dir) : initial;
    setBoard(initial);
    setPhase('running');
    focusBoard();
  }

  function steer(dir: Dir) {
    if (phase === 'ended') return false;
    if (phase === 'ready') {
      start(dir);
    } else {
      game.current = turn(game.current, dir);
      if (phase === 'paused') {
        setPhase('running');
        focusBoard();
      }
    }
    return true;
  }

  function togglePause() {
    if (phase === 'ended') return false;
    if (phase === 'ready') start();
    if (phase === 'running') setPhase('paused');
    if (phase === 'paused') {
      setPhase('running');
      focusBoard();
    }
    return true;
  }

  function restart() {
    if (phase !== 'ended') return false;
    const initial = startPreview();
    game.current = initial;
    setBoard(initial);
    setPhase('ready');
    focusBoard();
    return true;
  }

  useSnakeKeys(steer, togglePause, restart);

  return (
    <section aria-label='Permainan Snake' className='space-y-3'>
      <div className='flex items-center justify-between gap-3 text-sm'>
        <span className='text-mute'>
          Skor <strong className='text-ink'>{board.score}</strong>
        </span>
        <span className='text-mute'>
          Terbaik <strong className='text-ink'>{best}</strong>
        </span>
        <button
          type='button'
          disabled={phase !== 'running'}
          onClick={togglePause}
          className='min-h-11 rounded-md border border-line px-3 hover:border-accent disabled:invisible'
        >
          Jeda
        </button>
      </div>

      <SnakeBoard
        boardRef={boardRef}
        snakes={[board]}
        food={board.food}
        active={phase === 'running'}
        onSwipe={steer}
      >
        {phase !== 'running' && (
          <div className='absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[inherit] bg-paper/85 px-3 text-center'>
            <p role='status' className='font-medium text-ink'>
              {phase === 'ready' && 'Makan apel dan hindari tabrakan.'}
              {phase === 'paused' && 'Permainan dijeda.'}
              {phase === 'ended' &&
                (board.result === 'won'
                  ? `Menang! Papan penuh. Skor ${board.score}.`
                  : `Game over. Skor ${board.score}.`)}
            </p>
            {phase === 'ended' && resultContent(board)}
            <button
              type='button'
              className='min-h-11 rounded-lg bg-ink px-4 font-semibold text-paper hover:opacity-90'
              onClick={phase === 'ended' ? restart : togglePause}
            >
              {phase === 'ready'
                ? 'Mulai'
                : phase === 'paused'
                  ? 'Lanjut'
                  : 'Main lagi'}
            </button>
          </div>
        )}
      </SnakeBoard>
      <SnakePad onDirection={steer} disabled={phase === 'ended'} />
      <p className='text-center text-xs text-mute'>
        Panah atau WASD untuk belok. Spasi untuk jeda. Geser di layar sentuh.
      </p>
    </section>
  );
}
