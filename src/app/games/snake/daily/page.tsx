'use client';

import * as React from 'react';

import {
  DAILY_DURATION_MS,
  DailyChallenge,
  dailyChallenge,
  SnakeReplay,
} from '@/lib/games/snake-daily';
import type { LeaderboardEntry } from '@/lib/leaderboard/types';
import useStoredState from '@/lib/useStoredState';

import LeaderboardTable from '@/components/games/LeaderboardTable';
import SnakeShell from '@/components/games/snake/SnakeShell';
import SnakeSolo from '@/components/games/snake/SnakeSolo';
import SubmitScore from '@/components/games/SubmitScore';

interface DailyData extends DailyChallenge {
  available: boolean;
  entries: LeaderboardEntry[];
}

async function loadDaily(signal: AbortSignal): Promise<DailyData> {
  const response = await fetch('/api/snake/daily', {
    signal,
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Peringkat Harian sedang tidak tersedia.');
  return response.json();
}

export default function SnakeDailyPage() {
  const [refresh, setRefresh] = React.useState(0);
  const [loaded, setLoaded] = React.useState<{
    refresh: number;
    data: DailyData;
  } | null>(null);
  const [best, setBest] = useStoredState<{ day: string; score: number } | null>(
    'snake-daily-best',
    null,
  );
  const [playerId, setPlayerId] = useStoredState<string | null>(
    'snake-daily-player',
    null,
  );
  const localId = React.useRef<string | null>(null);
  const data = loaded?.refresh === refresh ? loaded.data : null;

  React.useEffect(() => {
    const controller = new AbortController();
    void loadDaily(
      AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]),
    )
      .catch(() => ({ ...dailyChallenge(), available: false, entries: [] }))
      .then((data) => {
        if (!controller.signal.aborted) setLoaded({ refresh, data });
      });
    return () => controller.abort();
  }, [refresh]);

  async function save(
    name: string,
    challenge: DailyChallenge,
    replay: SnakeReplay,
  ) {
    const id = playerId ?? localId.current ?? crypto.randomUUID();
    if (!playerId) {
      localId.current = id;
      setPlayerId(id);
    }
    const response = await fetch('/api/snake/daily', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        day: challenge.day,
        version: challenge.version,
        name,
        playerId: id,
        replay,
      }),
    });
    const result = (await response.json()) as {
      day: string;
      entries: LeaderboardEntry[];
      rank: number | null;
      error?: string;
    };
    if (!response.ok)
      throw new Error(result.error ?? 'Gagal menyimpan skor Harian.');
    setLoaded((current) =>
      current && current.data.day === result.day
        ? {
            ...current,
            data: { ...current.data, entries: result.entries, available: true },
          }
        : current,
    );
    return result.rank;
  }

  return (
    <SnakeShell>
      {data ? (
        <>
          <p className='text-sm text-mute'>
            {data.day} WIB · {DAILY_DURATION_MS / 1000} detik waktu bermain
          </p>
          <SnakeSolo
            key={data.day}
            challenge={data}
            best={best?.day === data.day ? best.score : 0}
            onBest={(score) => setBest({ day: data.day, score })}
            onRestart={() => {
              if (!data.available || dailyChallenge().day !== data.day)
                setRefresh((n) => n + 1);
            }}
            resultContent={(board, replay) => (
              <SubmitScore
                game='snake'
                score={board.score}
                save={(name) => save(name, data, replay)}
                leaderboardHref='/games/snake/daily#daily-leaderboard'
              />
            )}
          />
          <section
            id='daily-leaderboard'
            className='space-y-2 rounded-lg border border-line bg-card p-4'
          >
            <h2 className='font-semibold'>Peringkat Harian</h2>
            {!data.available ? (
              <p role='status' className='text-sm text-mute'>
                Peringkat sedang tidak tersedia. Kamu masih bisa bermain.
              </p>
            ) : data.entries.length ? (
              <LeaderboardTable
                game='snake'
                entries={data.entries}
                showMeta={false}
              />
            ) : (
              <p className='text-sm text-mute'>Belum ada skor hari ini.</p>
            )}
          </section>
        </>
      ) : (
        <p role='status' className='text-mute'>
          Memuat tantangan Harian…
        </p>
      )}
    </SnakeShell>
  );
}
