'use client';

import * as React from 'react';

import {
  ARCHIVE_BASE_POINTS,
  ARCHIVE_TARGETS,
  ARCHIVE_UPGRADES,
  archiveAward,
  archiveProofPoints,
  type ArchiveRun,
  type ArchiveUpgrade,
  canUpgradeArchive,
  CONTRACTS,
  redrawArchive,
  startArchive,
  submitArchive,
  upgradeArchive,
} from '@/lib/games/card-archive';
import { POKER_HANDS } from '@/lib/games/poker';
import useStoredState from '@/lib/useStoredState';

import GameShell from '@/components/games/GameShell';
import PlayingCard from '@/components/games/remo/PlayingCard';

const primary =
  'rounded-lg bg-[#e9bb71] px-4 py-2.5 text-sm font-semibold text-[#291b0e] hover:bg-[#f6d499] disabled:opacity-40';
const secondary =
  'rounded-lg border border-[#ddc3a4]/35 px-4 py-2.5 text-sm hover:border-[#e9bb71] disabled:opacity-40';

function ScoreGuide() {
  return (
    <details className='rounded-lg border border-line p-3 text-sm'>
      <summary className='cursor-pointer font-medium'>
        Cara main dan poin kartu
      </summary>
      <p className='mt-2 text-mute'>
        Pilih 5 kartu untuk membentuk kombinasi poker. Sisihkan hingga 2 kartu
        lain sebagai bukti. Dua bukti yang cocok dengan kontrak memberi poin
        tambahan. Setelah kumpulan disimpan, kamu mendapat kartu baru jika ronde
        masih berjalan.
      </p>
      <dl className='mt-3 grid gap-1 sm:grid-cols-2 sm:gap-x-6'>
        {POKER_HANDS.map((name, i) => (
          <div key={name} className='flex justify-between gap-2'>
            <dt>{name}</dt>
            <dd className='tabular-nums'>{ARCHIVE_BASE_POINTS[i]}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

function ArchiveTable({
  run,
  onChange,
  onStart,
}: {
  run: ArchiveRun;
  onChange: (next: ArchiveRun) => void;
  onStart: () => void;
}) {
  const [mode, setMode] = React.useState<'scored' | 'proof'>('scored');
  const [selection, setSelection] = React.useState({
    scored: [] as string[],
    proof: [] as string[],
  });
  const { scored, proof } = selection;
  const target = ARCHIVE_TARGETS[run.round];
  const contract = CONTRACTS[run.contracts[run.round]];
  const preview = archiveAward(run, scored, proof);
  const next = (state: ArchiveRun) => {
    if (state === run) return;
    setSelection({ scored: [], proof: [] });
    setMode('scored');
    onChange(state);
  };
  const toggle = (card: string) => {
    const other = mode === 'scored' ? 'proof' : 'scored';
    setSelection((current) => {
      const chosen = current[mode];
      if (chosen.includes(card))
        return { ...current, [mode]: chosen.filter((id) => id !== card) };
      if (chosen.length >= (mode === 'scored' ? 5 : 2)) return current;
      return {
        ...current,
        [mode]: [...chosen, card],
        [other]: current[other].filter((id) => id !== card),
      };
    });
  };

  return (
    <section
      aria-label='Meja Arsip Kartu'
      className='rounded-2xl border border-[#725236] bg-[#241e20] p-4 text-[#fff1d8] shadow-lg sm:p-6'
    >
      <header className='flex flex-wrap items-center justify-between gap-2 border-b border-[#e9bb71]/20 pb-3'>
        <h2 className='font-semibold'>
          Ronde {run.round + 1} / {ARCHIVE_TARGETS.length}
        </h2>
        <p className='text-sm tabular-nums'>
          {run.points} / {target} poin
        </p>
        <progress
          aria-label='Kemajuan target ronde'
          className='h-2 w-full accent-[#e9bb71]'
          max={target}
          value={Math.min(run.points, target)}
        />
      </header>

      {run.phase === 'playing' ? (
        <>
          <div className='mt-4 flex flex-wrap items-start justify-between gap-3'>
            <div>
              <h3 className='text-sm font-semibold text-[#ffd690]'>
                {contract.name} · +{archiveProofPoints(run)} poin
              </h3>
              <p className='mt-1 text-sm text-[#e5d3be]'>{contract.rule}</p>
            </div>
            <p className='text-xs text-[#e5d3be]'>
              {run.attempts} pengambilan tersisa · {run.redraws} kali tukar
            </p>
          </div>
          <div
            role='group'
            aria-label='Pilih tujuan kartu'
            className='mt-4 flex flex-wrap gap-2'
          >
            <button
              type='button'
              aria-pressed={mode === 'scored'}
              onClick={() => setMode('scored')}
              className={`${secondary} aria-pressed:border-[#e9bb71] aria-pressed:bg-[#e9bb71]/15`}
            >
              Kombinasi {scored.length}/5
            </button>
            <button
              type='button'
              aria-pressed={mode === 'proof'}
              onClick={() => setMode('proof')}
              className={`${secondary} aria-pressed:border-[#c9affb] aria-pressed:bg-[#c9affb]/15`}
            >
              Bukti {proof.length}/2
            </button>
          </div>
          <div
            className='my-5 flex flex-wrap justify-center gap-x-2 gap-y-5 pt-2'
            role='group'
            aria-label='Kartu tersedia'
          >
            {run.cards.map((card) => {
              const inScored = scored.includes(card);
              const inProof = proof.includes(card);
              return (
                <div key={card} className='relative pb-4'>
                  <PlayingCard
                    id={card}
                    size='sm'
                    selected={mode === 'scored' ? inScored : inProof}
                    onClick={() => toggle(card)}
                  />
                  {(inScored || inProof) && (
                    <span
                      className={`pointer-events-none absolute inset-x-0 bottom-0 text-center text-[10px] font-semibold ${inScored ? 'text-[#ffd690]' : 'text-[#d9c5ff]'}`}
                    >
                      {inScored ? 'Kombinasi' : 'Bukti'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <p className='mb-3 text-sm' aria-live='polite'>
            {preview
              ? `${POKER_HANDS[preview.category]} · ${preview.base + preview.bonus} poin${preview.bonus ? ` (+${preview.bonus} dari bukti)` : ''}`
              : run.last
                ? `Pengambilan tadi · +${run.last.base + run.last.bonus} poin`
                : 'Pilih 5 kartu untuk melihat nilai kombinasimu.'}
          </p>
          <div className='flex flex-wrap gap-2'>
            <button
              type='button'
              className={primary}
              disabled={!preview}
              onClick={() => next(submitArchive(run, scored, proof))}
            >
              Simpan kombinasi
            </button>
            <button
              type='button'
              className={secondary}
              disabled={
                !run.redraws ||
                scored.length < 1 ||
                scored.length > 3 ||
                scored.length > run.deck.length
              }
              onClick={() => next(redrawArchive(run, scored))}
              aria-describedby='archive-exchange-help'
            >
              Tukar kartu
            </button>
          </div>
          <p id='archive-exchange-help' className='mt-2 text-xs text-[#e5d3be]'>
            Untuk menukar, pilih 1–3 kartu di bagian Kombinasi.
          </p>
        </>
      ) : run.phase === 'upgrade' ? (
        <div className='mt-4'>
          <h3 className='font-semibold'>
            Target tercapai. Pilih satu upgrade.
          </h3>
          <ul className='mt-3 grid gap-2 sm:grid-cols-3'>
            {(
              Object.entries(ARCHIVE_UPGRADES) as [
                ArchiveUpgrade,
                (typeof ARCHIVE_UPGRADES)[ArchiveUpgrade],
              ][]
            )
              .filter(([id]) => canUpgradeArchive(run, id))
              .map(([id, item]) => (
                <li key={id}>
                  <button
                    type='button'
                    className={`${secondary} h-full w-full text-left`}
                    onClick={() => next(upgradeArchive(run, id))}
                  >
                    <span className='block font-semibold text-[#ffd690]'>
                      {item.name}
                    </span>
                    <span className='mt-1 block text-xs text-[#e5d3be]'>
                      {item.description}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      ) : (
        <div className='mt-4'>
          <p role='status' className='mb-3 text-sm'>
            {run.phase === 'won'
              ? 'Ekspedisi selesai. Kelima target berhasil dicapai!'
              : 'Ekspedisi berakhir. Kesempatan habis sebelum target tercapai.'}
          </p>
          <button type='button' className={primary} onClick={onStart}>
            Ekspedisi baru
          </button>
        </div>
      )}
    </section>
  );
}

export default function CardArchivePage() {
  const [run, setRun] = useStoredState<ArchiveRun | null>(
    'card-archive-run',
    null,
    'tab',
  );
  const start = () =>
    setRun(startArchive(crypto.getRandomValues(new Uint32Array(1))[0]));

  return (
    <GameShell name='card-archive' xwide fit>
      <div className='mx-auto grid w-full max-w-3xl gap-4 pb-4'>
        <header>
          <h1 className='text-2xl font-semibold'>Arsip Kartu</h1>
          {!run && (
            <p className='mt-1 text-sm text-mute'>
              Susun koleksi poker dan sisihkan kartu sebagai bukti. Penuhi lima
              target dalam satu ekspedisi.
            </p>
          )}
        </header>
        {run ? (
          <ArchiveTable
            key={run.seed}
            run={run}
            onChange={setRun}
            onStart={start}
          />
        ) : (
          <div>
            <button type='button' className={primary} onClick={start}>
              Mulai ekspedisi
            </button>
          </div>
        )}
        <ScoreGuide />
      </div>
    </GameShell>
  );
}
