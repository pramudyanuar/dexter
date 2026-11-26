'use client';

import { RotateCw, Shuffle, Trash2 } from 'lucide-react';
import * as React from 'react';

import {
  BattleshipView,
  canPlaceShip,
  FLEET,
  isSunk,
  randomFleet,
  Ship,
  shipCells,
  Shot,
  SIZE,
} from '@/lib/games/battleship';
import { useRoom } from '@/lib/rooms/useRoom';
import useMounted from '@/lib/useMounted';

import Confetti from '@/components/games/Confetti';
import GameShell from '@/components/games/GameShell';
import RoomChat from '@/components/games/RoomChat';
import RoomGate, { Rematch } from '@/components/games/RoomGate';

type Kind = 'water' | 'miss' | 'hit' | 'ship' | 'sunk';

const cellKey = (x: number, y: number) => `${x},${y}`;

function Board({
  label,
  ships,
  shots,
  onPick,
  onPreview,
  preview,
  last,
}: {
  label: string;
  ships?: Ship[] | null;
  shots: Shot[];
  onPick?: (x: number, y: number) => void;
  onPreview?: (x: number, y: number) => void;
  preview?: { ship: Ship; valid: boolean } | null;
  last?: { x: number; y: number; sunk: number } | null;
}) {
  const shipSet = new Set(
    (ships ?? []).flatMap(shipCells).map((c) => cellKey(c.x, c.y)),
  );
  const sunkSet = new Set(
    (ships ?? [])
      .filter((ship) => isSunk(ship, shots))
      .flatMap(shipCells)
      .map((c) => cellKey(c.x, c.y)),
  );
  const previewSet = new Set(
    preview ? shipCells(preview.ship).map((c) => cellKey(c.x, c.y)) : [],
  );
  const shotMap = new Map(shots.map((s) => [cellKey(s.x, s.y), s]));

  return (
    <div className='min-w-0 flex-1'>
      <p className='mb-1 text-center text-xs text-mute'>{label}</p>
      <div
        role='grid'
        aria-label={label}
        className='relative grid aspect-square w-full gap-px overflow-hidden rounded-lg border border-line-strong bg-line shadow-md'
        style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: SIZE * SIZE }, (_, i) => {
          const x = i % SIZE;
          const y = Math.floor(i / SIZE);
          const k = cellKey(x, y);
          const shot = shotMap.get(k);
          let kind: Kind = 'water';
          if (sunkSet.has(k)) kind = 'sunk';
          else if (shot) kind = shot.hit ? 'hit' : 'miss';
          else if (shipSet.has(k)) kind = 'ship';
          const isLast = last?.x === x && last?.y === y;
          const interactive = !!onPick && !shot;
          const previewed = previewSet.has(k);

          return (
            <button
              key={k}
              type='button'
              role='gridcell'
              data-kind={kind}
              data-x={x}
              data-y={y}
              aria-label={`${String.fromCharCode(65 + x)}${y + 1}${kind === 'water' ? '' : `, ${{ hit: 'kena', miss: 'meleset', ship: 'kapal', sunk: 'tenggelam' }[kind]}`}`}
              disabled={!interactive}
              onClick={() => onPick?.(x, y)}
              onPointerEnter={() => onPreview?.(x, y)}
              onFocus={() => onPreview?.(x, y)}
              className={`relative flex aspect-square items-center justify-center text-[10px] leading-none transition-colors ${
                previewed
                  ? preview?.valid
                    ? 'bg-accent/35'
                    : 'bg-err/40'
                  : kind === 'sunk' || kind === 'hit'
                    ? 'bg-err/15'
                    : 'bg-surface enabled:hover:bg-card'
              } ${interactive ? 'cursor-crosshair focus-visible:z-20 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent' : 'cursor-default'}`}
            >
              {kind === 'miss' && (
                <span className='a-pop z-10 block size-1.5 rounded-full bg-ink/60' />
              )}
              {(kind === 'hit' || kind === 'sunk') && (
                <span
                  aria-hidden='true'
                  className={`${isLast ? 'a-reveal' : ''} z-10 block size-2 rotate-45 rounded-[1px] ${kind === 'sunk' ? 'bg-ink' : 'bg-err'}`}
                />
              )}
              {isLast && (
                <span className='a-boom pointer-events-none absolute inset-0 z-20 rounded-full border-2 border-hash' />
              )}
            </button>
          );
        })}
        {ships?.map((ship) => {
          const sunk = isSunk(ship, shots);
          const sinking =
            sunk &&
            !!last?.sunk &&
            shipCells(ship).some(({ x, y }) => x === last.x && y === last.y);
          return (
            <span
              key={`${ship.x}-${ship.y}-${ship.horizontal}-${sunk}`}
              aria-hidden='true'
              className={`pointer-events-none absolute inset-[2px] rounded-md border ${
                sunk ? 'border-err bg-err/65' : 'border-info/50 bg-info/25'
              } ${sinking ? 'a-reveal' : 'motion-safe:animate-[g-fade_200ms_var(--ease)_both]'}`}
              style={{
                gridColumn: `${ship.x + 1} / span ${ship.horizontal ? ship.len : 1}`,
                gridRow: `${ship.y + 1} / span ${ship.horizontal ? 1 : ship.len}`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function Placing({
  onReady,
  busy,
  locked,
}: {
  onReady: (ships: Ship[]) => void;
  busy: boolean;
  locked: Ship[] | null;
}) {
  const empty = () => FLEET.map((): Ship | null => null);
  const [draft, setDraft] = React.useState(empty);
  const [selected, choose] = React.useState(0);
  const [horizontal, setHorizontal] = React.useState(true);
  const [hovered, setHovered] = React.useState<{ x: number; y: number } | null>(
    null,
  );
  const [error, setError] = React.useState('');
  const [spin, setSpin] = React.useState(0);
  const fleet = locked ?? draft.filter((ship) => ship !== null);
  const others = draft.filter(
    (ship, i): ship is Ship => ship !== null && i !== selected,
  );
  const previewShip = hovered && {
    ...hovered,
    len: FLEET[selected],
    horizontal,
  };
  const rotate = () => {
    const direction = !horizontal;
    setHorizontal(direction);
    setError('');
    const current = draft[selected];
    if (!current) return;
    const turned = { ...current, horizontal: direction };
    if (canPlaceShip(turned, others)) {
      setDraft(draft.map((ship, i) => (i === selected ? turned : ship)));
    } else {
      setError('Pilih petak yang muat untuk arah ini.');
    }
  };
  const place = (x: number, y: number) => {
    const ship = { x, y, len: FLEET[selected], horizontal };
    if (!canPlaceShip(ship, others)) {
      setError('Kapal bertumpuk atau melewati batas papan.');
      return;
    }
    const next = draft.map((current, i) => (i === selected ? ship : current));
    const emptySlot = next.indexOf(null);
    setDraft(next);
    setError('');
    setHovered(null);
    if (emptySlot !== -1) choose(emptySlot);
  };

  return (
    <>
      <p className='mb-3 text-center text-sm'>
        {locked ? (
          <span className='a-bob inline-block text-mute'>
            Armadamu siap. Menunggu lawan menyusun kapal…
          </span>
        ) : (
          'Pilih kapal, lalu pilih petak awal di papan.'
        )}
      </p>
      {!locked && (
        <div
          className='mb-3 flex flex-wrap justify-center gap-2'
          role='group'
          aria-label='Pilih kapal'
        >
          {FLEET.map((len, i) => (
            <button
              key={i}
              type='button'
              aria-pressed={selected === i}
              aria-label={`Kapal ${i + 1}, ${len} petak${draft[i] ? ', terpasang' : ''}`}
              onClick={() => {
                choose(i);
                setHovered(null);
                setError('');
                setHorizontal(draft[i]?.horizontal ?? true);
              }}
              className={`min-h-10 min-w-11 rounded-lg border px-2 text-xs ${selected === i ? 'border-accent bg-accent/15 text-accent' : 'border-line-strong bg-card text-ink'}`}
            >
              {len} {draft[i] && <span aria-hidden='true'>✓</span>}
            </button>
          ))}
          <button
            type='button'
            onClick={rotate}
            aria-label={`Putar kapal, ${horizontal ? 'mendatar' : 'menurun'}`}
            className='flex min-h-10 items-center gap-1.5 rounded-lg border border-line-strong bg-card px-2 text-xs hover:border-mute'
          >
            <RotateCw size={14} aria-hidden='true' /> Putar ·{' '}
            {horizontal ? 'Mendatar' : 'Menurun'}
          </button>
        </div>
      )}
      <div
        key={spin}
        onPointerLeave={() => setHovered(null)}
        className='a-fade mx-auto w-full max-w-sm'
      >
        <Board
          label='armadamu'
          ships={fleet}
          shots={[]}
          onPick={locked || busy ? undefined : place}
          onPreview={
            locked || busy ? undefined : (x, y) => setHovered({ x, y })
          }
          preview={
            previewShip && !locked
              ? { ship: previewShip, valid: canPlaceShip(previewShip, others) }
              : null
          }
        />
      </div>
      {!locked && (
        <>
          <p
            aria-live='polite'
            className='mt-2 min-h-5 text-center text-xs text-mute'
          >
            {error ? (
              <span className='text-err'>{error}</span>
            ) : (
              `${fleet.length}/${FLEET.length} kapal terpasang`
            )}
          </p>
          <div className='mt-3 flex flex-wrap justify-center gap-2 text-sm'>
            <button
              type='button'
              onClick={() => {
                const preset = randomFleet();
                setDraft(preset);
                choose(0);
                setHorizontal(preset[0].horizontal);
                setHovered(null);
                setError('');
                setSpin((n) => n + 1);
              }}
              disabled={busy}
              className='flex min-h-10 items-center gap-1.5 rounded-lg border border-line-strong bg-card px-3 hover:border-mute disabled:opacity-40'
            >
              <Shuffle size={15} aria-hidden='true' /> Acak armada
            </button>
            <button
              type='button'
              disabled={busy || !fleet.length}
              onClick={() => {
                setDraft(empty());
                choose(0);
                setHorizontal(true);
                setHovered(null);
                setError('');
              }}
              className='flex min-h-10 items-center gap-1.5 rounded-lg border border-line-strong bg-card px-3 hover:border-mute disabled:opacity-40'
            >
              <Trash2 size={15} aria-hidden='true' /> Kosongkan
            </button>
            <button
              type='button'
              disabled={busy || fleet.length !== FLEET.length}
              onClick={() => onReady(fleet)}
              className='text-info'
            >
              Siap tempur
            </button>
          </div>
        </>
      )}
    </>
  );
}

function Battleship() {
  const r = useRoom<BattleshipView>('battleship');

  return (
    <RoomGate
      r={r}
      blurb='# Battleship untuk dua pemain di device berbeda. Susun armada rahasia, lalu tembak bergantian sampai semua kapal lawan tenggelam.'
    >
      {({ room, you }) => {
        const v = room.state;
        const over = v.winner !== null;

        if (v.phase === 'placing') {
          return (
            <Placing
              busy={r.busy}
              locked={v.mine}
              onReady={(ships) => r.move({ type: 'place', ships })}
            />
          );
        }

        const myTurn = !over && v.turn === you;
        const last = v.last;
        const lastText = last
          ? `${last.seat === you ? 'Tembakanmu' : 'Tembakan lawan'} ${
              last.sunk
                ? `menenggelamkan kapal (${last.sunk} petak)!`
                : last.hit
                  ? 'kena!'
                  : 'meleset.'
            }`
          : '';

        return (
          <>
            {over && v.winner === you && <Confetti />}
            <p
              key={`${v.turn}-${v.winner}`}
              className='a-slide-up mb-1 text-center text-sm'
              aria-live='polite'
            >
              {over ? (
                v.winner === you ? (
                  <span className='text-accent'>
                    Armada lawan tenggelam. Kamu menang!
                  </span>
                ) : (
                  <span className='text-err'>
                    Armadamu tenggelam. Kamu kalah.
                  </span>
                )
              ) : myTurn ? (
                <span className='text-accent'>Giliranmu, tembak!</span>
              ) : (
                <span className='text-mute'>Lawan membidik…</span>
              )}
            </p>
            <p
              key={`${last?.seat}-${last?.x}-${last?.y}`}
              className={`a-pop mb-3 min-h-4 text-center text-xs ${last?.hit ? 'text-hash' : 'text-mute'}`}
              data-testid='last-shot'
            >
              {lastText}
            </p>

            <div className='flex flex-col gap-4 sm:flex-row'>
              <Board
                label='perairan lawan'
                shots={v.myShots}
                ships={v.revealed}
                onPick={
                  myTurn && !r.busy
                    ? (x, y) => r.move({ type: 'fire', x, y })
                    : undefined
                }
                last={last?.seat === you ? last : null}
              />
              <Board
                label='armadamu'
                ships={v.mine}
                shots={v.incoming}
                last={last && last.seat !== you ? last : null}
              />
            </div>

            {over && <Rematch r={r} />}
            <p className='mt-auto pt-4 text-center text-xs text-mute'>
              Klik petak di perairan lawan untuk menembak. Room hilang sendiri
              setelah 2 jam.
            </p>
          </>
        );
      }}
    </RoomGate>
  );
}

export default function BattleshipPage() {
  const mounted = useMounted();

  return (
    <GameShell name='battleship' wide>
      {mounted ? (
        <>
          <Battleship />
          <RoomChat game='battleship' />
        </>
      ) : null}
    </GameShell>
  );
}
