'use client';

import * as React from 'react';

import styles from './HongKongTable.module.css';

import type { Play, TableView } from '@/lib/games/hk-mahjong/game';
import { tileLabel } from '@/lib/games/hk-mahjong/rules';
import {
  meldTiles,
  TILE_CODES,
  WIND_NAMES,
} from '@/lib/games/hk-mahjong/score';

import { useRemainingMs } from '@/components/games/Countdown';
import TileFace from '@/components/games/mahjong/TileFace';
import { seatLabel } from '@/components/games/RoomGate';

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
function actionLabel(action: Play) {
  if (action.type === 'chow') return 'Chow';
  if (action.type === 'kong') return 'Kong';
  if (action.type === 'add') return 'Tambah kong';
  return {
    win: 'Mahjong!',
    pass: 'Lewati',
    pong: 'Pong',
    next: 'Bagikan tangan berikutnya',
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
}: {
  v: TableView;
  you: number;
  names: (string | null)[];
  busy: boolean;
  turnDeadline?: number | null;
  onPlay: (move: Play & { revision: number }) => void;
}) {
  const [pick, setPick] = React.useState<{
    index: number;
    revision: number;
  } | null>(null);
  const selected = pick?.revision === v.revision ? pick.index : null;
  const play = (move: Play) => onPlay({ ...move, revision: v.revision });
  const label = (seat: number) => seatLabel(seat, you, names);
  const spectating = you < 0;
  const facing = spectating ? 0 : you;
  const wind = (i: number) => (i - v.dealer + 4) % 4;
  const mayDiscard = v.actions.some((a) => a.type === 'discard');
  const actions = v.actions.filter(
    (a) => a.type !== 'discard' && a.type !== 'next',
  );
  const hand = [...v.hand];
  // Offset the tile that just arrived from the sorted rack, as on a real table.
  if (v.drawn !== null) {
    hand.splice(hand.indexOf(v.drawn), 1);
    hand.push(v.drawn);
  }
  const result = v.result;
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
    return (
      <section
        key={seat}
        className={styles.seat}
        data-position={['self', 'right', 'across', 'left'][offset]}
        aria-label={`${label(seat)}, ${WIND_NAMES[wind(seat)]}`}
      >
        <div className={styles.seatHead} data-active={active}>
          <span className={styles.wind} title={WIND_NAMES[wind(seat)]}>
            {WIND_GLYPHS[wind(seat)]}
          </span>
          <div>
            <strong>{label(seat)}</strong>
            <small>
              {WIND_NAMES[wind(seat)]} · {v.scores[seat]} poin
            </small>
          </div>
        </div>
        {(spectating || offset !== 0) && (
          <div className={styles.backs} aria-label={`${p.count} ubin tertutup`}>
            {Array.from({ length: p.count }, (_, i) => (
              <i key={i} />
            ))}
          </div>
        )}
        {(p.melds.length > 0 || p.flowers.length > 0) && (
          <div className={styles.exposed} aria-label='Set dan bunga'>
            {p.melds.map((m, i) => (
              <span key={i} title={m.concealed ? 'Kong tertutup' : m.kind}>
                {meldTiles(m).map((t, j) => (
                  <Tile key={j} tile={t} />
                ))}
              </span>
            ))}
            {p.flowers.map((t) => (
              <Tile key={t} tile={t} />
            ))}
          </div>
        )}
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
      {!spectating && (
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
                    : result
                      ? 'Tangan selesai'
                      : 'Menunggu giliran'}
            </span>
          </div>
          <div className={styles.rack} aria-label='Ubin kamu'>
            {hand.map((tile, i) => (
              <button
                key={i}
                type='button'
                aria-label={`Pilih ${tileLabel(tile)}`}
                aria-pressed={i === selected}
                disabled={busy || !mayDiscard}
                data-drawn={v.drawn !== null && i === hand.length - 1}
                onClick={() => setPick({ index: i, revision: v.revision })}
              >
                <Tile tile={tile} />
              </button>
            ))}
          </div>
          {(mayDiscard || actions.length > 0) && (
            <div className={styles.actions}>
              {mayDiscard && (
                <button
                  type='button'
                  disabled={busy || selected === null}
                  onClick={() =>
                    selected !== null &&
                    play({ type: 'discard', tile: hand[selected] })
                  }
                >
                  Buang {selected !== null ? tileLabel(hand[selected]) : 'ubin'}
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
        <section className={styles.result} aria-label='Hasil tangan'>
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
              <div className={styles.winningHand}>
                {[
                  ...v.players[result.seat!].melds.flatMap(meldTiles),
                  ...(v.players[result.seat!].revealed ?? []),
                ].map((t, i) => (
                  <Tile key={i} tile={t} />
                ))}
              </div>
            </>
          )}
          {result.kind === 'left' && (
            <p>
              {label(result.seat!)} meninggalkan meja. Tangan ini berakhir tanpa
              perpindahan poin.
            </p>
          )}
          <ul>
            {v.scores.map((score, i) => (
              <li key={i}>
                {label(i)} <strong>{score} poin</strong> (
                {result.deltas[i] > 0 ? '+' : ''}
                {result.deltas[i]})
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
          {v.actions.some((a) => a.type === 'next') && (
            <button
              type='button'
              disabled={busy}
              onClick={() => play({ type: 'next' })}
            >
              Bagikan tangan berikutnya →
            </button>
          )}
        </section>
      )}
    </article>
  );
}
