'use client';

import * as React from 'react';

import type { SekataView, WordView } from '@/lib/games/sekata';
import type { SCard } from '@/lib/games/sekata-cards';
import { SYLLABLE } from '@/lib/games/sekata-cards';
import type { RoomView } from '@/lib/rooms/types';
import type { useRoom } from '@/lib/rooms/useRoom';

import Confetti from '@/components/games/Confetti';
import { seatLabel } from '@/components/games/RoomGate';
import { MODE_INFO, seatColor } from '@/components/games/sekata/labels';
import SekataCard from '@/components/games/sekata/SekataCard';
import useSfx from '@/components/games/sekata/useSfx';
import WordDefinition from '@/components/games/WordDefinition';

type Api = ReturnType<typeof useRoom>;
type Origin = 'hand' | 'green' | 'center' | 'yellow';

const mmss = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/** Re-renders once a second, so clocks tick. */
function useClock(active: boolean) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

function Avatar({
  seat,
  name,
  size = 'size-9',
}: {
  seat: number;
  name: string;
  size?: string;
}) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full text-sm font-bold text-[#2b2430] uppercase ${size}`}
      style={{ background: seatColor(seat) }}
    >
      {name.charAt(0)}
    </span>
  );
}

const chip = (tone: string) =>
  `rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${tone}`;

/** The parts of a word, as little cards. */
function Parts({ parts }: { parts: WordView['parts'] }) {
  return (
    <span className='inline-flex flex-wrap items-center gap-1'>
      {parts.map((p, i) => (
        <SekataCard key={i} card={{ kind: p.kind, text: p.text }} size='xs' />
      ))}
    </span>
  );
}

export default function SekataTable({ r, view }: { r: Api; view: SekataView }) {
  const room = r.room as RoomView;
  const you = r.session!.you;
  const names = room.names;
  const cfg = view.config;
  const sfx = useSfx();
  const nameOf = (seat: number) => seatLabel(seat, you, names);

  const mine = view.words.filter((w) => w.seat === you);
  const myLast = mine.length ? mine[mine.length - 1] : null;
  const myKey = myLast?.n ?? 0;

  // the word being built; a new word of yours (accepted or not) clears it
  const [built, setBuilt] = React.useState<{
    key: number;
    ids: string[];
    fills: Record<string, string>;
    meaning: string;
  }>({ key: 0, ids: [], fills: {}, meaning: '' });
  const fresh = built.key === myKey;
  const pool = new Map<string, { card: SCard; from: Origin }>();
  view.hand.forEach((card) => pool.set(card.id, { card, from: 'hand' }));
  view.greens.forEach((card) => pool.set(card.id, { card, from: 'green' }));
  view.center.forEach((card) => pool.set(card.id, { card, from: 'center' }));
  view.yellow.forEach((card) => pool.set(card.id, { card, from: 'yellow' }));
  const ids = fresh ? built.ids.filter((id) => pool.has(id)) : [];
  const fills = fresh ? built.fills : {};
  const meaning = fresh ? built.meaning : '';
  type Built = typeof built;
  /** Changes the word being built, from whatever it is when the change lands. */
  const change = (fn: (cur: Built) => Partial<Built>) =>
    setBuilt((prev) => {
      const cur: Built =
        prev.key === myKey
          ? prev
          : { key: myKey, ids: [], fills: {}, meaning: '' };
      const live = cur.ids.filter((id) => pool.has(id));
      return { ...cur, ids: live, ...fn({ ...cur, ids: live }) };
    });
  const update = (patch: Partial<Built>) => change(() => patch);

  const out = view.dropped.includes(you) || view.places.includes(you);
  const playing = !view.over && !out;
  const dragId = React.useRef<string | null>(null);
  const [hover, setHover] = React.useState<number | null>(null);

  const tap = (id: string) => {
    if (!playing) return;
    sfx.play('tap');
    change((cur) => ({
      ids: cur.ids.includes(id)
        ? cur.ids.filter((i) => i !== id)
        : [...cur.ids, id],
    }));
  };
  const insertAt = (id: string, at: number) => {
    change((cur) => {
      const without = cur.ids.filter((i) => i !== id);
      const index = Math.min(at, without.length);
      return {
        ids: [...without.slice(0, index), id, ...without.slice(index)],
      };
    });
  };

  const text = (id: string) => {
    const c = pool.get(id)!.card;
    return c.kind === 'green' || c.kind === 'blank'
      ? (fills[id] ?? '').toLowerCase()
      : c.text;
  };
  const word = ids.map(text).join('');
  const jokers = ids.filter((id) => {
    const k = pool.get(id)!.card.kind;
    return k === 'green' || k === 'blank';
  });
  const jokersReady = jokers.every((id) => SYLLABLE.test(text(id)));
  const ownCount = ids.filter((id) => pool.get(id)!.from === 'hand').length;
  const needMeaning = cfg.needMeaning && meaning.trim().length < 3;
  const canSend =
    playing &&
    !r.busy &&
    !view.cooling &&
    ids.length >= cfg.minWordCards &&
    ownCount >= 1 &&
    jokersReady &&
    !needMeaning;

  const submit = () => {
    if (!canSend) return;
    void r.move({
      type: 'submit',
      cards: ids,
      fills,
      meaning: cfg.needMeaning ? meaning.trim() : undefined,
    });
  };

  // ------------------------------------------------------------ sounds
  const seen = React.useRef({
    words: view.words.at(-1)?.n ?? 0,
    reveals: view.reveals,
    over: view.over,
    status: new Map<number, string>(),
  });
  const { play } = sfx;
  React.useEffect(() => {
    const s = seen.current;
    const last = view.words.at(-1);
    if (last && last.n > s.words) {
      if (last.seat === you || last.status === 'ok') {
        play(
          last.status === 'invalid' || last.status === 'void' ? 'bad' : 'ok',
        );
      }
      s.words = last.n;
    }
    if (view.reveals > s.reveals) {
      play('draw');
      s.reveals = view.reveals;
    }
    if (view.over && !s.over) {
      play(view.winner === you ? 'win' : 'bad');
    }
    s.over = view.over;
  }, [view.words, view.reveals, view.over, view.winner, you, play]);

  // --------------------------------------------------------------- clock
  const now = useClock(!view.over);
  const sinceReceived = Math.max(0, Math.floor((now - r.receivedAt) / 1000));
  const timeLeft =
    view.timeLeft === null ? null : Math.max(0, view.timeLeft - sinceReceived);
  const elapsed = view.elapsed + (view.over ? 0 : sinceReceived);

  const moveRef = React.useRef(r.move);
  React.useEffect(() => {
    moveRef.current = r.move;
  });
  React.useEffect(() => {
    if (view.timeLeft === null || view.over) return;
    // whoever's clock runs out first calls time; the others' calls are harmless
    const wait = view.timeLeft * 1000 + 500 + you * 350;
    const timer = setTimeout(
      () => void moveRef.current({ type: 'tick' }),
      wait,
    );
    return () => clearTimeout(timer);
  }, [r.receivedAt, view.timeLeft, view.over, you]);

  const live = Array.from({ length: view.players }, (_, i) => i).filter(
    (i) => !view.dropped.includes(i) && !view.places.includes(i),
  );
  const votes = live.filter((i) => view.stuck[i]).length;
  const iAmStuck = view.stuck[you];
  const reviews = view.words.filter((w) => w.status === 'review');
  const recent = [...view.words].reverse().slice(0, 8);
  const lastReveal = view.reveals;
  const opponents = Array.from({ length: view.players }, (_, i) => i).filter(
    (i) => i !== you,
  );
  const point = cfg.mode === 'point';

  return (
    <div className='mx-auto w-full max-w-3xl'>
      {view.over && view.winner === you && <Confetti count={60} />}

      {/* ------------------------------------------------------ top bar */}
      <div className='mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border border-line bg-surface/60 px-4 py-2.5 text-sm'>
        <span className='flex items-center gap-2'>
          <span className='text-lg font-black tracking-[0.15em] text-[#f08fb0]'>
            SEKATA
          </span>
          <span className='rounded-full bg-card px-2.5 py-0.5 text-xs'>
            {MODE_INFO[cfg.mode].title}
          </span>
        </span>
        <span className='flex items-center gap-4 text-xs text-[var(--mute)]'>
          <span>{view.players - view.dropped.length} pemain</span>
          <span data-testid='draw-count'>Tumpukan: {view.drawCount}</span>
          <span
            data-testid='clock'
            className={
              timeLeft !== null && timeLeft <= 10
                ? 'a-wiggle font-bold text-err'
                : 'font-semibold text-ink'
            }
          >
            {timeLeft !== null ? `⏱ ${mmss(timeLeft)}` : `⏱ ${mmss(elapsed)}`}
          </span>
          <button
            type='button'
            onClick={sfx.toggle}
            aria-pressed={sfx.muted}
            aria-label={sfx.muted ? 'Nyalakan suara' : 'Matikan suara'}
            className='hover:text-ink'
          >
            {sfx.muted ? '🔇' : '🔊'}
          </button>
        </span>
      </div>

      {/* ------------------------------------------------- moderator */}
      {reviews.length > 0 && (
        <section
          aria-label='Menunggu keputusan'
          className='mb-3 space-y-3 rounded-2xl border border-[#f7dc6a]/60 bg-[#f7dc6a]/10 p-4'
        >
          <h2 className='text-sm font-semibold'>
            {view.moderator
              ? 'Kamu moderator: putuskan kata ini'
              : 'Menunggu keputusan moderator'}
          </h2>
          {reviews.map((w) => (
            <article
              key={w.n}
              className='rounded-xl border border-line bg-surface/60 p-3'
            >
              <div className='flex flex-wrap items-center gap-2'>
                <Avatar
                  seat={w.seat}
                  name={names[w.seat] || 'P'}
                  size='size-7'
                />
                <span className='text-sm'>{nameOf(w.seat)}</span>
                <Parts parts={w.parts} />
                <b className='tracking-widest uppercase'>{w.word}</b>
              </div>
              {w.meaning && (
                <p className='mt-1 text-sm text-[var(--mute)]'>
                  Arti kata: {w.meaning}
                </p>
              )}
              <p className='mt-1 text-xs text-[var(--mute)]'>{w.reason}</p>
              {view.moderator && (
                <>
                  <div className='mt-2 flex gap-2'>
                    <button
                      type='button'
                      disabled={r.busy}
                      onClick={() =>
                        void r.move({ type: 'rule', n: w.n, verdict: 'accept' })
                      }
                      className='rounded-lg bg-[#7cc576] px-4 py-1.5 text-sm font-bold text-[#17310f] disabled:opacity-40'
                    >
                      Terima
                    </button>
                    <button
                      type='button'
                      disabled={r.busy}
                      onClick={() =>
                        void r.move({ type: 'rule', n: w.n, verdict: 'reject' })
                      }
                      className='rounded-lg bg-[#e57373] px-4 py-1.5 text-sm font-bold text-[#3a0f0f] disabled:opacity-40'
                    >
                      Tolak
                    </button>
                  </div>
                  <details className='mt-2 text-sm'>
                    <summary className='cursor-pointer text-xs text-[var(--mute)]'>
                      Cek arti di kamus
                    </summary>
                    <div className='mt-2'>
                      <WordDefinition word={w.word} lang='id' />
                    </div>
                  </details>
                </>
              )}
            </article>
          ))}
        </section>
      )}

      {/* the table itself: the pink, yellow and green cards on the dark felt */}
      <div className='rounded-[1.75rem] border border-line bg-surface/50 p-3 text-ink sm:p-5'>
        {/* ------------------------------------------------ opponents */}
        <ul
          aria-label='Pemain lain'
          className='mb-4 flex flex-wrap justify-center gap-2'
        >
          {opponents.map((seat) => {
            const gone = view.dropped.includes(seat);
            const safe = view.places.includes(seat);
            const label = names[seat] || `Pemain ${seat + 1}`;
            return (
              <li
                key={seat}
                data-seat={seat}
                className={`flex min-w-[7.5rem] items-center gap-2 rounded-xl border bg-card/70 px-2.5 py-1.5 transition-opacity ${
                  gone ? 'a-fade opacity-40' : ''
                } ${safe ? 'border-[#7cc576]' : 'border-line'}`}
              >
                <Avatar seat={seat} name={label} size='size-8' />
                <span className='min-w-0'>
                  <span className='block max-w-24 truncate text-xs font-semibold'>
                    {label}
                  </span>
                  <span className='flex items-center gap-1 text-[11px] text-[var(--mute)]'>
                    <span aria-hidden>🂠</span>
                    <b className='tabular-nums'>{view.counts[seat]}</b>
                    {point && (
                      <span className='ml-1 font-semibold text-[#f08fb0]'>
                        {view.scores[seat]} poin
                      </span>
                    )}
                  </span>
                  <span className='flex gap-1'>
                    {gone && (
                      <span className={chip('bg-err/15 text-err')}>keluar</span>
                    )}
                    {safe && !gone && (
                      <span className={chip('bg-[#7cc576]/15 text-[#7cc576]')}>
                        aman
                      </span>
                    )}
                    {!gone && !safe && view.stuck[seat] && (
                      <span className={chip('bg-[#f7dc6a]/15 text-[#f7dc6a]')}>
                        buntu
                      </span>
                    )}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>

        {/* ---------------------------------------------------- centre */}
        <section
          aria-label='Meja'
          className='mb-4 rounded-2xl border-2 border-dashed border-line-strong bg-card/40 p-3'
        >
          <div className='flex flex-wrap items-start justify-center gap-x-6 gap-y-3'>
            <div className='flex flex-col items-center gap-1'>
              <div className='relative h-24 w-[4.25rem]'>
                {[2, 1, 0].map((i) => (
                  <span
                    key={i}
                    aria-hidden
                    className='absolute inset-0 rounded-xl border-2 border-[#e88aab] bg-[#f4a3bf]'
                    style={{ translate: `${i * 2}px ${-i * 2}px` }}
                  />
                ))}
                <span className='absolute inset-0 flex items-center justify-center rounded-xl border-2 border-[#e88aab] bg-[#f8b8cd] text-xl font-black text-[#7a2f4d]'>
                  {view.drawCount}
                </span>
              </div>
              <button
                type='button'
                onClick={() => void r.move({ type: 'stuck' })}
                disabled={!playing || r.busy}
                aria-pressed={iAmStuck}
                className={`rounded-full border-2 px-3 py-1 text-xs font-bold transition-colors disabled:opacity-40 ${
                  iAmStuck
                    ? 'border-[#f08fb0] bg-[#f08fb0] text-[#2b1420]'
                    : 'border-[#f08fb0] text-[#f08fb0] hover:bg-[#f08fb0]/10'
                }`}
              >
                Buntu {votes}/{live.length}
              </button>
              <span className='max-w-28 text-center text-[10px] text-[var(--mute)]'>
                Semua buntu → buka kartu baru
              </span>
            </div>

            <div className='min-w-0 flex-1 basis-60'>
              <p className='mb-1.5 text-center text-[11px] font-bold tracking-widest text-[var(--mute)] uppercase'>
                Suku kata di tengah
              </p>
              <div
                className='flex min-h-24 flex-wrap items-center justify-center gap-2'
                data-testid='center'
              >
                {view.center.map((card, i) => (
                  <SekataCard
                    key={card.id}
                    card={card}
                    selected={ids.includes(card.id)}
                    order={
                      ids.includes(card.id)
                        ? ids.indexOf(card.id) + 1
                        : undefined
                    }
                    onClick={playing ? () => tap(card.id) : undefined}
                    draggable={playing}
                    onDragStart={(e) => {
                      dragId.current = card.id;
                      e.dataTransfer.setData('text/plain', card.id);
                    }}
                    className={
                      lastReveal > 0 && i === view.center.length - 1
                        ? 'a-draw-in'
                        : ''
                    }
                  />
                ))}
              </div>
              <p className='mt-3 mb-1.5 text-center text-[11px] font-bold tracking-widest text-[var(--mute)] uppercase'>
                Kartu bantu bersama
              </p>
              <div
                className='flex min-h-[4.5rem] flex-wrap items-center justify-center gap-2'
                data-testid='yellow'
              >
                {view.yellow.length === 0 && (
                  <span className='text-xs text-[var(--mute)]'>Tidak ada</span>
                )}
                {view.yellow.map((card) => (
                  <SekataCard
                    key={card.id}
                    card={card}
                    size='sm'
                    selected={ids.includes(card.id)}
                    order={
                      ids.includes(card.id)
                        ? ids.indexOf(card.id) + 1
                        : undefined
                    }
                    onClick={playing ? () => tap(card.id) : undefined}
                    draggable={playing}
                    onDragStart={(e) => {
                      dragId.current = card.id;
                      e.dataTransfer.setData('text/plain', card.id);
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------- word builder */}
        <section aria-label='Susun kata' className='mb-4'>
          <div
            data-testid='tray'
            onDragOver={(e) => {
              e.preventDefault();
              if (hover === null) setHover(ids.length);
            }}
            onDragLeave={() => setHover(null)}
            onDrop={(e) => {
              e.preventDefault();
              const id = dragId.current ?? e.dataTransfer.getData('text/plain');
              dragId.current = null;
              if (id && pool.has(id)) insertAt(id, hover ?? ids.length);
              setHover(null);
            }}
            className={`flex min-h-28 flex-wrap items-center justify-center gap-2 rounded-2xl border-2 p-3 transition-colors ${
              hover !== null
                ? 'border-[#f08fb0] bg-[#f08fb0]/10'
                : 'border-line-strong bg-card/50'
            }`}
          >
            {ids.length === 0 && (
              <p className='px-4 text-center text-sm text-[var(--mute)]'>
                Pilih atau seret kartu ke sini untuk menyusun kata
              </p>
            )}
            {ids.map((id, i) => {
              const { card } = pool.get(id)!;
              const joker = card.kind === 'green' || card.kind === 'blank';
              return (
                <div
                  key={id}
                  className='flex flex-col items-center gap-1'
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setHover(i);
                  }}
                >
                  <SekataCard
                    card={card}
                    text={joker ? (fills[id] ?? '') : undefined}
                    size='sm'
                    onClick={() => tap(id)}
                    draggable
                    onDragStart={(e) => {
                      dragId.current = id;
                      e.dataTransfer.setData('text/plain', id);
                    }}
                    className={hover === i ? 'translate-x-2' : ''}
                  />
                  {joker && (
                    <input
                      aria-label='Suku kata joker'
                      value={fills[id] ?? ''}
                      maxLength={4}
                      placeholder='ka'
                      onChange={(e) =>
                        change((cur) => ({
                          fills: {
                            ...cur.fills,
                            [id]: e.target.value
                              .toLowerCase()
                              .replace(/[^a-z]/g, ''),
                          },
                        }))
                      }
                      className='h-6 w-12 rounded border border-line-strong bg-surface px-1 text-center text-xs text-ink focus:ring-0'
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className='mt-3 flex min-h-10 flex-wrap items-center justify-center gap-x-4 gap-y-1'>
            <span
              data-testid='preview'
              className='text-3xl font-black tracking-[0.2em] text-ink uppercase'
            >
              {word || '…'}
            </span>
            {ids.length > 0 && ownCount === 0 && (
              <span className='text-xs text-err'>
                Pakai minimal satu kartu dari tanganmu
              </span>
            )}
          </div>

          {cfg.needMeaning && ids.length > 0 && (
            <input
              aria-label='Arti kata'
              value={meaning}
              maxLength={120}
              onChange={(e) => update({ meaning: e.target.value })}
              placeholder='Apa arti kata ini?'
              className='mt-2 w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-[var(--mute)] focus:ring-0'
            />
          )}

          {/* what happened to your last word */}
          {myLast && fresh === false && (
            <p
              key={myLast.n}
              role={myLast.status === 'invalid' ? 'alert' : 'status'}
              className={`a-pop mt-2 rounded-xl px-3 py-2 text-center text-sm font-medium ${
                myLast.status === 'ok'
                  ? 'bg-[#7cc576]/15 text-[#7cc576]'
                  : myLast.status === 'review'
                    ? 'bg-[#f7dc6a]/15 text-[#f7dc6a]'
                    : 'bg-err/15 text-err'
              }`}
            >
              {myLast.status === 'ok' &&
                `✔ "${myLast.word.toUpperCase()}" diterima (+${myLast.points})`}
              {myLast.status === 'review' &&
                `⏳ "${myLast.word.toUpperCase()}" menunggu moderator`}
              {(myLast.status === 'invalid' || myLast.status === 'void') &&
                `✖ ${myLast.reason ?? 'Kata ditolak.'}`}
            </p>
          )}

          <div className='mt-3 flex flex-wrap items-center justify-center gap-2'>
            <button
              type='button'
              onClick={submit}
              disabled={!canSend}
              className='rounded-full bg-[#f08fb0] px-7 py-2.5 text-sm font-black tracking-wider text-[#2b1420] shadow-[0_3px_0_#b85b7d] transition-[transform,box-shadow,opacity] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-40 disabled:shadow-none'
            >
              KIRIM KATA
            </button>
            <button
              type='button'
              onClick={() => update({ ids: [], fills: {}, meaning: '' })}
              disabled={ids.length === 0}
              className='rounded-full border-2 border-line-strong px-4 py-2 text-sm font-semibold text-[var(--mute)] hover:border-[var(--mute)] disabled:opacity-40'
            >
              Bersihkan
            </button>
            {cfg.replacement && (
              <button
                type='button'
                onClick={() => void r.move({ type: 'replace', card: ids[0] })}
                disabled={
                  !playing ||
                  r.busy ||
                  ids.length !== 1 ||
                  pool.get(ids[0])?.from !== 'hand' ||
                  view.replacementsLeft <= 0
                }
                className='rounded-full border-2 border-line-strong px-4 py-2 text-sm font-semibold text-[var(--mute)] hover:border-[var(--mute)] disabled:opacity-40'
              >
                Tukar kartu ({view.replacementsLeft})
              </button>
            )}
          </div>
          {view.cooling && (
            <p className='mt-2 text-center text-xs text-[#f7dc6a]'>
              Tunggu pemain lain menyusun kata dulu.
            </p>
          )}
          {r.error && !view.over && (
            <p className='mt-2 text-center text-sm text-err' role='alert'>
              {r.error}
            </p>
          )}
        </section>

        {/* ------------------------------------------------------ hand */}
        <section aria-label='Kartumu'>
          <div className='mb-1.5 flex items-baseline justify-between'>
            <h2 className='text-sm font-bold'>
              Kartumu{' '}
              <span className='font-normal text-[var(--mute)]'>
                ({view.hand.length} sisa)
              </span>
            </h2>
            {point && (
              <span className='text-sm font-bold text-[#f08fb0]'>
                {view.scores[you]} poin
              </span>
            )}
          </div>
          {out && !view.over && (
            <p className='mb-2 rounded-xl bg-[#7cc576]/15 px-3 py-2 text-center text-sm font-medium text-[#7cc576]'>
              {view.places.includes(you)
                ? 'Kartumu habis, kamu aman! Menonton yang lain…'
                : 'Kamu sudah keluar dari permainan.'}
            </p>
          )}
          <div
            data-testid='hand'
            className='flex flex-wrap justify-center gap-2 pt-2 pb-1'
          >
            {view.hand.map((card) => (
              <SekataCard
                key={card.id}
                card={card}
                selected={ids.includes(card.id)}
                order={
                  ids.includes(card.id) ? ids.indexOf(card.id) + 1 : undefined
                }
                onClick={playing ? () => tap(card.id) : undefined}
                draggable={playing}
                onDragStart={(e) => {
                  dragId.current = card.id;
                  e.dataTransfer.setData('text/plain', card.id);
                }}
                className={ids.includes(card.id) ? 'opacity-60' : 'a-deal'}
              />
            ))}
            {view.hand.length === 0 && (
              <span className='py-6 text-sm text-[var(--mute)]'>
                Tidak ada kartu
              </span>
            )}
          </div>
          {view.greens.length > 0 && (
            <div className='mt-3'>
              <p className='mb-1.5 text-center text-[11px] font-bold tracking-widest text-[var(--mute)] uppercase'>
                Kartu hijau (joker pribadi)
              </p>
              <div
                data-testid='greens'
                className='flex flex-wrap justify-center gap-2'
              >
                {view.greens.map((card) => (
                  <SekataCard
                    key={card.id}
                    card={card}
                    size='sm'
                    selected={ids.includes(card.id)}
                    order={
                      ids.includes(card.id)
                        ? ids.indexOf(card.id) + 1
                        : undefined
                    }
                    onClick={playing ? () => tap(card.id) : undefined}
                    draggable={playing}
                    onDragStart={(e) => {
                      dragId.current = card.id;
                      e.dataTransfer.setData('text/plain', card.id);
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ------------------------------------------------------ history */}
      <section aria-label='Riwayat kata' className='mt-4'>
        <h2 className='mb-2 text-sm font-semibold'>Kata terbaru</h2>
        {recent.length === 0 && (
          <p className='text-sm text-[var(--mute)]'>
            Belum ada kata. Jadilah yang pertama!
          </p>
        )}
        <ul className='space-y-2'>
          {recent.map((w) => (
            <li
              key={w.n}
              data-status={w.status}
              className={`a-slide-up flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3 py-2 text-sm ${
                w.status === 'ok'
                  ? 'border-line bg-surface/50'
                  : w.status === 'review'
                    ? 'border-[#f7dc6a]/50 bg-[#f7dc6a]/5'
                    : 'border-err/40 bg-err/5 opacity-80'
              }`}
            >
              <Avatar seat={w.seat} name={names[w.seat] || 'P'} size='size-6' />
              <span className='text-[var(--mute)]'>{nameOf(w.seat)}</span>
              <Parts parts={w.parts} />
              <b
                className={`tracking-widest uppercase ${
                  w.status === 'invalid' || w.status === 'void'
                    ? 'line-through'
                    : ''
                }`}
              >
                {w.word}
              </b>
              {w.status === 'ok' && (
                <span className='text-xs text-[#7cc576]'>+{w.points}</span>
              )}
              {w.status === 'review' && (
                <span className={chip('bg-[#f7dc6a]/30 text-[#f7dc6a]')}>
                  {w.challengedBy.length ? 'ditantang' : 'ditinjau'}
                </span>
              )}
              {(w.status === 'invalid' || w.status === 'void') && (
                <span className='text-xs text-err'>{w.reason}</span>
              )}
              {w.meaning && (
                <span className='basis-full text-xs text-[var(--mute)]'>
                  “{w.meaning}”
                </span>
              )}
              {w.canChallenge && (
                <button
                  type='button'
                  onClick={() => void r.move({ type: 'challenge', n: w.n })}
                  disabled={r.busy}
                  className='ml-auto text-xs text-[var(--mute)] underline-offset-2 hover:text-err hover:underline'
                >
                  Tantang
                </button>
              )}
            </li>
          ))}
        </ul>
        {view.feed.length > 0 && (
          <ul
            aria-label='Kejadian'
            className='mt-3 space-y-0.5 text-xs text-[var(--mute)]'
          >
            {[...view.feed]
              .reverse()
              .slice(0, 4)
              .map((f) => (
                <li key={f.n}>
                  {f.seat !== null ? `${nameOf(f.seat)}: ` : ''}
                  {f.text}
                </li>
              ))}
          </ul>
        )}
      </section>

      {/* ----------------------------------------------------- results */}
      {view.over && <Results r={r} view={view} />}
    </div>
  );
}

function Results({ r, view }: { r: Api; view: SekataView }) {
  const room = r.room as RoomView;
  const you = r.session!.you;
  const cfg = view.config;
  const name = (seat: number) => seatLabel(seat, you, room.names);
  const secs = view.elapsed;
  const why: Record<NonNullable<SekataView['endReason']>, string> = {
    finished: 'Kartu habis!',
    time: 'Waktu habis!',
    last: 'Tinggal satu pemain yang masih punya kartu.',
    empty: 'Tumpukan kartu habis.',
    left: 'Pemain lain keluar dari permainan.',
  };
  const medal = ['🥇', '🥈', '🥉'];
  return (
    <div
      role='dialog'
      aria-label='Hasil permainan'
      className='fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm'
    >
      <div className='a-pop my-auto w-full max-w-md rounded-3xl border border-line-strong bg-card p-6 text-ink shadow-2xl'>
        <p className='text-center text-xs font-bold tracking-widest text-[var(--mute)] uppercase'>
          {view.endReason ? why[view.endReason] : 'Selesai'}
        </p>
        <h2 className='mt-1 text-center text-3xl font-black text-[#f08fb0]'>
          {view.loser === you
            ? 'Kamu kalah'
            : view.winner === you
              ? 'Kamu menang!'
              : view.winner !== null
                ? `${name(view.winner)} menang`
                : 'Selesai'}
        </h2>
        {view.loser !== null && view.loser !== you && (
          <p className='text-center text-sm text-[var(--mute)]'>
            {name(view.loser)} kalah
          </p>
        )}
        <p className='mt-1 text-center text-xs text-[var(--mute)]'>
          {MODE_INFO[cfg.mode].title} · {mmss(secs)}
        </p>

        <table className='mt-4 w-full text-sm'>
          <thead>
            <tr className='text-left text-[11px] tracking-wide text-[var(--mute)] uppercase'>
              <th className='py-1 font-semibold'>#</th>
              <th className='font-semibold'>Pemain</th>
              <th className='text-right font-semibold'>Kata</th>
              <th className='text-right font-semibold'>Kartu</th>
              <th className='text-right font-semibold'>Salah</th>
              <th className='text-right font-semibold'>
                {cfg.mode === 'point' ? 'Poin' : 'Sisa'}
              </th>
            </tr>
          </thead>
          <tbody>
            {view.ranking.map((seat, i) => (
              <tr
                key={seat}
                className={`border-t border-line ${
                  seat === you ? 'font-bold' : ''
                }`}
              >
                <td className='py-1.5'>{medal[i] ?? i + 1}</td>
                <td className='max-w-28 truncate'>
                  {name(seat)}
                  {view.dropped.includes(seat) && (
                    <span className='ml-1 text-xs text-err'>(keluar)</span>
                  )}
                </td>
                <td className='text-right tabular-nums'>
                  {view.stats[seat].words}
                </td>
                <td className='text-right tabular-nums'>
                  {view.stats[seat].cards}
                </td>
                <td className='text-right tabular-nums'>
                  {view.stats[seat].invalid}
                </td>
                <td className='text-right tabular-nums'>
                  {cfg.mode === 'point' ? view.scores[seat] : view.counts[seat]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className='mt-5 flex flex-wrap justify-center gap-2'>
          <button
            type='button'
            onClick={r.rematch}
            disabled={r.busy}
            className='rounded-full bg-[#f08fb0] px-6 py-2.5 text-sm font-black text-[#2b1420] shadow-[0_3px_0_#b85b7d] disabled:opacity-50'
          >
            Main lagi
          </button>
          <button
            type='button'
            onClick={r.leave}
            className='rounded-full border-2 border-line-strong px-5 py-2.5 text-sm font-semibold text-[var(--mute)] hover:border-[var(--mute)]'
          >
            Kembali ke lobi
          </button>
          <a
            href='/games'
            className='rounded-full border-2 border-line-strong px-5 py-2.5 text-sm font-semibold text-[var(--mute)] hover:border-[var(--mute)]'
          >
            Keluar game
          </a>
        </div>
      </div>
    </div>
  );
}
