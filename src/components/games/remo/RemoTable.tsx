'use client';

import * as React from 'react';

import type { Meld, RemoView } from '@/lib/games/remo';
import {
  byRank,
  bySuit,
  isJoker,
  label,
  penalty,
} from '@/lib/games/remo-cards';
import { MODE_INFO } from '@/lib/games/remo-config';
import {
  Kind,
  meldValue,
  Piece,
  Rep,
  resolveAll,
  Resolved,
} from '@/lib/games/remo-melds';
import type { RoomView } from '@/lib/rooms/types';
import type { useRoom } from '@/lib/rooms/useRoom';

import Confetti from '@/components/games/Confetti';
import { seatName } from '@/components/games/lang';
import PlayingCard, { CardBack } from '@/components/games/remo/PlayingCard';
import { seatColor } from '@/components/games/sekata/labels';

type Api = ReturnType<typeof useRoom>;

const mmss = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/** Keeps the order you arranged your hand in; new cards go on the end. */
function arrange(order: string[], hand: string[]) {
  const held = new Set(hand);
  const kept = order.filter((id) => held.has(id));
  const known = new Set(kept);
  return [...kept, ...hand.filter((id) => !known.has(id))];
}

const repOf = (c: Resolved): Rep => ({ rank: c.rank, suit: c.suit });

/** The cards that are jokers in a reading, and what each stands for. */
const jokersIn = (cards: Resolved[]) =>
  Object.fromEntries(cards.filter((c) => c.joker).map((c) => [c.id, repOf(c)]));

const readingName = (cards: Resolved[]) =>
  cards
    .filter((c) => c.joker)
    .map((c) => label(`${c.suit}${c.rank}`))
    .join(', ');

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

const btn =
  'rounded-full border-2 border-[#d9b45a]/70 px-4 py-2 text-sm font-bold text-[#f4ecd0] transition-colors hover:bg-[#d9b45a]/15 disabled:border-white/15 disabled:text-white/35 disabled:hover:bg-transparent';
const primary =
  'rounded-full bg-[#d9b45a] px-5 py-2 text-sm font-black text-[#2b2208] shadow-[0_3px_0_#9c7d2e] transition-[transform,box-shadow] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-40 disabled:shadow-none disabled:hover:translate-y-0';

export default function RemoTable({ r, view }: { r: Api; view: RemoView }) {
  const room = r.room as RoomView;
  const you = r.session!.you;
  const names = room.names;
  const cfg = view.config;
  const nameOf = (s: number) => seatName('en', s, you, names);

  const myTurn = view.turn === you && !view.roundOver && !view.over;
  const drawing = myTurn && view.phase === 'draw';
  const playing = myTurn && view.phase === 'play';
  const busy = r.busy;

  // ------------------------------------------------------------ the hand
  const [order, setOrder] = React.useState<string[]>([]);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [sortBy, setSortBy] = React.useState<'suit' | 'rank'>('suit');
  const [rules, setRules] = React.useState(false);
  const [pick, setPick] = React.useState(0);
  const dragging = React.useRef<string | null>(null);

  const hand = arrange(order, view.hand);
  const chosen = selected.filter((id) => view.hand.includes(id));
  const toggle = (id: string) =>
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id],
    );
  const sort = () => {
    const next = sortBy === 'suit' ? 'rank' : 'suit';
    setSortBy(next);
    setOrder([...hand].sort(next === 'suit' ? bySuit : byRank));
  };
  const moveBefore = (id: string, target: string) => {
    if (id === target) return;
    const rest = hand.filter((c) => c !== id);
    const at = rest.indexOf(target);
    setOrder([...rest.slice(0, at), id, ...rest.slice(at)]);
  };

  // ------------------------------------------------- what the picked cards make
  const pieces: Piece[] = chosen.map((id) => ({ id }));
  const reading = (kind: Kind) =>
    chosen.length >= 3
      ? resolveAll(pieces, kind, {
          aceLow: cfg.aceLow,
          aceHigh: cfg.aceHigh,
          jokerLimit: cfg.jokerLimit,
        })
      : 'Pick at least three cards.';
  const seqs = reading('sequence');
  const sets = reading('set');
  const kindNow: Kind | null = Array.isArray(seqs)
    ? 'sequence'
    : Array.isArray(sets)
      ? 'set'
      : null;
  const options = kindNow ? (kindNow === 'sequence' ? seqs : sets) : [];
  const shown = Array.isArray(options)
    ? options[Math.min(pick, options.length - 1)]
    : null;
  const ambiguous =
    Array.isArray(options) && options.length > 1 && chosen.some(isJoker);
  const value = shown && kindNow ? meldValue(shown, kindNow) : 0;
  const needValue = !view.opened[you] && cfg.initialMeld > 0;
  const lastOne = view.hand.length === 1;
  const strict = cfg.finish === 'melded';

  const lay = (kind: Kind | 'auto') => {
    if (!playing || busy) return;
    void r.move({
      type: 'meld',
      cards: chosen,
      kind,
      as: shown ? jokersIn(shown) : undefined,
    });
    setPick(0);
  };
  const fitsOn = (m: Meld) => {
    if (!playing || chosen.length !== 1 || !cfg.layoff || !view.opened[you])
      return false;
    const existing: Piece[] = m.cards.map((c) => ({
      id: c.id,
      as: c.joker ? repOf(c) : undefined,
    }));
    const test = (list: Piece[]) =>
      Array.isArray(
        resolveAll([...list, { id: chosen[0] }], m.kind, {
          aceLow: cfg.aceLow,
          aceHigh: cfg.aceHigh,
          jokerLimit: cfg.jokerLimit,
        }),
      );
    return test(existing) || test(existing.map((p) => ({ id: p.id })));
  };
  const addTo = (m: Meld, card = chosen[0]) => {
    if (!playing || busy || !card) return;
    void r.move({ type: 'layoff', card, meld: m.id });
  };
  const canDiscard = (id: string) =>
    playing && !(cfg.noSameDiscard && view.took === id) && !(strict && lastOne);
  const discard = (id: string) => {
    if (!canDiscard(id) || busy) return;
    void r.move({ type: 'discard', card: id });
  };

  // ------------------------------------------------------------- the clock
  const now = useClock(!view.over);
  const sinceReceived = Math.max(0, Math.floor((now - r.receivedAt) / 1000));
  const elapsed = view.elapsed + (view.over ? 0 : sinceReceived);

  const others = Array.from({ length: view.players }, (_, i) => i).filter(
    (i) => i !== you,
  );
  const step = view.roundOver ? 0 : view.phase === 'draw' ? 1 : 2;
  const takeHint = drawing && !!view.discardTop;

  return (
    <div className='mx-auto w-full max-w-5xl'>
      {view.over && view.winners.includes(you) && <Confetti count={60} />}

      {/* ----------------------------------------------------- top bar */}
      <div className='mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border border-line bg-surface/60 px-4 py-2.5 text-sm'>
        <span className='flex items-center gap-2'>
          <span className='text-lg font-black tracking-[0.15em] text-[#d9b45a]'>
            REMO
          </span>
          <span className='rounded-full bg-card px-2.5 py-0.5 text-xs'>
            {MODE_INFO[cfg.mode].title}
          </span>
        </span>
        <span className='flex items-center gap-4 text-xs text-[var(--mute)]'>
          <span data-testid='round'>
            Round {view.round}
            {cfg.rounds > 1 ? ` / ${cfg.rounds}` : ''}
          </span>
          <span data-testid='draw-count'>Pile: {view.drawCount}</span>
          <span className='tabular-nums'>⏱ {mmss(elapsed)}</span>
          <button
            type='button'
            onClick={() => setRules(true)}
            className='rounded-full border border-line-strong px-3 py-1 font-semibold hover:border-[#d9b45a] hover:text-ink'
          >
            Rules
          </button>
        </span>
      </div>

      {/* the felt */}
      <div className='rounded-[1.75rem] border border-[#d9b45a]/40 bg-[radial-gradient(ellipse_at_center,#1b6b4c,#0f3d2c_70%)] p-3 text-[#f4ecd0] shadow-[inset_0_0_70px_rgb(0_0_0/0.4)] sm:p-5'>
        {/* ------------------------------------------------ opponents */}
        <ul
          aria-label='Other players'
          className='mb-4 flex flex-wrap justify-center gap-3'
        >
          {others.map((seat) => {
            const gone = view.dropped.includes(seat);
            const turn = view.turn === seat && !view.roundOver && !view.over;
            const n = view.counts[seat];
            return (
              <li
                key={seat}
                data-seat={seat}
                data-turn={turn}
                className={`flex min-w-[9.5rem] items-center gap-3 rounded-2xl border px-3 py-2 transition-colors ${
                  turn
                    ? 'a-glow border-[#d9b45a] bg-[#d9b45a]/15'
                    : 'border-white/15 bg-black/20'
                } ${gone ? 'opacity-40' : ''}`}
              >
                <Avatar seat={seat} name={names[seat] || 'P'} />
                <span className='min-w-0'>
                  <span className='block max-w-24 truncate text-sm font-semibold'>
                    {nameOf(seat)}
                  </span>
                  <span className='flex items-center gap-1.5 text-[11px] text-[#f4ecd0]/70'>
                    <b className='tabular-nums'>{n}</b> cards
                    {view.opened[seat] && (
                      <span className='rounded-full bg-[#d9b45a]/25 px-1.5 text-[10px] font-bold text-[#d9b45a] uppercase'>
                        opened
                      </span>
                    )}
                    {gone && <span className='text-[#ff9b9b]'>left</span>}
                  </span>
                  {cfg.rounds > 1 && (
                    <span className='block text-[11px] text-[#f4ecd0]/70'>
                      {view.totals[seat]} pts
                    </span>
                  )}
                </span>
                <span className='ml-auto flex' aria-hidden>
                  {Array.from({ length: Math.min(n, 5) }, (_, i) => (
                    <CardBack
                      key={i}
                      size='xs'
                      className={i ? '-ml-5' : ''}
                      style={{ rotate: `${(i - 2) * 6}deg` }}
                    />
                  ))}
                </span>
              </li>
            );
          })}
        </ul>

        {/* ---------------------------------------------------- the table */}
        <section
          aria-label='Table'
          className='mb-4 rounded-2xl border border-white/10 bg-black/15 p-3'
        >
          <div className='flex flex-wrap items-start justify-center gap-x-8 gap-y-3'>
            <div className='flex items-start gap-4'>
              <div className='flex flex-col items-center gap-1'>
                <button
                  type='button'
                  aria-label='Draw from the pile'
                  disabled={!drawing || busy}
                  onClick={() => void r.move({ type: 'draw', from: 'pile' })}
                  className={`relative rounded-xl transition-transform ${
                    drawing
                      ? 'a-bob cursor-pointer ring-4 ring-[#d9b45a]/70'
                      : ''
                  }`}
                >
                  <span
                    aria-hidden
                    className='absolute inset-0 translate-x-1 -translate-y-1 opacity-70'
                  >
                    <CardBack size='md' />
                  </span>
                  <CardBack size='md' />
                  <span className='absolute inset-x-0 bottom-1 text-center text-sm font-black text-[#f4ecd0]'>
                    {view.drawCount}
                  </span>
                </button>
                <span className='text-[11px] text-[#f4ecd0]/70'>Draw pile</span>
              </div>

              <div
                className='flex flex-col items-center gap-1'
                onDragOver={(e) => playing && e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const id =
                    dragging.current ?? e.dataTransfer.getData('text/plain');
                  dragging.current = null;
                  if (id && view.hand.includes(id)) discard(id);
                }}
              >
                {view.discardTop ? (
                  <PlayingCard
                    key={view.discardTop}
                    id={view.discardTop}
                    size='md'
                    hint={takeHint}
                    onClick={
                      drawing
                        ? () => void r.move({ type: 'draw', from: 'discard' })
                        : undefined
                    }
                    className='a-pop'
                  />
                ) : (
                  <span className='flex h-24 w-[4.2rem] items-center justify-center rounded-xl border-2 border-dashed border-white/25 text-xs text-white/40'>
                    empty
                  </span>
                )}
                <span className='text-[11px] text-[#f4ecd0]/70'>
                  Discard ({view.discardCount})
                </span>
              </div>
            </div>

            <div className='min-w-0 flex-1 basis-72'>
              <p className='mb-1.5 text-center text-[11px] font-bold tracking-widest text-[#f4ecd0]/60 uppercase'>
                Combinations on the table
              </p>
              {view.melds.length === 0 && (
                <p className='py-5 text-center text-sm text-[#f4ecd0]/55'>
                  Nothing laid down yet.
                </p>
              )}
              <ul
                className='flex flex-wrap justify-center gap-2'
                data-testid='melds'
              >
                {view.melds.map((m) => {
                  const fits = fitsOn(m);
                  return (
                    <li
                      key={m.id}
                      data-meld={m.id}
                      onDragOver={(e) =>
                        playing && cfg.layoff && e.preventDefault()
                      }
                      onDrop={(e) => {
                        e.preventDefault();
                        const id =
                          dragging.current ??
                          e.dataTransfer.getData('text/plain');
                        dragging.current = null;
                        if (id && view.hand.includes(id)) addTo(m, id);
                      }}
                      className={`a-pop rounded-xl border px-2 py-1.5 ${
                        fits
                          ? 'border-[#d9b45a] bg-[#d9b45a]/10'
                          : 'border-white/15 bg-black/20'
                      }`}
                    >
                      <p className='mb-1 flex items-center justify-between gap-2 text-[10px] text-[#f4ecd0]/65'>
                        <span className='capitalize'>
                          {m.kind} · {nameOf(m.seat)}
                        </span>
                        {fits && (
                          <button
                            type='button'
                            onClick={() => addTo(m)}
                            disabled={busy}
                            className='rounded-full bg-[#d9b45a] px-2 py-0.5 text-[10px] font-black text-[#2b2208]'
                          >
                            + Add here
                          </button>
                        )}
                      </p>
                      <div className='flex'>
                        {m.cards.map((c, i) => (
                          <PlayingCard
                            key={c.id}
                            id={c.id}
                            as={c.joker ? repOf(c) : undefined}
                            size='sm'
                            className={i ? '-ml-5' : ''}
                          />
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {view.feed.length > 0 && (
            <ul
              aria-label='Recent activity'
              className='mt-3 space-y-0.5 border-t border-white/10 pt-2 text-xs text-[#f4ecd0]/70'
            >
              {[...view.feed]
                .reverse()
                .slice(0, 3)
                .map((f) => (
                  <li key={f.n}>
                    {f.seat !== null ? `${nameOf(f.seat)}: ` : ''}
                    {f.text}
                  </li>
                ))}
            </ul>
          )}
        </section>

        {/* ------------------------------------------------ whose turn */}
        <div className='mb-3 flex flex-wrap items-center justify-center gap-2 text-xs'>
          {(['Draw', 'Meld', 'Discard'] as const).map((p, i) => {
            const active = step !== 0 && (i === 0 ? step === 1 : step === 2);
            return (
              <span
                key={p}
                data-step={p}
                data-active={active}
                className={`rounded-full px-3 py-1 font-bold ${
                  active
                    ? 'bg-[#d9b45a] text-[#2b2208]'
                    : 'border border-white/20 text-[#f4ecd0]/60'
                }`}
              >
                {i + 1}. {p}
                {p === 'Meld' && ' (optional)'}
              </span>
            );
          })}
          <span
            className='w-full text-center text-sm font-semibold sm:w-auto'
            role='status'
            data-testid='turn'
          >
            {view.roundOver
              ? 'Round over'
              : myTurn
                ? view.phase === 'draw'
                  ? 'Your turn: draw a card'
                  : 'Your turn: lay down cards, then discard one'
                : `${nameOf(view.turn)}'s turn`}
          </span>
        </div>

        {/* ------------------------------------------------------ hand */}
        <section aria-label='Your hand'>
          <div
            data-testid='hand'
            className='flex flex-wrap justify-center gap-y-3 pt-3 pb-2'
          >
            {hand.map((id, i) => (
              <PlayingCard
                key={`${view.round}-${id}`}
                id={id}
                size='md'
                selected={chosen.includes(id)}
                onClick={view.roundOver ? undefined : () => toggle(id)}
                draggable
                onDragStart={(e) => {
                  dragging.current = id;
                  e.dataTransfer.setData('text/plain', id);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const from =
                    dragging.current ?? e.dataTransfer.getData('text/plain');
                  dragging.current = null;
                  if (from) moveBefore(from, id);
                }}
                className='a-deal -mx-1'
                style={{ animationDelay: `${i * 70}ms` }}
              />
            ))}
            {hand.length === 0 && (
              <span className='py-8 text-sm text-[#f4ecd0]/60'>No cards.</span>
            )}
          </div>

          {/* what the picked cards make */}
          {chosen.length > 0 && playing && (
            <div
              className='mt-1 text-center text-sm'
              data-testid='preview'
              aria-live='polite'
            >
              {kindNow ? (
                <span className='text-[#d9b45a]'>
                  A valid {kindNow}
                  {shown &&
                    shown.some((c) => c.joker) &&
                    ` (joker as ${readingName(shown)})`}
                  {needValue &&
                    ` · worth ${value}, you need ${cfg.initialMeld} to open`}
                </span>
              ) : (
                <span className='text-[#f4ecd0]/60'>
                  {typeof seqs === 'string' &&
                  typeof sets === 'string' &&
                  chosen.length >= 3
                    ? `Not a combination: ${sets === seqs ? seqs : seqs}`
                    : chosen.length < 3
                      ? `${chosen.length} picked`
                      : ''}
                </span>
              )}
            </div>
          )}
          {ambiguous && Array.isArray(options) && (
            <div className='mt-1 flex flex-wrap items-center justify-center gap-2 text-xs'>
              <span className='text-[#f4ecd0]/70'>The joker stands for:</span>
              {options.map((o, i) => (
                <button
                  key={i}
                  type='button'
                  onClick={() => setPick(i)}
                  aria-pressed={Math.min(pick, options.length - 1) === i}
                  className={`rounded-full border px-2.5 py-0.5 font-bold ${
                    Math.min(pick, options.length - 1) === i
                      ? 'border-[#d9b45a] bg-[#d9b45a]/20'
                      : 'border-white/25'
                  }`}
                >
                  {readingName(o)}
                </button>
              ))}
            </div>
          )}

          {/* ------------------------------------------------ actions */}
          <div className='mt-3 flex flex-wrap items-center justify-center gap-2'>
            <button
              type='button'
              className={primary}
              disabled={!drawing || busy}
              onClick={() => void r.move({ type: 'draw', from: 'pile' })}
            >
              Draw
            </button>
            <button
              type='button'
              className={btn}
              disabled={!drawing || busy || !view.discardTop}
              onClick={() => void r.move({ type: 'draw', from: 'discard' })}
            >
              Take discard
            </button>
            <button
              type='button'
              className={btn}
              disabled={!playing || busy || !Array.isArray(seqs)}
              onClick={() => lay('sequence')}
            >
              Create Sequence
            </button>
            <button
              type='button'
              className={btn}
              disabled={!playing || busy || !Array.isArray(sets)}
              onClick={() => lay('set')}
            >
              Create Set
            </button>
            <button
              type='button'
              className={btn}
              disabled={!playing || busy || !kindNow}
              onClick={() => lay('auto')}
            >
              Lay Down
            </button>
            <button
              type='button'
              className={primary}
              disabled={
                !playing ||
                busy ||
                chosen.length !== 1 ||
                !canDiscard(chosen[0])
              }
              onClick={() => discard(chosen[0])}
            >
              Discard
            </button>
            {playing && strict && lastOne && (
              <button
                type='button'
                className={btn}
                disabled={busy}
                onClick={() => void r.move({ type: 'pass' })}
              >
                End turn
              </button>
            )}
            <button type='button' className={btn} onClick={sort}>
              Sort by {sortBy === 'suit' ? 'rank' : 'suit'}
            </button>
          </div>
          {playing &&
            chosen.length === 1 &&
            view.took === chosen[0] &&
            cfg.noSameDiscard && (
              <p className='mt-2 text-center text-xs text-[#ffb3b3]'>
                You just took that card, so you cannot discard it.
              </p>
            )}
          {r.error && !view.over && (
            <p className='mt-2 text-center text-sm text-[#ffb3b3]' role='alert'>
              {r.error}
            </p>
          )}
          {!myTurn && !view.roundOver && (
            <p className='mt-2 text-center text-sm text-[#f4ecd0]/70'>
              Waiting for {nameOf(view.turn)}…
            </p>
          )}
        </section>
      </div>

      {rules && <Rules view={view} onClose={() => setRules(false)} />}
      {view.roundOver && <RoundResult r={r} view={view} />}
    </div>
  );
}

function Rules({ view, onClose }: { view: RemoView; onClose: () => void }) {
  const c = view.config;
  const yes = (b: boolean) => (b ? 'on' : 'off');
  return (
    <div
      role='dialog'
      aria-label='Rules'
      className='fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm'
    >
      <div className='a-pop my-auto w-full max-w-lg rounded-3xl border border-[#d9b45a]/50 bg-card p-6 text-sm shadow-2xl'>
        <h2 className='text-xl font-black text-[#d9b45a]'>How to play Remo</h2>
        <ol className='mt-3 list-decimal space-y-1.5 pl-5 text-[var(--mute)]'>
          <li>
            <b className='text-ink'>Draw</b> a card from the pile, or take the
            top card of the discard pile.
          </li>
          <li>
            <b className='text-ink'>Lay down</b> sequences (three or more in a
            row, one suit) and sets (three or four of a kind, different suits).
            {c.layoff &&
              ' Once you have laid down, you can add to combinations on the table.'}
          </li>
          <li>
            <b className='text-ink'>Discard</b> one card to end your turn.
          </li>
        </ol>
        <p className='mt-3 text-[var(--mute)]'>
          {c.finish === 'discard'
            ? 'Get rid of your last card, by laying it down or discarding it, to win the round.'
            : 'You win by laying down every card. You cannot go out by discarding your last card.'}
        </p>
        <dl className='mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs'>
          {[
            ['Cards each', c.handSize],
            ['Jokers', c.jokers || 'none'],
            ['Jokers per combination', c.jokers ? c.jokerLimit : '–'],
            ['Ace low (A-2-3)', yes(c.aceLow)],
            ['Ace high (Q-K-A)', yes(c.aceHigh)],
            ['Add to combinations', yes(c.layoff)],
            ['Opening worth', c.initialMeld || 'any'],
            ['Cannot discard the card just taken', yes(c.noSameDiscard)],
            ['Turn clock', c.turnSeconds ? `${c.turnSeconds}s` : 'none'],
            ['Rounds', c.rounds],
          ].map(([k, v]) => (
            <React.Fragment key={String(k)}>
              <dt className='text-[var(--mute)]'>{k}</dt>
              <dd className='font-semibold'>{v}</dd>
            </React.Fragment>
          ))}
        </dl>
        <p className='mt-3 text-xs text-[var(--mute)]'>
          Cards left in your hand cost points: A 1, 2-10 face value, J Q K 10,
          joker 20. The winner of a round pays nothing.
        </p>
        <div className='mt-4 flex justify-end'>
          <button type='button' onClick={onClose} className={primary}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

function RoundResult({ r, view }: { r: Api; view: RemoView }) {
  const room = r.room as RoomView;
  const you = r.session!.you;
  const name = (s: number) => seatName('en', s, you, room.names);
  const cfg = view.config;
  const medal = ['🥇', '🥈', '🥉'];
  const why = {
    out: 'Went out!',
    stalled: 'The cards ran out.',
    left: 'The other players left.',
  } as const;
  return (
    <div
      role='dialog'
      aria-label={view.over ? 'Match result' : 'Round result'}
      className='fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm'
    >
      <div className='a-pop my-auto w-full max-w-lg rounded-3xl border border-[#d9b45a]/50 bg-card p-6 shadow-2xl'>
        <p className='text-center text-xs font-bold tracking-widest text-[#d9b45a] uppercase'>
          {view.roundReason ? why[view.roundReason] : 'Round over'}
        </p>
        <h2 className='mt-1 text-center text-3xl font-black'>
          {view.over
            ? view.winners.length > 1
              ? 'It is a tie'
              : view.winners[0] === you
                ? 'You win the match!'
                : `${name(view.winners[0])} wins the match`
            : view.roundWinner === null
              ? 'Nobody went out'
              : view.roundWinner === you
                ? 'You went out!'
                : `${name(view.roundWinner)} went out`}
        </h2>
        <p className='mt-1 text-center text-xs text-[var(--mute)]'>
          {MODE_INFO[cfg.mode].title} · round {view.round}
          {cfg.rounds > 1 ? ` of ${cfg.rounds}` : ''} · {mmss(view.elapsed)}
        </p>

        <ul className='mt-4 space-y-2' aria-label='Hands'>
          {view.ranking.map((s, i) => (
            <li
              key={s}
              className={`rounded-xl border border-line px-3 py-2 ${s === you ? 'bg-surface/70' : 'bg-surface/40'}`}
            >
              <div className='flex items-center justify-between gap-2 text-sm'>
                <span className='font-semibold'>
                  {medal[i] ?? i + 1} {name(s)}
                  {view.roundWinner === s && (
                    <span className='ml-2 text-xs text-[#d9b45a]'>out</span>
                  )}
                </span>
                <span className='text-xs text-[var(--mute)]'>
                  +{view.roundPenalty?.[s] ?? 0} · total{' '}
                  <b className='text-ink'>{view.totals[s]}</b>
                </span>
              </div>
              {view.revealed && view.revealed[s].length > 0 && (
                <div className='mt-1.5 flex flex-wrap gap-1'>
                  {view.revealed[s].map((c) => (
                    <PlayingCard key={c} id={c} size='xs' />
                  ))}
                  <span className='ml-1 self-center text-xs text-[var(--mute)]'>
                    {view.revealed[s].reduce((a, c) => a + penalty(c), 0)} pts
                    left
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>

        <div className='mt-5 flex flex-wrap justify-center gap-2'>
          {view.over ? (
            <button
              type='button'
              onClick={r.rematch}
              disabled={r.busy}
              className={primary}
            >
              Play Again
            </button>
          ) : (
            <button
              type='button'
              onClick={() => void r.move({ type: 'next' })}
              disabled={r.busy}
              className={primary}
            >
              Next Round
            </button>
          )}
          <button
            type='button'
            onClick={r.leave}
            className='rounded-full border-2 border-line-strong px-5 py-2 text-sm font-semibold'
          >
            Back to lobby
          </button>
          <a
            href='/games'
            className='rounded-full border-2 border-line-strong px-5 py-2 text-sm font-semibold'
          >
            Exit game
          </a>
        </div>
      </div>
    </div>
  );
}
