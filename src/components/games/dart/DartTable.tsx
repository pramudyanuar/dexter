'use client';

import * as React from 'react';

import { CRICKET, DARTS_PER_TURN, DartView, Throw } from '@/lib/games/dart';
import type { DartMode } from '@/lib/games/dart-config';
import { MODE_INFO } from '@/lib/games/dart-config';
import type { RoomView } from '@/lib/rooms/types';
import type { useRoom } from '@/lib/rooms/useRoom';

import Confetti from '@/components/games/Confetti';
import Dartboard from '@/components/games/dart/Dartboard';
import PowerMeter from '@/components/games/dart/PowerMeter';
import { seatName } from '@/components/games/lang';
import { seatColor } from '@/components/games/sekata/labels';
import useSfx from '@/components/games/sekata/useSfx';

type Api = ReturnType<typeof useRoom>;

const mmss = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/** How far a shaky hand drifts, by difficulty (board units). */
const SWAY = { easy: 0.012, normal: 0.022, hard: 0.04 } as const;

function useClock(active: boolean) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

function Avatar({ seat, name }: { seat: number; name: string }) {
  return (
    <span
      aria-hidden
      className='flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-[#17181c] uppercase'
      style={{ background: seatColor(seat) }}
    >
      {name.charAt(0)}
    </span>
  );
}

/** Dart chips: what each dart scored. */
function Darts({ throws, total }: { throws: Throw[]; total?: boolean }) {
  return (
    <span className='flex items-center gap-1'>
      {Array.from({ length: DARTS_PER_TURN }, (_, i) => {
        const t = throws[i];
        return (
          <span
            key={i}
            className={`flex h-6 min-w-8 items-center justify-center rounded-md px-1.5 text-xs font-bold tabular-nums ${
              t
                ? t.note === 'bust'
                  ? 'bg-err/20 text-err line-through'
                  : t.ring === 'triple' || t.ring === 'ibull'
                    ? 'bg-[#e8b923]/25 text-[#e8b923]'
                    : t.ring === 'double'
                      ? 'bg-[#2fa860]/25 text-[#4fd184]'
                      : t.points === 0
                        ? 'bg-card text-[var(--mute)]'
                        : 'bg-card text-ink'
                : 'border border-dashed border-line text-[var(--mute)]'
            }`}
          >
            {t ? t.label : '·'}
          </span>
        );
      })}
      {total && (
        <span className='ml-1 text-xs text-[var(--mute)]'>
          = {throws.reduce((a, t) => a + t.counted, 0)}
        </span>
      )}
    </span>
  );
}

const MARK = ['', '/', '✕', '⊗'];

/** The cricket sheet: marks on each target, for every player. */
function CricketSheet({
  view,
  names,
  you,
}: {
  view: DartView;
  names: (string | null)[];
  you: number;
}) {
  const seats = Array.from({ length: view.players }, (_, i) => i).filter(
    (i) => !view.dropped.includes(i),
  );
  return (
    <table className='w-full text-center text-sm' aria-label='Cricket marks'>
      <thead>
        <tr className='text-[11px] text-[var(--mute)]'>
          <th className='py-1 text-left font-medium'>Target</th>
          {seats.map((s) => (
            <th key={s} className='max-w-16 truncate font-medium'>
              {seatName('en', s, you, names)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {CRICKET.map((n, i) => (
          <tr key={n} className='border-t border-line'>
            <td className='py-1 text-left font-bold'>
              {n === 25 ? 'Bull' : n}
            </td>
            {seats.map((s) => {
              const m = Math.min(3, view.marks[s][i]);
              return (
                <td
                  key={s}
                  className={`text-lg font-black ${m >= 3 ? 'text-[#4fd184]' : 'text-ink'}`}
                  aria-label={`${m} marks`}
                >
                  {MARK[m] || <span className='text-line-strong'>·</span>}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function main(view: DartView, seat: number): { big: string; small: string } {
  const mode = view.config.mode as DartMode;
  const s = view.scores[seat];
  if (mode === '301' || mode === '501')
    return { big: String(s), small: 'left' };
  if (mode === 'countup') return { big: String(s), small: 'points' };
  if (mode === 'clock')
    return { big: s > 20 ? 'Bull' : String(s), small: 'target' };
  return { big: String(s), small: 'points' };
}

export default function DartTable({ r, view }: { r: Api; view: DartView }) {
  const room = r.room as RoomView;
  const you = r.session!.you;
  const names = room.names;
  const cfg = view.config;
  const sfx = useSfx();
  const skill = cfg.throwMode === 'skill';
  const myTurn = view.turn === you && !view.over;
  const canAim = myTurn && !view.turnDone;
  const nameOf = (s: number) => seatName('en', s, you, names);
  const turnName = nameOf(view.turn);

  // ------------------------------------------------------------- aiming
  const [aim, setAim] = React.useState<{ x: number; y: number } | null>(null);
  const [swayed, setSwayed] = React.useState<{ x: number; y: number } | null>(
    null,
  );
  /** Where a dart would go right now: the aim, plus the shake in Skill mode */
  const effRef = React.useRef<{ x: number; y: number } | null>(null);
  const powerRef = React.useRef(0.5);

  const swaying = skill && canAim && !!aim;
  React.useEffect(() => {
    if (!swaying || !aim) {
      effRef.current = aim;
      return;
    }
    const amp = SWAY[cfg.difficulty];
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = (now - t0) / 1000;
      const p = {
        x: aim.x + Math.sin(t * 2.3) * amp + Math.sin(t * 5.1) * amp * 0.4,
        y: aim.y + Math.cos(t * 1.9) * amp + Math.cos(t * 4.3) * amp * 0.4,
      };
      effRef.current = p;
      setSwayed(p);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [swaying, aim, cfg.difficulty]);

  const shown = swaying ? (swayed ?? aim) : aim;
  const canThrow = canAim && !r.busy && !!aim;

  const throwDart = (at?: { x: number; y: number }) => {
    if (!canAim || r.busy) return;
    const target = at ?? effRef.current ?? aim;
    if (!target) return;
    void r.move({
      type: 'throw',
      x: target.x,
      y: target.y,
      power: skill ? powerRef.current : undefined,
    });
  };

  // sounds for what lands
  const heard = React.useRef(view.seq);
  const { play } = sfx;
  React.useEffect(() => {
    if (view.seq > heard.current) {
      const t =
        view.throws[view.throws.length - 1] ??
        view.history.at(-1)?.throws.at(-1);
      if (t) play(t.points === 0 ? 'bad' : t.points >= 40 ? 'ok' : 'tap');
      heard.current = view.seq;
    }
  }, [view.seq, view.throws, view.history, play]);
  const won = React.useRef(view.over);
  React.useEffect(() => {
    if (view.over && !won.current) play(view.winner === you ? 'win' : 'bad');
    won.current = view.over;
  }, [view.over, view.winner, you, play]);

  // ------------------------------------------------------------- clock
  const now = useClock(!view.over);
  const sinceReceived = Math.max(0, Math.floor((now - r.receivedAt) / 1000));
  const elapsed = view.elapsed + (view.over ? 0 : sinceReceived);

  const seats = Array.from({ length: view.players }, (_, i) => i);
  const rounds = cfg.mode === 'countup' ? cfg.rounds : cfg.maxRounds || null;
  const lastTurnOf = (s: number) =>
    [...view.history].reverse().find((h) => h.seat === s);
  const info = MODE_INFO[cfg.mode];
  const recent = [...view.history].reverse().slice(0, 8);
  const turnKey = `${view.round}-${view.turn}`;
  const banner = view.turnDone
    ? view.turnResult === 'bust'
      ? { text: 'BUST!', tone: 'bg-err text-white' }
      : view.turnResult === 'win'
        ? { text: 'GAME SHOT!', tone: 'bg-[#e8b923] text-[#2a1f00]' }
        : null
    : null;

  return (
    <div className='mx-auto w-full max-w-6xl'>
      {view.over && view.winner === you && <Confetti count={60} />}

      {/* ----------------------------------------------------- top bar */}
      <div className='mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border border-line bg-surface/60 px-4 py-2.5 text-sm'>
        <span className='flex items-center gap-2'>
          <span className='text-lg font-black tracking-[0.15em] text-[#e0b84c]'>
            DART
          </span>
          <span className='rounded-full bg-card px-2.5 py-0.5 text-xs'>
            {info.title}
          </span>
          <span className='rounded-full bg-card px-2.5 py-0.5 text-xs text-[var(--mute)]'>
            {skill ? 'Skill' : 'Casual'}
          </span>
        </span>
        <span className='flex items-center gap-4 text-xs text-[var(--mute)]'>
          <span data-testid='round'>
            Round {Math.min(view.round, rounds ?? view.round)}
            {rounds ? ` / ${rounds}` : ''}
          </span>
          <span data-testid='current-player' className='font-semibold text-ink'>
            {view.over ? 'Match over' : `${turnName}${myTurn ? '' : ' is up'}`}
          </span>
          <span data-testid='match-clock' className='tabular-nums'>
            ⏱ {mmss(elapsed)}
          </span>
          <button
            type='button'
            onClick={sfx.toggle}
            aria-pressed={sfx.muted}
            aria-label={sfx.muted ? 'Unmute sound' : 'Mute sound'}
            className='hover:text-ink'
          >
            {sfx.muted ? '🔇' : '🔊'}
          </button>
        </span>
      </div>

      <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]'>
        {/* --------------------------------------------------- the board */}
        <section
          aria-label='Dartboard'
          className='rounded-[1.75rem] border border-[#5a3a1e] bg-[radial-gradient(ellipse_at_center,#223048,#10151f_75%)] p-3 shadow-[inset_0_0_80px_rgb(0_0_0/0.45)]'
        >
          <div
            tabIndex={canAim ? 0 : -1}
            className='relative rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#e0b84c]'
            onKeyDown={(e) => {
              if (!canAim) return;
              const step = e.shiftKey ? 0.08 : 0.025;
              const cur = aim ?? { x: 0, y: 0 };
              const moves: Record<string, [number, number]> = {
                ArrowLeft: [-step, 0],
                ArrowRight: [step, 0],
                ArrowUp: [0, -step],
                ArrowDown: [0, step],
              };
              if (moves[e.key]) {
                e.preventDefault();
                setAim({
                  x: cur.x + moves[e.key][0],
                  y: cur.y + moves[e.key][1],
                });
              } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (aim) throwDart();
              }
            }}
          >
            <Dartboard
              throws={view.throws}
              color={seatColor(view.turn)}
              aim={shown}
              active={canAim}
              skill={skill}
              label={`Dartboard. ${view.throws.length} darts thrown this turn.`}
              onAim={(x, y, touch) => setAim({ x, y: touch ? y - 0.16 : y })}
              onPick={(x, y) => {
                setAim({ x, y });
                // a click throws at the crosshair, shake and all
                throwDart(swaying ? (effRef.current ?? { x, y }) : { x, y });
              }}
            />

            {/* whose turn it is: slides in, then gets out of the way */}
            {!view.over && (
              <p
                key={turnKey}
                aria-hidden
                className='a-turn pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-4 py-1.5 text-sm font-bold whitespace-nowrap text-white'
              >
                {myTurn ? 'Your turn' : `${turnName}'s turn`}
              </p>
            )}
            {banner && (
              <p
                role='status'
                className={`a-pop absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl px-8 py-3 text-3xl font-black tracking-widest shadow-2xl ${banner.tone}`}
              >
                {banner.text}
              </p>
            )}
          </div>

          {/* controls */}
          <div className='mt-3 space-y-3'>
            {skill && canAim && <PowerMeter valueRef={powerRef} running />}

            <div className='flex flex-wrap items-center justify-center gap-2'>
              {canAim && (
                <>
                  <button
                    type='button'
                    onClick={() => throwDart()}
                    disabled={!canThrow}
                    className='rounded-full bg-[#e0b84c] px-9 py-2.5 text-sm font-black tracking-wider text-[#2a1f00] shadow-[0_3px_0_#9c7d2e] transition-[transform,box-shadow] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-40 disabled:shadow-none'
                  >
                    THROW
                  </button>
                  <button
                    type='button'
                    onClick={() => setAim(null)}
                    disabled={!aim}
                    className='rounded-full border-2 border-line-strong px-5 py-2.5 text-sm font-semibold text-[var(--mute)] hover:border-[var(--mute)] disabled:opacity-40'
                  >
                    Reset aim
                  </button>
                </>
              )}
              {myTurn && view.turnDone && (
                <button
                  type='button'
                  onClick={() => {
                    setAim(null);
                    void r.move({ type: 'next' });
                  }}
                  disabled={r.busy}
                  className='a-bob rounded-full bg-[#e0b84c] px-9 py-2.5 text-sm font-black tracking-wider text-[#2a1f00] shadow-[0_3px_0_#9c7d2e] disabled:opacity-50'
                >
                  END TURN
                </button>
              )}
              {!myTurn && !view.over && (
                <p className='text-sm text-[var(--mute)]' aria-live='polite'>
                  Waiting for {turnName}…
                </p>
              )}
            </div>
            {canAim && (
              <p className='text-center text-xs text-[var(--mute)]'>
                {skill
                  ? 'Aim, then throw with good timing. Your hand shakes.'
                  : 'Aim with the mouse or your finger, click or tap THROW.'}{' '}
                Arrow keys move the aim, Enter throws.
              </p>
            )}
            {view.checkout && myTurn && (
              <p className='text-center text-sm' data-testid='checkout'>
                <span className='text-[var(--mute)]'>Checkout: </span>
                <b className='text-[#4fd184]'>{view.checkout.join(' · ')}</b>
              </p>
            )}
            {r.error && !view.over && (
              <p className='text-center text-sm text-err' role='alert'>
                {r.error}
              </p>
            )}
          </div>
        </section>

        {/* ---------------------------------------------------- scoreboard */}
        <aside aria-label='Scoreboard' className='space-y-3'>
          <ul className='space-y-2'>
            {seats.map((s) => {
              const gone = view.dropped.includes(s);
              const m = main(view, s);
              const turn = view.turn === s && !view.over;
              const shownThrows = turn
                ? view.throws
                : (lastTurnOf(s)?.throws ?? []);
              const st = view.stats[s];
              const avg = st.darts
                ? ((st.points / st.darts) * 3).toFixed(1)
                : '–';
              return (
                <li
                  key={s}
                  data-seat={s}
                  data-current={turn}
                  className={`rounded-2xl border px-3 py-2.5 transition-colors ${
                    turn
                      ? 'border-[#e0b84c] bg-[#e0b84c]/10'
                      : 'border-line bg-surface/50'
                  } ${gone ? 'opacity-40' : ''}`}
                >
                  <div className='flex items-center gap-3'>
                    <Avatar seat={s} name={names[s] || 'P'} />
                    <span className='min-w-0 flex-1'>
                      <span className='block truncate text-sm font-semibold'>
                        {nameOf(s)}
                        {turn && (
                          <span className='ml-2 rounded-full bg-[#e0b84c] px-2 py-0.5 text-[10px] font-bold text-[#2a1f00] uppercase'>
                            throwing
                          </span>
                        )}
                        {gone && (
                          <span className='ml-2 text-xs text-err'>left</span>
                        )}
                      </span>
                      <span className='text-[11px] text-[var(--mute)]'>
                        {cfg.mode === 'cricket' || cfg.mode === 'clock'
                          ? `${st.darts} darts`
                          : `avg ${avg} · ${st.darts} darts`}
                      </span>
                    </span>
                    <span className='text-right'>
                      <span
                        className='block text-3xl leading-none font-black tabular-nums'
                        data-testid={`score-${s}`}
                      >
                        {m.big}
                      </span>
                      <span className='text-[10px] tracking-wide text-[var(--mute)] uppercase'>
                        {m.small}
                      </span>
                    </span>
                  </div>
                  <div className='mt-2'>
                    <Darts
                      throws={shownThrows}
                      total={turn || shownThrows.length > 0}
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          {cfg.mode === 'cricket' && (
            <div className='rounded-2xl border border-line bg-surface/50 px-3 py-2'>
              <CricketSheet view={view} names={names} you={you} />
            </div>
          )}

          <section
            aria-label='Previous rounds'
            className='rounded-2xl border border-line bg-surface/50 px-3 py-2'
          >
            <h2 className='mb-1 text-xs font-semibold tracking-wide text-[var(--mute)] uppercase'>
              Previous rounds
            </h2>
            {recent.length === 0 && (
              <p className='py-2 text-xs text-[var(--mute)]'>
                Nothing thrown yet.
              </p>
            )}
            <ul className='space-y-1'>
              {recent.map((h, i) => (
                <li key={i} className='flex items-center gap-2 text-xs'>
                  <span className='w-6 text-[var(--mute)]'>R{h.round}</span>
                  <span className='w-16 truncate'>{nameOf(h.seat)}</span>
                  <Darts throws={h.throws} />
                  <span
                    className={`ml-auto font-bold tabular-nums ${
                      h.result === 'bust'
                        ? 'text-err'
                        : h.result === 'win'
                          ? 'text-[#e8b923]'
                          : ''
                    }`}
                  >
                    {h.result === 'bust' ? 'BUST' : h.total}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      {view.over && <Results r={r} view={view} />}
    </div>
  );
}

function Results({ r, view }: { r: Api; view: DartView }) {
  const room = r.room as RoomView;
  const you = r.session!.you;
  const name = (s: number) => seatName('en', s, you, room.names);
  const cfg = view.config;
  const medal = ['🥇', '🥈', '🥉'];
  const why = {
    checkout: 'Checked out!',
    finished: 'All targets done!',
    rounds: 'Rounds complete.',
    left: 'The other players left.',
  } as const;
  return (
    <div
      role='dialog'
      aria-label='Match result'
      className='fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm'
    >
      <div className='a-pop my-auto w-full max-w-md rounded-3xl border border-[#e0b84c]/50 bg-card p-6 shadow-2xl'>
        <p className='text-center text-xs font-bold tracking-widest text-[#e0b84c] uppercase'>
          {view.endReason ? why[view.endReason] : 'Match over'}
        </p>
        <h2 className='mt-1 text-center text-3xl font-black'>
          {view.tie.length > 1
            ? 'It is a tie'
            : view.winner === you
              ? 'You win!'
              : view.winner !== null
                ? `${name(view.winner)} wins`
                : 'Match over'}
        </h2>
        <p className='mt-1 text-center text-xs text-[var(--mute)]'>
          {MODE_INFO[cfg.mode].title} ·{' '}
          {cfg.throwMode === 'skill' ? 'Skill' : 'Casual'} ·{' '}
          {mmss(view.elapsed)} · {view.round} rounds
        </p>
        <table className='mt-4 w-full text-sm'>
          <thead>
            <tr className='text-left text-[11px] tracking-wide text-[var(--mute)] uppercase'>
              <th className='py-1'>#</th>
              <th>Player</th>
              <th className='text-right'>Score</th>
              <th className='text-right'>Darts</th>
              <th className='text-right'>Avg</th>
              <th className='text-right'>Best</th>
            </tr>
          </thead>
          <tbody>
            {view.ranking.map((s, i) => {
              const st = view.stats[s];
              return (
                <tr
                  key={s}
                  className={`border-t border-line ${s === you ? 'font-bold' : ''}`}
                >
                  <td className='py-1.5'>{medal[i] ?? i + 1}</td>
                  <td className='max-w-24 truncate'>{name(s)}</td>
                  <td className='text-right tabular-nums'>
                    {main(view, s).big}
                  </td>
                  <td className='text-right tabular-nums'>{st.darts}</td>
                  <td className='text-right tabular-nums'>
                    {st.darts ? ((st.points / st.darts) * 3).toFixed(1) : '–'}
                  </td>
                  <td className='text-right tabular-nums'>{st.bestTurn}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className='mt-5 flex flex-wrap justify-center gap-2'>
          <button
            type='button'
            onClick={r.rematch}
            disabled={r.busy}
            className='rounded-full bg-[#e0b84c] px-6 py-2.5 text-sm font-black text-[#2a1f00] shadow-[0_3px_0_#9c7d2e] disabled:opacity-50'
          >
            Play Again
          </button>
          <button
            type='button'
            onClick={r.leave}
            className='rounded-full border-2 border-line-strong px-5 py-2.5 text-sm font-semibold'
          >
            Back to lobby
          </button>
          <a
            href='/games'
            className='rounded-full border-2 border-line-strong px-5 py-2.5 text-sm font-semibold'
          >
            Exit game
          </a>
        </div>
      </div>
    </div>
  );
}
