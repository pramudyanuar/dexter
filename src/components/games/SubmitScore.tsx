'use client';

import Link from 'next/link';
import * as React from 'react';

import useStoredState from '@/lib/useStoredState';

export default function SubmitScore({
  game,
  score,
  meta,
  label = 'Skor',
}: {
  game: string;
  score: number;
  meta?: string;
  label?: string;
}) {
  const [name, setName] = useStoredState<string>('dexter:player-name', '');
  const [saving, setSaving] = React.useState(false);
  const [rank, setRank] = React.useState<number | null>(null);
  const [submittedScore, setSubmittedScore] = React.useState<number | null>(
    null,
  );
  const [error, setError] = React.useState('');
  const attempt = React.useRef<{ game: string; score: number; id?: string }>(
    null,
  );

  const alreadySent = submittedScore === score;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean || saving || score < 0) return;
    setSaving(true);
    setError('');
    try {
      if (attempt.current?.score !== score || attempt.current.game !== game) {
        attempt.current = {
          game,
          score,
          id: globalThis.crypto?.randomUUID?.(),
        };
      }
      const res = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game,
          name: clean,
          score,
          meta,
          submissionId: attempt.current.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setRank(data.rank ?? null);
      setSubmittedScore(score);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan skor');
    } finally {
      setSaving(false);
    }
  };

  if (alreadySent) {
    return (
      <div className='mt-2 flex flex-wrap items-center justify-center gap-2 text-xs text-accent'>
        <span role='status'>
          {rank === null
            ? 'Skor di luar 20 besar.'
            : `Tersimpan di peringkat #${rank}!`}
        </span>
        <Link
          href={`/games/leaderboard?game=${encodeURIComponent(game)}`}
          className='underline underline-offset-2'
        >
          Lihat Leaderboard →
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className='mt-2 flex flex-wrap items-center justify-center gap-2'
    >
      <input
        type='text'
        maxLength={24}
        placeholder='Namamu...'
        value={name}
        onChange={(e) => setName(e.target.value)}
        className='w-32 rounded-lg border border-line-strong bg-paper px-2.5 py-1 text-xs text-ink placeholder:text-[var(--mute)] focus:border-accent focus:outline-none'
      />
      <button
        type='submit'
        disabled={saving || !name.trim()}
        className='rounded-lg bg-ink px-3 py-1 text-xs font-medium text-paper transition hover:opacity-90 disabled:opacity-40'
      >
        {saving ? 'Menyimpan...' : `Simpan ${label} (${score})`}
      </button>
      {error && (
        <span className='w-full text-center text-xs text-err'>{error}</span>
      )}
    </form>
  );
}
