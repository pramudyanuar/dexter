'use client';

import { ArrowLeft, ArrowRight } from 'lucide-react';
import * as React from 'react';

import styles from './HongKongTable.module.css';

import { useRemainingMs } from '@/features/games/components/Countdown';
import TileFace from '@/features/games/components/mahjong/TileFace';
import type { Play, TableView } from '@/features/games/logic/hk-mahjong/game';
import { tileLabel } from '@/features/games/logic/hk-mahjong/rules';
import {
  meldTiles,
  TILE_CODES,
  WIND_NAMES,
} from '@/features/games/logic/hk-mahjong/score';
import { seatLabel } from '@/features/rooms/components/RoomGate';

const WIND_GLYPHS = ['東', '南', '西', '北'];
function Wall({
  head,
  count,
  you,
}: {
  head: number;
  count: number;
  you: number;
}) {
  const occupied = (position: number) => (position - head + 144) % 144 < count;
  return [0, 1, 2, 3].map((offset) => {
    const seat = (you + offset) % 4;
    const start = ((4 - seat) % 4) * 36;
    return (
      <span
        key={seat}
        className={styles.wall}
        data-side={offset}
        aria-hidden='true'
      >
        {Array.from({ length: 18 }, (_, i) => {
          const pos = start + 2 * i;
          return (
            <i
              key={pos}
              data-height={Number(occupied(pos)) + Number(occupied(pos + 1))}
            />
          );
        })}
      </span>
    );
  });
}
function DecisionClock({ until, claim }: { until: number; claim: boolean }) {
  const remaining = useRemainingMs(until);
  return (
    <small>
      {Math.ceil(remaining / 1000)} dtk untuk {claim ? 'klaim' : 'giliran'}
    </small>
  );
}
function Tile({ tile }: { tile: number }) {
  return (
    <span className={styles.tile} title={tileLabel(tile)}>
      <TileFace kind={TILE_CODES[tile]} />
    </span>
  );
}
function ExposedTiles({ player }: { player: TableView['players'][number] }) {
  if (!player.melds.length && !player.flowers.length) return null;
  return (
    <div className={styles.exposed} aria-label='Set dan bunga'>
      {player.melds.map((m, i) => (
        <span key={i} title={m.concealed ? 'Kong tertutup' : m.kind}>
          {meldTiles(m).map((t, j) => (
            <Tile key={j} tile={t} />
          ))}
        </span>
      ))}
      {player.flowers.map((t) => (
        <Tile key={t} tile={t} />
      ))}
    </div>
  );
}

function rackTiles(hand: number[], drawn: number | null) {
  // Distinguish copies of a tile so reordering never moves all of them together.
  const tiles = hand.map((tile, i) => tile * 4 + i - hand.indexOf(tile));
  const drawnIndex = drawn === null ? -1 : hand.lastIndexOf(drawn);
  const drawnId = drawnIndex === -1 ? null : tiles[drawnIndex];
  if (drawnId !== null) {
    tiles.splice(drawnIndex, 1);
    tiles.push(drawnId);
  }
  return { tiles, drawnId };
}

const tileOf = (id: number) => Math.floor(id / 4);

function actionLabel(action: Play) {
  if (action.type === 'chow') return 'Chow';
  if (action.type === 'kong') return 'Kong';
  if (action.type === 'add') return 'Tambah kong';
  return {
    win: 'Mahjong!',
    pass: 'Lewati',
    pong: 'Pong',
    next: 'Siap lanjut',
    discard: 'Buang',
  }[action.type];
}
export default function HongKongTable({
  v,
  you,
  names,
  busy,
  turnDeadline,
  onPlay,
  onRematch,
  completeTable = true,
}: {
  v: TableView;
  you: number;
  names: (string | null)[];
  busy: boolean;
  turnDeadline?: number | null;
  onPlay: (move: Play & { revision: number }) => void;
  onRematch?: () => void;
  completeTable?: boolean;
}) {
  const [pick, setPick] = React.useState<{
    id: number;
    revision: number;
  } | null>(null);
  const [order, setOrder] = React.useState<{
    hand: number;
    tiles: number[];
  } | null>(null);
  const [inspect, setInspect] = React.useState<number | null>(null);
  const dragging = React.useRef<number | null>(null);
  const detailsId = React.useId();
  const play = (move: Play) => onPlay({ ...move, revision: v.revision });
  const label = (seat: number) => seatLabel(seat, you, names);
  const spectating = you < 0;
  const facing = spectating ? 0 : you;
  const wind = (i: number) => (i - v.dealer + 4) % 4;
  const mayDiscard = v.actions.some((a) => a.type === 'discard');
  const actions = v.actions.filter(
    (a) => a.type !== 'discard' && a.type !== 'next',
  );
  const { tiles, drawnId } = rackTiles(v.hand, v.drawn);
  const kept =
    order?.hand === v.number
      ? order.tiles.filter((id) => tiles.includes(id))
      : [];
  const hand = [...kept, ...tiles.filter((id) => !kept.includes(id))];
  const selected = pick?.revision === v.revision ? hand.indexOf(pick.id) : -1;
  function reorder(from: number, to: number) {
    const next = [...hand];
    const [id] = next.splice(from, 1);
    next.splice(to, 0, id);
    setOrder({ hand: v.number, tiles: next });
    setPick({ id, revision: v.revision });
  }
  const result = v.result;
  const ready = v.ready ?? [];
  const canContinue = v.actions.some((a) => a.type === 'next');
  const canVote = !spectating && completeTable && (!v.finished || !!onRematch);
  const voted = ready.includes(you);
  const deadline = v.offer?.until ?? turnDeadline;
  const status = result
    ? result.kind === 'win'
      ? `${label(result.seat!)} menang`
      : result.kind === 'draw'
        ? 'Tembok habis · seri'
        : 'Pemain keluar'
    : v.offer
      ? v.offer.rob
        ? 'Rebut kong?'
        : 'Klaim buangan'
      : mayDiscard
        ? 'Giliranmu'
        : `Giliran ${label(v.turn)}`;

  function playerArea(offset: number) {
    const seat = (facing + offset) % 4;
    const p = v.players[seat];
    const active = !result && !v.offer && seat === v.turn;
    const seatInfo = (
      <>
        <span className={styles.wind} title={WIND_NAMES[wind(seat)]}>
          {WIND_GLYPHS[wind(seat)]}
        </span>
        <span className={styles.seatName}>
          <strong>{label(seat)}</strong>
          <small>
            {WIND_NAMES[wind(seat)]} · {v.scores[seat]} poin
          </small>
        </span>
      </>
    );
    return (
      <section
        key={seat}
        className={styles.seat}
        data-position={['self', 'right', 'across', 'left'][offset]}
        aria-label={`${label(seat)}, ${WIND_NAMES[wind(seat)]}`}
      >
        {!result && seat !== you ? (
          <button
            type='button'
            className={styles.seatHead}
            data-active={active}
            aria-label={`Lihat ubin ${label(seat)}`}
            aria-expanded={inspect === seat}
            aria-controls={inspect === seat ? detailsId : undefined}
            onClick={() => setInspect(inspect === seat ? null : seat)}
          >
            {seatInfo}
          </button>
        ) : (
          <div className={styles.seatHead} data-active={active}>
            {seatInfo}
          </div>
        )}
        {!result && seat !== you && (
          <div className={styles.backs} aria-label={`${p.count} ubin tertutup`}>
            {Array.from({ length: p.count }, (_, i) => (
              <i key={i} />
            ))}
          </div>
        )}
        <ExposedTiles player={p} />
        <div className={styles.river} aria-label={`Buangan ${label(seat)}`}>
          {p.river.map((t, i) => (
            <span
              key={i}
              data-latest={
                v.lastDiscard?.seat === seat && i === p.river.length - 1
              }
            >
              <Tile tile={t} />
            </span>
          ))}
        </div>
      </section>
    );
  }
  return (
    <article className={styles.table}>
      <header className={styles.heading}>
        <div>
          <p>RONDE TIMUR · BANDAR {v.rotation + 1}/4</p>
          <h1>Mahjong Hong Kong</h1>
        </div>
        <span>Tangan {v.number}</span>
      </header>
      <div className={styles.felt}>
        {[2, 3, 1, 0].map(playerArea)}
        <div className={styles.center}>
          <Wall head={v.wallHead} count={v.wall} you={facing} />
          <div className={styles.hub}>
            {v.offer ? (
              <span className={styles.offered}>
                <Tile tile={v.offer.tile} />
              </span>
            ) : (
              <span className={styles.wallNumber}>
                {v.wall}
                <small>ubin tersisa</small>
              </span>
            )}
            <strong role='status'>{status}</strong>
            {v.offer && (
              <small>
                {label(v.offer.from)} · {v.wall} tersisa
              </small>
            )}
            {deadline != null && (
              <DecisionClock
                key={deadline}
                until={deadline}
                claim={Boolean(v.offer)}
              />
            )}
          </div>
        </div>
      </div>
      {!result && inspect !== null && (
        <section
          className={`${styles.details} motion-safe:animate-[g-slide-up_260ms_var(--ease)_both]`}
          id={detailsId}
          aria-labelledby={`${detailsId}-title`}
        >
          <h2 id={`${detailsId}-title`}>{label(inspect)}</h2>
          <p>{v.players[inspect].count} ubin tertutup</p>
          <ExposedTiles player={v.players[inspect]} />
          <div className={styles.river} aria-label='Buangan'>
            {v.players[inspect].river.map((tile, i) => (
              <Tile key={i} tile={tile} />
            ))}
          </div>
        </section>
      )}
      {!spectating && !result && (
        <div className={styles.tray}>
          <div className={styles.trayTitle}>
            <strong>Ubin kamu</strong>
            <span>
              {mayDiscard
                ? 'Pilih ubin untuk dibuang'
                : v.offer && actions.length
                  ? 'Pilih klaim atau lewati'
                  : v.offer
                    ? 'Menunggu klaim'
                    : 'Menunggu giliran'}
            </span>
          </div>
          <div className={styles.rack} aria-label='Ubin kamu'>
            {hand.map((id, i) => (
              <button
                key={id}
                type='button'
                aria-label={`Pilih ${tileLabel(tileOf(id))}`}
                aria-pressed={i === selected}
                disabled={busy}
                draggable={!busy}
                data-drawn={id === drawnId}
                onClick={() => setPick({ id, revision: v.revision })}
                onDragStart={(event) => {
                  dragging.current = id;
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', String(id));
                }}
                onDragOver={(event) => {
                  if (dragging.current === null) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const from = hand.indexOf(dragging.current ?? -1);
                  if (!busy && from !== -1 && from !== i) reorder(from, i);
                  dragging.current = null;
                }}
                onDragEnd={() => {
                  dragging.current = null;
                }}
              >
                <Tile tile={tileOf(id)} />
              </button>
            ))}
          </div>
          <div
            className={styles.rackControls}
            role='group'
            aria-label='Urutan ubin'
          >
            <button
              type='button'
              aria-label='Geser ubin ke kiri'
              disabled={busy || selected <= 0}
              onClick={() => reorder(selected, selected - 1)}
            >
              <ArrowLeft size={16} aria-hidden='true' />
            </button>
            <button
              type='button'
              disabled={!kept.length}
              onClick={() => setOrder(null)}
            >
              Urutkan
            </button>
            <button
              type='button'
              aria-label='Geser ubin ke kanan'
              disabled={busy || selected === -1 || selected === hand.length - 1}
              onClick={() => reorder(selected, selected + 1)}
            >
              <ArrowRight size={16} aria-hidden='true' />
            </button>
          </div>
          {(mayDiscard || actions.length > 0) && (
            <div className={styles.actions}>
              {mayDiscard && (
                <button
                  type='button'
                  disabled={busy || selected === -1}
                  onClick={() =>
                    selected !== -1 &&
                    play({ type: 'discard', tile: tileOf(hand[selected]) })
                  }
                >
                  Buang{' '}
                  {selected !== -1 ? tileLabel(tileOf(hand[selected])) : 'ubin'}
                </button>
              )}
              {actions.map((a) => (
                <button
                  type='button'
                  key={a.type + ('tile' in a ? a.tile : '')}
                  data-secondary={a.type === 'pass'}
                  disabled={busy}
                  onClick={() => play(a)}
                >
                  {actionLabel(a)}
                  {'tile' in a && (
                    <span className={styles.choice}>
                      {(a.type === 'chow'
                        ? [a.tile, a.tile + 1, a.tile + 2]
                        : [a.tile]
                      ).map((t) => (
                        <Tile key={t} tile={t} />
                      ))}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {result && (
        <section
          className={`${styles.result} motion-safe:animate-[g-slide-up_260ms_var(--ease)_both]`}
          aria-label='Hasil tangan'
        >
          <h2>
            {status}
            {result.score && ` · ${result.score.faan} faan`}
          </h2>
          {result.score && (
            <>
              <p>
                {result.payer === null
                  ? 'Ambil sendiri'
                  : `Dari ${label(result.payer)}`}{' '}
                ·{' '}
                {result.score.patterns
                  .map((p) => `${p.label} +${p.faan}`)
                  .join(' · ')}
              </p>
            </>
          )}
          {result.kind === 'left' && (
            <p>
              {label(result.seat!)} meninggalkan meja. Tangan ini berakhir tanpa
              perpindahan poin.
            </p>
          )}
          <ul className={styles.resultPlayers}>
            {v.players.map((player, i) => (
              <li
                key={i}
                data-winner={result.seat === i && result.kind === 'win'}
              >
                <strong>{label(i)}</strong> · {v.scores[i]} poin (
                {result.deltas[i] > 0 ? '+' : ''}
                {result.deltas[i]})
                <div
                  role='group'
                  className={styles.winningHand}
                  aria-label={`Sisa ubin ${label(i)}`}
                >
                  {player.revealed?.map((tile, j) => (
                    <Tile key={j} tile={tile} />
                  ))}
                </div>
                <ExposedTiles player={player} />
              </li>
            ))}
          </ul>
          {v.finished && result.kind !== 'left' && (
            <p>
              Pemenang ronde ·{' '}
              {v.scores
                .flatMap((n, i) =>
                  n === Math.max(...v.scores) ? [label(i)] : [],
                )
                .join(', ')}
            </p>
          )}
          {canVote && (
            <>
              <p role='status'>
                {ready.length}/4 siap. Menunggu{' '}
                {v.players
                  .flatMap((_, i) => (ready.includes(i) ? [] : [label(i)]))
                  .join(', ')}
                .
              </p>
              <button
                type='button'
                disabled={busy || voted || (!v.finished && !canContinue)}
                onClick={() =>
                  v.finished ? onRematch?.() : play({ type: 'next' })
                }
              >
                {voted
                  ? 'Sudah siap'
                  : v.finished
                    ? 'Siap main lagi'
                    : 'Siap untuk tangan berikutnya'}
              </button>
            </>
          )}
          {onRematch && !completeTable && (
            <button type='button' disabled={busy} onClick={onRematch}>
              Kembali ke lobi
            </button>
          )}
        </section>
      )}
    </article>
  );
}
