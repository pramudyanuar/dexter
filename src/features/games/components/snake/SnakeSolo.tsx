'use client';

import { ArrowUpRight, Pause } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import styles from '@/features/games/components/snake/snake.module.css';

import {
  SnakePad,
  useSnakeKeys,
} from '@/features/games/components/snake/controls';
import SnakeBoard from '@/features/games/components/snake/SnakeBoard';
import { seededRandom } from '@/features/games/logic/seeded-random';
import {
  Dir,
  GRID,
  initialSnake,
  SnakeState,
  step,
  turn,
} from '@/features/games/logic/snake';
import {
  DAILY_DURATION_MS,
  DailyChallenge,
  nextSnakeDelay,
  SnakeReplay,
} from '@/features/games/logic/snake-daily';

type Status =
  | { phase: 'ready' | 'running' | 'paused' }
  | { phase: 'ended'; replay: SnakeReplay; seed: number };

const classicPreview = {
  dir: 'right' as const,
  food: { x: 16, y: 5 },
  snake: [
    [11, 5],
    [10, 5],
    [9, 5],
    [8, 5],
    [7, 5],
    [6, 5],
    [5, 5],
    [5, 6],
    [5, 7],
    [5, 8],
    [5, 9],
    [4, 9],
    [3, 9],
    [2, 9],
  ].map(([x, y]) => ({ x, y })),
};

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
    if (phase === 'running') {
      setStatus({ phase: 'paused' });
      focusBoard();
    }
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

  const visible = phase === 'ready' && !challenge ? classicPreview : board;

  return (
    <section aria-label='Permainan Snake' className={styles.play}>
      <div className={styles.stats}>
        <dl className={styles.scores}>
          <div>
            <dt>Skor</dt>
            <dd>{board.score}</dd>
          </div>
          <div>
            <dt>Terbaik</dt>
            <dd>{best}</dd>
          </div>
          {challenge && (
            <div>
              <dt>Waktu</dt>
              <dd>
                {Math.ceil((limit - elapsed) / 1000)} <small>dtk</small>
              </dd>
            </div>
          )}
        </dl>
        <button
          type='button'
          aria-label='Jeda'
          disabled={phase !== 'running'}
          onClick={togglePause}
          className={styles.pause}
        >
          <Pause size={16} aria-hidden='true' />
          <span>Jeda</span>
        </button>
      </div>

      <div className={styles.arena}>
        <div className={styles.arenaCaption}>
          {challenge ? (
            <time dateTime={challenge.day}>{challenge.day} WIB</time>
          ) : (
            <span>Arena</span>
          )}
          <span>
            {GRID} × {GRID}
          </span>
        </div>
        <SnakeBoard
          boardRef={boardRef}
          snakes={[visible]}
          food={visible.food}
          onSwipe={steer}
        >
          {phase !== 'running' && (
            <div
              className={
                phase === 'ready'
                  ? `${styles.overlay} ${styles.ready}`
                  : styles.overlay
              }
            >
              <p role='status'>
                {phase === 'ready' && 'Siap bermain?'}
                {phase === 'paused' && 'Permainan dijeda.'}
                {phase === 'ended' &&
                  (board.result === 'won'
                    ? `Menang! Papan penuh. Skor ${board.score}.`
                    : board.result === 'lost'
                      ? `Game over. Skor ${board.score}.`
                      : `Waktu habis. Skor ${board.score}.`)}
              </p>
              <button
                type='button'
                className={styles.primary}
                onClick={phase === 'ended' ? restart : togglePause}
              >
                {phase === 'ready'
                  ? 'Mulai'
                  : phase === 'paused'
                    ? 'Lanjut'
                    : 'Main lagi'}
              </button>
              {status.phase === 'ended' &&
                resultContent(board, status.replay, status.seed)}
            </div>
          )}
        </SnakeBoard>
        <p className={styles.objective}>
          Makan apel. Hindari dinding dan tubuhmu.
        </p>
      </div>

      <div className={styles.controls}>
        <div className={styles.keyboard}>
          <h2 className='mb-3 text-xl font-semibold tracking-tight'>Kontrol</h2>
          <dl className='divide-y divide-line border-y border-line text-sm'>
            <div className='flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3'>
              <dt className='text-mute'>Belok</dt>
              <dd className='flex flex-wrap items-center gap-2 font-mono font-semibold'>
                <kbd>
                  <span className='sr-only'>Tombol panah</span>
                  <span aria-hidden='true'>↑ ↓ ← →</span>
                </kbd>
                <span className='text-mute'>/</span>
                <kbd>WASD</kbd>
              </dd>
            </div>
            <div className='flex items-center justify-between gap-2 py-3'>
              <dt className='text-mute'>Jeda / lanjut</dt>
              <dd>
                <kbd className='font-mono font-semibold'>Spasi</kbd>
              </dd>
            </div>
          </dl>
        </div>
        <SnakePad onDirection={steer} disabled={phase === 'ended'} />
        <p className={styles.touchHint}>
          Geser arena atau gunakan tombol arah.
        </p>
        {!challenge && (
          <div className='max-md:text-center'>
            <Link
              href='/games/leaderboard?game=snake'
              className={styles.ranking}
            >
              Papan peringkat
              <ArrowUpRight size={15} aria-hidden='true' />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
