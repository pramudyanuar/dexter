'use client';

import Link from 'next/link';
import * as React from 'react';

import usePlayerName from '@/features/games/hooks/usePlayerName';

export default function SubmitScore({
  game,
  score,
  replay,
  label = 'Skor',
  english,
  save,
  leaderboardHref,
}: {
  game: string;
  score: number;
  replay?: unknown;
  label?: string;
  /** Show the widget's own text in English. */
  english?: boolean;
  save?: (name: string) => Promise<number | null>;
  leaderboardHref?: string;
}) {
  const tt = (id: string, en: string) => (english ? en : id);
  const [name, setName] = usePlayerName();
  const [saving, setSaving] = React.useState(false);
  const [rank, setRank] = React.useState<number | null>(null);
  const [submittedScore, setSubmittedScore] = React.useState<number | null>(
    null,
  );
  const [error, setError] = React.useState('');

  const alreadySent = submittedScore === score;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean || saving || score < 0) return;
    setSaving(true);
    setError('');
    try {
      setRank(await (save ? save(clean) : saveClassic(clean)));
      setSubmittedScore(score);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : tt('Gagal menyimpan skor', 'Could not save the score'),
      );
    } finally {
      setSaving(false);
    }
  };

  async function saveClassic(name: string): Promise<number | null> {
    const res = await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        game,
        name,
        replay,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
    return data.rank ?? null;
  }

  if (alreadySent) {
    return (
      <div className='mt-2 flex flex-wrap items-center justify-center gap-2 text-xs text-accent'>
        <span role='status'>
          {rank === null
            ? tt('Skor di luar 20 besar.', 'Score is outside the top 20.')
            : `${tt('Tersimpan di peringkat', 'Saved at rank')} #${rank}!`}
        </span>
        <Link
          href={
            leaderboardHref ??
            `/games/leaderboard?game=${encodeURIComponent(game)}`
          }
          className='underline underline-offset-2'
        >
          {tt('Lihat Leaderboard', 'View Leaderboard')} →
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
        placeholder={tt('Namamu...', 'Your name...')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className='w-32 rounded-lg border border-line-strong bg-paper px-2.5 py-1 text-xs text-ink placeholder:text-[var(--mute)] focus:border-accent focus:outline-none'
      />
      <button
        type='submit'
        disabled={saving || !name.trim()}
        className='rounded-lg bg-ink px-3 py-1 text-xs font-medium text-paper transition hover:opacity-90 disabled:opacity-40'
      >
        {saving
          ? tt('Menyimpan...', 'Saving...')
          : english
            ? `${label} (${score})`
            : `Simpan ${label} (${score})`}
      </button>
      {error && (
        <span className='w-full text-center text-xs text-err'>{error}</span>
      )}
    </form>
  );
}
