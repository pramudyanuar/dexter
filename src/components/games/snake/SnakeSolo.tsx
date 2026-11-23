'use client';

import * as React from 'react';

import { seededRandom } from '@/lib/games/seeded-random';
import { Dir, initialSnake, SnakeState, step, turn } from '@/lib/games/snake';
import {
  DAILY_DURATION_MS,
  DailyChallenge,
  nextSnakeDelay,
  SnakeReplay,
} from '@/lib/games/snake-daily';

import { SnakePad, useSnakeKeys } from '@/components/games/snake/controls';
import SnakeBoard from '@/components/games/snake/SnakeBoard';

type Status =
  | { phase: 'ready' | 'running' | 'paused' }
  | { phase: 'ended'; replay: SnakeReplay; seed: number };

function preview(challenge?: DailyChallenge) {
  return initialSnake(challenge ? seededRandom(challenge.seed) : () => 0.5);
}

export default function SnakeSolo({
  best,
  onBest,
  challenge,
  onRestart,
  resultContent,
}: {
  best: number;
  onBest: (score: number) => void;
  challenge?: DailyChallenge;
  onRestart?: () => void;
  resultContent: (
    board: SnakeState,
    replay: SnakeReplay,
    seed: number,
  ) => React.ReactNode;
}) {
  const [{ board, elapsed }, setDisplay] = React.useState(() => ({
    board: preview(challenge),
    elapsed: 0,
  }));
  const [status, setStatus] = React.useState<Status>({ phase: 'ready' });
  const { phase } = status;
  const run = React.useRef({
    board,
    seed: 0,
    rng: Math.random,
    elapsed: 0,
    ticks: 0,
    turns: [] as SnakeReplay['turns'],
  });
  const boardRef = React.useRef<HTMLDivElement>(null);
  const limit = challenge ? DAILY_DURATION_MS : Infinity;

  const tick = React.useEffectEvent(() => {
    if (document.hidden) return null;
    const play = run.current;
    const before = play.board;
    play.elapsed += nextSnakeDelay(before.score, play.elapsed, limit);
    play.ticks++;
    if (before.dir !== before.next) {
      play.turns.push([play.ticks, before.next]);
    }
    const next = step(before, play.rng);
    play.board = next;
    setDisplay({ board: next, elapsed: play.elapsed });
    if (!next.result && play.elapsed < limit) {
      return nextSnakeDelay(next.score, play.elapsed, limit);
    }

    setStatus({
      phase: 'ended',
      replay: { ticks: play.ticks, turns: play.turns },
      seed: play.seed,
    });
    if (next.score > best) onBest(next.score);
    return null;
  });

  React.useEffect(() => {
    if (phase !== 'running') return;
    const play = run.current;
    let timer = window.setTimeout(
      move,
      nextSnakeDelay(play.board.score, play.elapsed, limit),
    );
    function move() {
      const delay = tick();
      if (delay !== null) timer = window.setTimeout(move, delay);
    }
    return () => window.clearTimeout(timer);
  }, [phase, limit]);

  React.useEffect(() => {
    function pauseHidden() {
      if (document.hidden) {
        setStatus((current) =>
          current.phase === 'running' ? { phase: 'paused' } : current,
        );
      }
    }
    document.addEventListener('visibilitychange', pauseHidden);
    return () => document.removeEventListener('visibilitychange', pauseHidden);
  }, []);

  const focusBoard = () => boardRef.current?.focus({ preventScroll: true });

  function start(dir?: Dir) {
    const seed =
      challenge?.seed ?? crypto.getRandomValues(new Uint32Array(1))[0];
    const rng = seededRandom(seed);
    const initial = initialSnake(rng);
    run.current = {
      board: dir ? turn(initial, dir) : initial,
      seed,
      rng,
      elapsed: 0,
      ticks: 0,
      turns: [],
    };
    setDisplay({ board: initial, elapsed: 0 });
    setStatus({ phase: 'running' });
    focusBoard();
  }

  function steer(dir: Dir) {
    if (phase === 'ended') return false;
    if (phase === 'ready') {
      start(dir);
    } else {
      run.current.board = turn(run.current.board, dir);
      if (phase === 'paused') {
        setStatus({ phase: 'running' });
        focusBoard();
      }
    }
    return true;
  }

  function togglePause() {
    if (phase === 'ended') return false;
    if (phase === 'ready') start();
    if (phase === 'running') setStatus({ phase: 'paused' });
    if (phase === 'paused') {
      setStatus({ phase: 'running' });
      focusBoard();
    }
    return true;
  }

  function restart() {
    if (phase !== 'ended') return false;
    setDisplay({ board: preview(challenge), elapsed: 0 });
    setStatus({ phase: 'ready' });
    onRestart?.();
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
        {challenge && (
          <span className='text-mute'>
            <strong className='text-ink'>
              {Math.ceil((limit - elapsed) / 1000)}
            </strong>{' '}
            dtk
          </span>
        )}
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
                  : board.result === 'lost'
                    ? `Game over. Skor ${board.score}.`
                    : `Waktu habis. Skor ${board.score}.`)}
            </p>
            {status.phase === 'ended' &&
              resultContent(board, status.replay, status.seed)}
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
