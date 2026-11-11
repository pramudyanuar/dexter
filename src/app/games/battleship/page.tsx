'use client';

import * as React from 'react';

import {
  BattleshipView,
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
import RoomGate, { Rematch } from '@/components/games/RoomGate';

type Kind = 'water' | 'miss' | 'hit' | 'ship' | 'sunk';

const cellKey = (x: number, y: number) => `${x},${y}`;

function Board({
  label,
  ships,
  shots,
  sunk,
  onFire,
  last,
}: {
  label: string;
  ships?: Ship[] | null;
  shots: Shot[];
  /** Ships to draw even though they are not "mine" (sunk enemy ships) */
  sunk?: Ship[];
  onFire?: (x: number, y: number) => void;
  last?: { x: number; y: number } | null;
}) {
  const shipSet = new Set(
    (ships ?? []).flatMap(shipCells).map((c) => cellKey(c.x, c.y)),
  );
  const sunkSet = new Set(
    (sunk ?? []).flatMap(shipCells).map((c) => cellKey(c.x, c.y)),
  );
  const shotMap = new Map(shots.map((s) => [cellKey(s.x, s.y), s]));

  return (
    <div className='min-w-0 flex-1'>
      <p className='mb-1 text-center text-xs text-mute'>{label}</p>
      <div
        role='grid'
        aria-label={label}
        className='grid aspect-square w-full gap-px overflow-hidden rounded-md border border-line bg-info/30 shadow-md'
        style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: SIZE * SIZE }, (_, i) => {
          const x = i % SIZE;
          const y = Math.floor(i / SIZE);
          const k = cellKey(x, y);
          const shot = shotMap.get(k);
          let kind: Kind = 'water';
          if (shot) kind = shot.hit ? 'hit' : 'miss';
          else if (shipSet.has(k)) kind = 'ship';
          if (sunkSet.has(k) && kind !== 'hit') kind = 'sunk';
          const isLast = last?.x === x && last?.y === y;
          const canFire = !!onFire && !shot;

          return (
            <button
              key={`${k}-${kind}`}
              type='button'
              role='gridcell'
              data-kind={kind}
              data-x={x}
              data-y={y}
              aria-label={`${String.fromCharCode(65 + x)}${y + 1}`}
              disabled={!canFire}
              onClick={() => onFire?.(x, y)}
              className={`relative flex aspect-square items-center justify-center text-[10px] leading-none transition-colors ${
                kind === 'water'
                  ? 'bg-info/20 enabled:hover:bg-accent/40'
                  : kind === 'ship'
                    ? 'bg-mute/70'
                    : kind === 'sunk'
                      ? 'bg-err/50'
                      : kind === 'hit'
                        ? 'bg-err/40'
                        : 'bg-info/10'
              } ${canFire ? 'cursor-crosshair' : 'cursor-default'}`}
            >
              {kind === 'miss' && (
                <span className='a-pop block size-1.5 rounded-full bg-ink/60' />
              )}
              {kind === 'hit' && (
                <span
                  aria-label='kena'
                  className={`${isLast ? 'a-reveal' : ''} block size-2.5 rotate-45 bg-err`}
                  style={{
                    clipPath: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)',
                  }}
                />
              )}
              {isLast && (
                <span className='a-boom pointer-events-none absolute inset-0 rounded-full border-2 border-hash' />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Placing({
  onReady,
  busy,
  waiting,
}: {
  onReady: (ships: Ship[]) => void;
  busy: boolean;
  waiting: boolean;
}) {
  const [fleet, setFleet] = React.useState<Ship[]>(() => randomFleet());
  const [spin, setSpin] = React.useState(0);

  return (
    <>
      <p className='mb-3 text-center text-sm'>
        {waiting ? (
          <span className='a-bob inline-block text-mute'>
            Armadamu siap. Menunggu lawan menyusun kapal…
          </span>
        ) : (
          'Susun armadamu'
        )}
      </p>
      <div key={spin} className='a-fade mx-auto w-full max-w-sm'>
        <Board label='armadamu' ships={fleet} shots={[]} />
      </div>
      {!waiting && (
        <div className='mt-4 flex justify-center gap-6 text-sm'>
          <button
            type='button'
            onClick={() => {
              setFleet(randomFleet());
              setSpin((n) => n + 1);
            }}
            className='text-info hover:underline'
          >
            acak ulang
          </button>
          <button
            type='button'
            disabled={busy}
            onClick={() => onReady(fleet)}
            className='text-accent hover:underline disabled:opacity-40'
          >
            siap tempur
          </button>
        </div>
      )}
    </>
  );
}

function Battleship() {
  const r = useRoom<BattleshipView>('battleship');

  return (
    <RoomGate
      r={r}
      blurb='# Kapal perang untuk dua pemain di device berbeda. Susun armada rahasia, lalu tembak bergantian sampai semua kapal lawan tenggelam.'
    >
      {({ room, you }) => {
        const v = room.state;
        const over = v.winner !== null;

        if (v.phase === 'placing') {
          return (
            <Placing
              busy={r.busy}
              waiting={!!v.mine}
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
                sunk={v.revealed}
                onFire={
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
      {mounted ? <Battleship /> : null}
    </GameShell>
  );
}
