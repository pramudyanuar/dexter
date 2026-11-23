'use client';

import Link from 'next/link';
import * as React from 'react';

import type { Level } from '@/lib/games/minesweeper';
import { LEVELS } from '@/lib/games/minesweeper';
import type { LeaderboardEntry } from '@/lib/leaderboard/types';
import { isMinesLevel, VALID_GAME_IDS } from '@/lib/leaderboard/types';

import GameShell from '@/components/games/GameShell';
import LeaderboardTable from '@/components/games/LeaderboardTable';

import { GAMES } from '@/constant/games';

const rankedGames = GAMES.filter((game) => VALID_GAME_IDS.has(game.id));

export default function LeaderboardPage() {
  const [selectedGame, setSelectedGame] = React.useState<string>('2048');
  const [entries, setEntries] = React.useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [level, setLevel] = React.useState<Level>('mudah');
  const [refresh, setRefresh] = React.useState(0);

  React.useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const g = params.get('game');
      if (g && VALID_GAME_IDS.has(g)) {
        setSelectedGame(g);
      }
      const selected = params.get('level');
      if (isMinesLevel(selected)) setLevel(selected);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ game: selectedGame });
    if (selectedGame === 'minesweeper') params.set('level', level);
    const t = setTimeout(async () => {
      setLoading(true);
      setError('');
      setEntries([]);
      try {
        const res = await fetch(`/api/leaderboard?${params}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        if (!controller.signal.aborted)
          setEntries(Array.isArray(data.entries) ? data.entries : []);
      } catch (err) {
        if (!controller.signal.aborted)
          setError(
            err instanceof Error ? err.message : 'Gagal memuat leaderboard',
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 0);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [selectedGame, level, refresh]);

  const currentGame =
    rankedGames.find((g) => g.id === selectedGame) ?? rankedGames[0];
  const select = (game: string, nextLevel = level) => {
    setSelectedGame(game);
    setLevel(nextLevel);
    const params = new URLSearchParams({ game });
    if (game === 'minesweeper') params.set('level', nextLevel);
    window.history.replaceState(null, '', `/games/leaderboard?${params}`);
  };

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
          {rankedGames.map((g) => (
            <button
              key={g.id}
              type='button'
              onClick={() => select(g.id)}
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

        {selectedGame === 'minesweeper' && (
          <label className='mb-4 flex items-center gap-2 text-sm'>
            Tingkat kesulitan
            <select
              value={level}
              className='rounded-md border border-line bg-card px-2 py-1 capitalize'
              onChange={(event) => {
                const choice = event.target.value;
                if (isMinesLevel(choice)) select(selectedGame, choice);
              }}
            >
              {Object.keys(LEVELS).map((choice) => (
                <option key={choice} value={choice}>
                  {choice}
                </option>
              ))}
            </select>
          </label>
        )}

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
              onClick={() => setRefresh((value) => value + 1)}
              className='text-xs text-[var(--mute)] hover:text-ink'
            >
              {loading ? 'Memuat...' : 'Segarkan'}
            </button>
          </div>

          {loading ? (
            <p className='py-8 text-center text-sm text-mute' role='status'>
              Memuat skor…
            </p>
          ) : entries.length === 0 ? (
            <div className='py-12 text-center text-sm text-[var(--mute)]'>
              Belum ada skor tercatat untuk {currentGame.title}. Mainkan gamenya
              dan simpan skormu!
            </div>
          ) : (
            <LeaderboardTable
              game={selectedGame}
              entries={entries}
              showVerification
            />
          )}
        </div>
      </div>
    </GameShell>
  );
}
