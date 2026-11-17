'use client';

import Link from 'next/link';
import * as React from 'react';

import { LeaderboardEntry, scoreUnit } from '@/lib/leaderboard/types';

import GameShell from '@/components/games/GameShell';

import { GAMES } from '@/constant/games';

export default function LeaderboardPage() {
  const [selectedGame, setSelectedGame] = React.useState<string>('2048');
  const [entries, setEntries] = React.useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const g = params.get('game');
      if (g && GAMES.some((item) => item.id === g)) {
        setSelectedGame(g);
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const load = React.useCallback(async (game: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/leaderboard?game=${encodeURIComponent(game)}`,
        { cache: 'no-store' },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setEntries(Array.isArray(data.entries) ? data.entries : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat leaderboard');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const t = setTimeout(() => load(selectedGame), 0);
    return () => clearTimeout(t);
  }, [selectedGame, load]);

  const currentGame = GAMES.find((g) => g.id === selectedGame) ?? GAMES[0];
  const unit = scoreUnit(selectedGame);

  return (
    <GameShell menu>
      <div className='mx-auto w-full max-w-4xl'>
        <div className='mb-6 flex flex-wrap items-center justify-between gap-3'>
          <div>
            <Link
              href='/games'
              className='text-xs text-[var(--mute)] hover:text-ink'
            >
              ← Kembali ke Games
            </Link>
            <h1 className='mt-1 text-2xl font-semibold tracking-tight'>
              Leaderboard
            </h1>
            <p className='mt-0.5 text-sm text-[var(--mute)]'>
              Papan peringkat 20 skor terbaik per game.
            </p>
          </div>

          <Link
            href={currentGame.href}
            className='rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-paper transition hover:opacity-90'
          >
            Main {currentGame.title} →
          </Link>
        </div>

        {/* Game selector */}
        <div className='mb-6 flex flex-wrap gap-1.5'>
          {GAMES.map((g) => (
            <button
              key={g.id}
              type='button'
              onClick={() => {
                setSelectedGame(g.id);
                window.history.replaceState(
                  null,
                  '',
                  `/games/leaderboard?game=${encodeURIComponent(g.id)}`,
                );
              }}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                selectedGame === g.id
                  ? 'border-transparent bg-ink text-paper'
                  : 'border-line-strong text-[var(--mute)] hover:text-ink'
              }`}
            >
              {g.title}
            </button>
          ))}
        </div>

        {error && (
          <div className='mb-4 rounded-xl border border-err/40 bg-err/10 px-4 py-2.5 text-sm text-err'>
            {error}
          </div>
        )}

        <div className='overflow-hidden rounded-xl border border-line bg-surface/50'>
          <div className='flex items-center justify-between border-b border-line px-4 py-3'>
            <span className='font-medium text-ink'>{currentGame.title}</span>
            <button
              type='button'
              onClick={() => load(selectedGame)}
              className='text-xs text-[var(--mute)] hover:text-ink'
            >
              {loading ? 'Memuat...' : 'Segarkan'}
            </button>
          </div>

          {entries.length === 0 ? (
            <div className='py-12 text-center text-sm text-[var(--mute)]'>
              Belum ada skor tercatat untuk {currentGame.title}. Mainkan gamenya
              dan simpan skormu!
            </div>
          ) : (
            <table className='w-full text-left text-sm'>
              <thead className='border-b border-line text-xs text-[var(--mute)]'>
                <tr>
                  <th className='w-16 px-4 py-2.5 font-medium'>Rank</th>
                  <th className='px-4 py-2.5 font-medium'>Pemain</th>
                  <th className='px-4 py-2.5 font-medium'>Catatan</th>
                  <th className='px-4 py-2.5 text-right font-medium capitalize'>
                    {unit}
                  </th>
                </tr>
              </thead>
              <tbody className='divide-y divide-line'>
                {entries.map((entry, idx) => (
                  <tr key={entry.id} className='hover:bg-card/50'>
                    <td className='px-4 py-2.5 font-mono text-xs'>
                      {idx === 0 ? (
                        <span className='font-semibold text-[#e4b34a]'>#1</span>
                      ) : idx === 1 ? (
                        <span className='font-semibold text-[#c0c4cc]'>#2</span>
                      ) : idx === 2 ? (
                        <span className='font-semibold text-[#cd8a5b]'>#3</span>
                      ) : (
                        <span className='text-[var(--mute)]'>#{idx + 1}</span>
                      )}
                    </td>
                    <td className='px-4 py-2.5 font-medium text-ink'>
                      {entry.name}
                    </td>
                    <td className='px-4 py-2.5 text-xs text-[var(--mute)]'>
                      {entry.meta ?? '-'}
                    </td>
                    <td className='px-4 py-2.5 text-right font-mono font-semibold text-accent'>
                      {entry.score.toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </GameShell>
  );
}
