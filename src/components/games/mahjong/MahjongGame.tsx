'use client';

import Link from 'next/link';
import * as React from 'react';

import {
  accuracy,
  DIFFICULTIES,
  DIFFICULTY,
  Difficulty,
  hasMoves,
  hint,
  isFree,
  MahjongState,
  newGame,
  pairsLeft,
  pick,
  rulesFor,
  shuffleTiles,
  undo,
} from '@/lib/games/mahjong';
import {
  extent,
  LAYOUT_IDS,
  LAYOUT_NAMES,
  LayoutId,
  layoutPositions,
  Pos,
} from '@/lib/games/mahjong-layouts';
import { nameOf } from '@/lib/games/mahjong-tiles';
import useMounted from '@/lib/useMounted';
import useStoredState from '@/lib/useStoredState';

import Confetti from '@/components/games/Confetti';
import GameShell from '@/components/games/GameShell';
import CustomEditor from '@/components/games/mahjong/CustomEditor';
import TileFace from '@/components/games/mahjong/TileFace';
import useStopwatch from '@/components/games/mahjong/useStopwatch';
import useSfx from '@/components/games/sekata/useSfx';

type Best = Record<string, { score: number; time: number }>;
interface Config {
  layout: LayoutId;
  difficulty: Difficulty;
}

const NO_BEST: Best = {};
const DEFAULT_CONFIG: Config = { layout: 'turtle', difficulty: 'medium' };
const NO_CUSTOM: Pos[] = [];

const mmss = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const DIFF_INFO: Record<Difficulty, { title: string; blurb: string }> = {
  easy: {
    title: 'Easy',
    blurb:
      'Simple layouts, matching tiles lie close together, plenty of hints and shuffles.',
  },
  medium: {
    title: 'Medium',
    blurb: 'Classic Turtle and the standard rules.',
  },
  hard: {
    title: 'Hard',
    blurb:
      'Complex layouts, matching tiles are spread out, few hints, one shuffle, limited undo.',
  },
};

/** A small drawing of a layout, for choosing one. */
function Preview({ id, custom }: { id: LayoutId; custom: Pos[] }) {
  const pos = layoutPositions(id, custom);
  if (pos.length === 0) {
    return (
      <div className='flex h-full items-center justify-center text-xs text-[var(--mute)]'>
        Draw your own
      </div>
    );
  }
  const e = extent(pos);
  const w = e.maxX - e.minX;
  const h = e.maxY - e.minY;
  return (
    <svg
      viewBox={`${-1} ${-1} ${w + 3} ${h + 3}`}
      className='size-full'
      aria-hidden
    >
      {[...pos]
        .sort((a, b) => a.z - b.z)
        .map((p, i) => (
          <rect
            key={i}
            x={p.x - e.minX - p.z * 0.35}
            y={p.y - e.minY - p.z * 0.35}
            width='1.9'
            height='1.9'
            rx='0.35'
            fill={
              ['#efe6cc', '#e6d9b4', '#dcc98f', '#d2ba70', '#c8ab52'][p.z % 5]
            }
            stroke='#1f5a40'
            strokeWidth='0.25'
          />
        ))}
    </svg>
  );
}

/** Measures an element's width as soon as it exists, and keeps measuring. */
function useWidth() {
  const [el, setEl] = React.useState<HTMLDivElement | null>(null);
  const [width, setWidth] = React.useState(0);
  React.useEffect(() => {
    if (!el) return;
    const read = () => setWidth(el.clientWidth);
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, width] as const;
}

function Mahjong() {
  const sfx = useSfx();
  const [config, setConfig] = useStoredState<Config>(
    'mahjong-config',
    DEFAULT_CONFIG,
  );
  const [custom, setCustom] = useStoredState<Pos[]>(
    'mahjong-custom',
    NO_CUSTOM,
  );
  const [best, setBest] = useStoredState<Best>('mahjong-best', NO_BEST);
  // a game in progress belongs to this tab, and survives a reload
  const [game, setGame] = useStoredState<MahjongState | null>(
    'mahjong-game',
    null,
    'tab',
  );
  // handlers read the newest game, so two quick taps never act on a stale one
  const latest = React.useRef<MahjongState | null>(game);
  React.useEffect(() => {
    latest.current = game;
  }, [game]);
  const commit = (next: MahjongState | null) => {
    latest.current = next;
    setGame(next);
  };
  const [paused, setPaused] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [notice, setNotice] = React.useState<{
    text: string;
    tone: string;
  } | null>(null);
  /** Tiles that just left, kept on screen while they fade out */
  const [leaving, setLeaving] = React.useState<number[]>([]);
  const [result, setResult] = React.useState<{
    best: boolean;
    time: number;
  } | null>(null);
  const [boxRef, boxWidth] = useWidth();

  // the clock: stored time plus what has run since the last move
  const running = !!game && game.status !== 'won' && !paused;
  const clock = useStopwatch(game?.elapsed ?? 0, running);
  const elapsed = game ? clock.elapsed : 0;
  const stamp = clock.stamp;

  const say = (text: string, tone = 'text-[var(--mute)]') =>
    setNotice({ text, tone });

  const start = (cfg: Config = config) => {
    try {
      const g = newGame(cfg.layout, cfg.difficulty, undefined, { custom });
      clock.restart();
      commit(g);
      setPaused(false);
      setResult(null);
      setNotice(null);
      setLeaving([]);
    } catch {
      say('That layout cannot be dealt. Try another.', 'text-err');
    }
  };

  const finish = (g: MahjongState) => {
    const key = `${g.layout}:${g.difficulty}`;
    const prev = best[key];
    const isBest = !prev || g.score > prev.score;
    if (isBest || g.elapsed < (prev?.time ?? Infinity)) {
      setBest({
        ...best,
        [key]: {
          score: Math.max(g.score, prev?.score ?? 0),
          time: Math.min(g.elapsed, prev?.time ?? Infinity),
        },
      });
    }
    setResult({ best: isBest, time: g.elapsed });
    sfx.play('win');
  };

  const onTile = (i: number) => {
    const cur = latest.current;
    if (!cur || paused || cur.status === 'won') return;
    const { state, result: r } = pick(cur, i, stamp());
    commit(state);
    if (r === 'matched') {
      const last = state.history[state.history.length - 1];
      setLeaving([last.a, last.b]);
      setTimeout(() => setLeaving([]), 420);
      sfx.play('ok');
      if (state.status === 'won') {
        say('Board cleared!', 'text-accent');
        finish(state);
      } else if (state.status === 'stuck') {
        say('No more matching pairs.', 'text-err');
        sfx.play('bad');
      } else {
        say(
          state.streak > 0 ? `Match! ${state.streak + 1} in a row` : 'Match!',
          'text-accent',
        );
      }
    } else if (r === 'mismatch') {
      say('Not a match', 'text-err');
      sfx.play('bad');
    } else if (r === 'blocked') {
      say('That tile is blocked', 'text-hash');
      sfx.play('bad');
    } else if (r === 'selected') {
      sfx.play('tap');
    }
  };

  const doUndo = () => {
    const cur = latest.current;
    if (!cur || paused) return;
    const { state, denied } = undo({ ...cur, elapsed: stamp() });
    if (denied === 'limit')
      say('No more undos on this difficulty', 'text-hash');
    else if (denied) say('Nothing to undo');
    else say('Undid the last pair');
    commit(state);
  };
  const doHint = () => {
    const cur = latest.current;
    if (!cur || paused) return;
    const { state, denied } = hint({ ...cur, elapsed: stamp() });
    if (denied === 'limit') say('No hints left', 'text-hash');
    else if (denied === 'none')
      say('No pair to match. Shuffle or undo.', 'text-err');
    else say('Try the highlighted pair (-50)', 'text-hash');
    commit(state);
  };
  const doShuffle = () => {
    const cur = latest.current;
    if (!cur || paused) return;
    const { state, denied } = shuffleTiles({ ...cur, elapsed: stamp() });
    if (denied === 'limit') say('No shuffles left', 'text-hash');
    else if (denied === 'disabled') say('Shuffle is off');
    else {
      say('Tiles shuffled (-100)', 'text-hash');
      sfx.play('tap');
    }
    commit(state);
  };
  const togglePause = () => {
    if (!game || game.status === 'won') return;
    if (!paused) {
      setGame({ ...game, elapsed: stamp() });
      setPaused(true);
    } else {
      clock.restart();
      setPaused(false);
    }
  };

  // ------------------------------------------------------------ setup
  if (editing) {
    return (
      <CustomEditor
        initial={custom}
        onCancel={() => setEditing(false)}
        onPlay={(positions) => {
          setCustom(positions);
          setEditing(false);
          const cfg = { ...config, layout: 'custom' as LayoutId };
          setConfig(cfg);
          // `custom` is read from state on the next render, so deal with it directly
          const g = newGame('custom', cfg.difficulty, undefined, {
            custom: positions,
          });
          clock.restart();
          setGame(g);
          setPaused(false);
          setResult(null);
          setNotice(null);
        }}
      />
    );
  }

  if (!game) {
    const tips = DIFF_INFO[config.difficulty];
    return (
      <div className='mx-auto w-full max-w-2xl'>
        <header className='mb-6 text-center'>
          <h1 className='text-4xl font-black tracking-[0.15em] text-[#d9b45a]'>
            MAHJONG
          </h1>
          <p className='mx-auto mt-2 max-w-md text-sm text-[var(--mute)]'>
            Match identical tiles, clear the board, and challenge your
            puzzle-solving skills.
          </p>
        </header>

        <h2 className='mb-2 text-sm font-semibold'>Layout</h2>
        <ul className='grid grid-cols-2 gap-3 sm:grid-cols-3'>
          {LAYOUT_IDS.map((id) => (
            <li key={id}>
              <button
                type='button'
                aria-pressed={config.layout === id}
                onClick={() => {
                  if (id === 'custom') setEditing(true);
                  else setConfig({ ...config, layout: id });
                }}
                className={`w-full rounded-xl border p-2 text-left transition-colors ${
                  config.layout === id
                    ? 'border-[#d9b45a] bg-[#d9b45a]/10'
                    : 'border-line hover:border-line-strong'
                }`}
              >
                <span className='block h-20 rounded-lg bg-[#16402f] p-2'>
                  <Preview id={id} custom={custom} />
                </span>
                <span className='mt-2 block text-sm font-semibold'>
                  {LAYOUT_NAMES[id]}
                </span>
                <span className='block text-xs text-[var(--mute)]'>
                  {id === 'custom'
                    ? custom.length
                      ? `${custom.length} tiles · tap to edit`
                      : 'Design your own'
                    : `${layoutPositions(id).length} tiles`}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <h2 className='mt-6 mb-2 text-sm font-semibold'>Difficulty</h2>
        <div className='flex gap-2'>
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              type='button'
              aria-pressed={config.difficulty === d}
              onClick={() =>
                setConfig({
                  difficulty: d,
                  // each level suggests its own layout, until you pick one yourself
                  layout:
                    config.layout === DIFFICULTY[config.difficulty].layout
                      ? DIFFICULTY[d].layout
                      : config.layout,
                })
              }
              className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                config.difficulty === d
                  ? 'border-[#d9b45a] bg-[#d9b45a]/10'
                  : 'border-line hover:border-line-strong'
              }`}
            >
              {DIFF_INFO[d].title}
            </button>
          ))}
        </div>
        <p className='mt-2 text-sm text-[var(--mute)]' aria-live='polite'>
          {tips.blurb}
        </p>
        <p className='mt-1 text-xs text-[var(--mute)]'>
          {rulesFor(config.difficulty).hintLimit} hints ·{' '}
          {rulesFor(config.difficulty).shuffleLimit} shuffles ·{' '}
          {rulesFor(config.difficulty).undoLimit >= 99
            ? 'unlimited undo'
            : `${rulesFor(config.difficulty).undoLimit} undos`}
        </p>

        {Object.keys(best).length > 0 && (
          <p className='mt-3 text-xs text-[var(--mute)]'>
            Best here:{' '}
            {best[`${config.layout}:${config.difficulty}`]
              ? `${best[`${config.layout}:${config.difficulty}`].score} points · ${mmss(best[`${config.layout}:${config.difficulty}`].time)}`
              : 'none yet'}
          </p>
        )}

        {notice && (
          <p className={`mt-3 text-sm ${notice.tone}`} role='alert'>
            {notice.text}
          </p>
        )}

        <div className='mt-6 flex justify-center'>
          <button
            type='button'
            onClick={() => start()}
            className='rounded-full bg-[#d9b45a] px-10 py-3 text-base font-black tracking-wider text-[#2b2208] shadow-[0_4px_0_#9c7d2e] transition-[transform,box-shadow] hover:-translate-y-0.5 active:translate-y-1 active:shadow-none'
          >
            PLAY
          </button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------- board
  const pos = game.tiles;
  const e = extent(pos);
  const units = e.maxX - e.minX;
  const W = Math.max(
    24,
    Math.min(58, Math.floor(((boxWidth || 640) - 36) / (units / 2) / 1.04)),
  );
  const H = Math.round((W * 4) / 3);
  const dz = Math.max(2, Math.round(W * 0.085));
  const boardW = (units * W) / 2 + e.layers * dz;
  const boardH = ((e.maxY - e.minY) * H) / 2 + e.layers * dz;
  const left = pairsLeft(game);
  const bestHere = best[`${game.layout}:${game.difficulty}`];
  const visible = game.tiles.filter(
    (t) => !t.removed || leaving.includes(t.id),
  );
  const hinted: number[] = game.hint ?? [];
  const stuck = game.status === 'stuck';
  const hintsLeft = Math.max(0, game.rules.hintLimit - game.hints);
  const shufflesLeft = Math.max(0, game.rules.shuffleLimit - game.shuffles);
  const canMove = hasMoves(game.tiles, game.rules);

  const btn =
    'rounded-full border-2 border-line-strong px-4 py-2 text-sm font-semibold transition-colors hover:border-[#d9b45a] hover:text-[#d9b45a] disabled:opacity-40 disabled:hover:border-line-strong disabled:hover:text-inherit';

  return (
    <div className='mx-auto w-full max-w-4xl'>
      {game.status === 'won' && <Confetti count={60} />}

      <div className='mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border border-line bg-surface/60 px-4 py-2.5'>
        <span className='flex items-center gap-2'>
          <span className='text-lg font-black tracking-[0.15em] text-[#d9b45a]'>
            MAHJONG
          </span>
          <span className='rounded-full bg-card px-2.5 py-0.5 text-xs'>
            {LAYOUT_NAMES[game.layout]} · {DIFF_INFO[game.difficulty].title}
          </span>
        </span>
        <span className='flex items-center gap-5 text-sm'>
          <span data-testid='clock' className='font-semibold tabular-nums'>
            ⏱ {mmss(elapsed)}
          </span>
          <span
            data-testid='score'
            className='font-semibold text-[#d9b45a] tabular-nums'
          >
            {game.score} pts
          </span>
          <span data-testid='pairs' className='text-[var(--mute)]'>
            {left} pairs left
          </span>
          <button
            type='button'
            onClick={togglePause}
            disabled={game.status === 'won'}
            className='rounded-full border border-line-strong px-3 py-1 text-xs font-semibold hover:border-[#d9b45a] disabled:opacity-40'
          >
            {paused ? 'Resume' : 'Pause'}
          </button>
        </span>
      </div>

      {/* the board: jade felt, ivory tiles with a jade edge */}
      <div
        ref={boxRef}
        className='relative overflow-hidden rounded-[1.75rem] border border-[#d9b45a]/40 bg-[radial-gradient(ellipse_at_center,#1d5a42,#123b2b_70%)] p-4 shadow-[inset_0_0_60px_rgb(0_0_0/0.35)]'
      >
        <div
          aria-hidden
          className='pointer-events-none absolute inset-2 rounded-[1.4rem] border border-[#d9b45a]/25'
        />
        <div
          data-testid='board'
          className='relative mx-auto'
          style={{ width: boardW, height: boardH }}
        >
          {visible.map((t) => {
            const free = !t.removed && isFree(game.tiles, t.id);
            const selected = game.selected === t.id;
            const isHint = hinted.includes(t.id);
            const wrong = game.mismatch?.includes(t.id);
            return (
              <button
                key={t.id}
                type='button'
                data-tile={t.id}
                data-kind={t.kind}
                data-free={free ? 'true' : 'false'}
                aria-label={`${nameOf(t.kind)}${free ? '' : ', blocked'}`}
                aria-pressed={selected}
                disabled={t.removed || paused}
                onClick={() => onTile(t.id)}
                className={`mj-tile absolute rounded-[7px] border border-[#cdbf94] p-[3px] ${
                  t.removed ? 'a-mj-out pointer-events-none' : ''
                } ${selected ? 'mj-selected' : ''} ${isHint ? 'a-mj-hint' : ''} ${
                  wrong ? 'a-mj-shake' : ''
                } ${free || t.removed ? '' : 'mj-blocked'}`}
                style={{
                  width: W,
                  height: H,
                  left: ((t.x - e.minX) * W) / 2 + (e.layers - 1 - t.z) * dz,
                  top: ((t.y - e.minY) * H) / 2 + (e.layers - 1 - t.z) * dz,
                  zIndex: t.z * 1000 + t.y * 10 + (t.x >> 1),
                  ['--edge' as string]: `${Math.max(2, Math.round(W * 0.06))}px`,
                }}
              >
                <TileFace kind={t.kind} />
              </button>
            );
          })}

          {paused && (
            <div
              className='absolute inset-0 z-[9000] flex flex-col items-center justify-center gap-3 rounded-2xl bg-[#0f2f23]/95 text-center'
              role='dialog'
              aria-label='Paused'
            >
              <p className='text-2xl font-black tracking-widest text-[#d9b45a]'>
                PAUSED
              </p>
              <button
                type='button'
                onClick={togglePause}
                className='rounded-full bg-[#d9b45a] px-8 py-2.5 font-black text-[#2b2208] shadow-[0_3px_0_#9c7d2e]'
              >
                Resume
              </button>
            </div>
          )}
        </div>
      </div>

      <p
        className={`mt-3 min-h-6 text-center text-sm ${notice?.tone ?? ''}`}
        role='status'
        aria-live='polite'
        data-testid='notice'
      >
        {stuck && !paused
          ? shufflesLeft > 0 && game.rules.shuffleEnabled
            ? 'No more pairs. Shuffle the tiles to keep going.'
            : 'No more pairs, and no shuffles left. Undo or restart.'
          : notice?.text}
      </p>

      <div className='mt-2 flex flex-wrap justify-center gap-2'>
        <button
          type='button'
          className={btn}
          onClick={doUndo}
          disabled={
            paused || game.history.length === 0 || game.status === 'won'
          }
        >
          Undo
        </button>
        <button
          type='button'
          className={btn}
          onClick={doHint}
          disabled={paused || game.status === 'won'}
        >
          Hint <span className='text-xs text-[var(--mute)]'>({hintsLeft})</span>
        </button>
        <button
          type='button'
          className={`${btn} ${stuck && shufflesLeft > 0 ? 'a-bob border-[#d9b45a] text-[#d9b45a]' : ''}`}
          onClick={doShuffle}
          disabled={
            paused || game.status === 'won' || !game.rules.shuffleEnabled
          }
        >
          Shuffle{' '}
          <span className='text-xs text-[var(--mute)]'>({shufflesLeft})</span>
        </button>
        <button
          type='button'
          className={btn}
          onClick={() =>
            start({ layout: game.layout, difficulty: game.difficulty })
          }
        >
          Restart
        </button>
        <button
          type='button'
          className={btn}
          onClick={() => {
            setGame(null);
            setNotice(null);
            setResult(null);
          }}
        >
          Layouts
        </button>
      </div>

      <p className='mt-3 text-center text-xs text-[var(--mute)]'>
        {game.moves} moves · {accuracyText(game)} accuracy · {game.hints} hints
        · {game.shuffles} shuffles
        {bestHere ? ` · best ${bestHere.score}` : ''}
        {!canMove && game.status === 'playing' ? ' · no moves' : ''}
      </p>

      {game.status === 'won' && result && (
        <div
          role='dialog'
          aria-label='Board cleared'
          className='fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm'
        >
          <div className='a-pop my-auto w-full max-w-sm rounded-3xl border border-[#d9b45a]/50 bg-card p-6 text-center shadow-2xl'>
            <p className='text-xs font-bold tracking-widest text-[#d9b45a] uppercase'>
              Congratulations
            </p>
            <h2 className='mt-1 text-3xl font-black'>Board cleared!</h2>
            {result.best && (
              <p className='mt-1 text-sm font-semibold text-accent'>
                New best score!
              </p>
            )}
            <dl className='mt-4 grid grid-cols-2 gap-3 text-left text-sm'>
              {[
                ['Final score', String(game.score)],
                ['Time', mmss(game.elapsed)],
                ['Total moves', String(game.moves)],
                ['Accuracy', accuracyText(game)],
                ['Hints used', String(game.hints)],
                ['Shuffles', String(game.shuffles)],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className='rounded-xl border border-line bg-surface/50 px-3 py-2'
                >
                  <dt className='text-xs text-[var(--mute)]'>{k}</dt>
                  <dd className='text-lg font-bold tabular-nums'>{v}</dd>
                </div>
              ))}
            </dl>
            {bestHere && (
              <p className='mt-3 text-xs text-[var(--mute)]'>
                Best on {LAYOUT_NAMES[game.layout]}: {bestHere.score} pts ·{' '}
                {mmss(bestHere.time)}
              </p>
            )}
            <div className='mt-5 flex flex-wrap justify-center gap-2'>
              <button
                type='button'
                onClick={() =>
                  start({ layout: game.layout, difficulty: game.difficulty })
                }
                className='rounded-full bg-[#d9b45a] px-6 py-2.5 text-sm font-black text-[#2b2208] shadow-[0_3px_0_#9c7d2e]'
              >
                Play Again
              </button>
              <button
                type='button'
                onClick={() => {
                  setGame(null);
                  setResult(null);
                }}
                className='rounded-full border-2 border-line-strong px-5 py-2.5 text-sm font-semibold'
              >
                Change Layout
              </button>
              <Link
                href='/games'
                className='rounded-full border-2 border-line-strong px-5 py-2.5 text-sm font-semibold'
              >
                Game Lobby
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const accuracyText = (g: MahjongState) => `${Math.round(accuracy(g) * 100)}%`;

export default function MahjongGame() {
  const mounted = useMounted();
  return (
    <GameShell name='mahjong' xwide>
      {mounted ? <Mahjong /> : null}
    </GameShell>
  );
}
