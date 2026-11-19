'use client';

import * as React from 'react';

import useMounted from '@/lib/useMounted';
import usePlayerName, { PLAYER_NAME_MAX } from '@/lib/usePlayerName';
import useStoredState from '@/lib/useStoredState';

/**
 * Prompts first-time visitors on `/games` to set a display name once,
 * and lets returning players view or change it from the top bar.
 */
export function PlayerNameModal({
  initialName,
  onSave,
  onClose,
}: {
  initialName: string;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = React.useState(initialName);

  const trimmed = draft.trim().slice(0, PLAYER_NAME_MAX);

  return (
    <div
      role='dialog'
      aria-labelledby='player-name-dialog-title'
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs'
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!trimmed) return;
          onSave(trimmed);
        }}
        className='w-full max-w-sm rounded-xl border border-line bg-paper p-5 shadow-2xl'
      >
        <h2
          id='player-name-dialog-title'
          className='text-base font-semibold tracking-tight text-ink'
        >
          {initialName ? 'Ubah namamu' : 'Selamat datang! Masukkan namamu'}
        </h2>
        <p className='mt-1 text-xs leading-relaxed text-[var(--mute)]'>
          Nama ini otomatis disimpan dan dipakai di semua game multiplayer
          maupun leaderboard.
        </p>

        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, PLAYER_NAME_MAX))}
          placeholder='mis. Budi'
          aria-label='Namamu'
          autoComplete='nickname'
          autoFocus
          maxLength={PLAYER_NAME_MAX}
          className='mt-4 w-full rounded-lg border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-[var(--mute)] focus:border-[var(--mute)] focus:ring-0 focus:outline-none'
        />

        <div className='mt-4 flex items-center justify-end gap-2'>
          <button
            type='button'
            onClick={onClose}
            className='rounded-lg border border-line-strong px-3.5 py-2 text-xs font-medium text-[var(--mute)] transition-colors hover:text-ink'
          >
            {initialName ? 'Batal' : 'Nanti saja'}
          </button>
          <button
            type='submit'
            disabled={!trimmed}
            className='rounded-lg bg-ink px-4 py-2 text-xs font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-40'
          >
            Simpan
          </button>
        </div>
      </form>
    </div>
  );
}

export default function PlayerNameControl({
  promptOnFirstVisit = false,
}: {
  promptOnFirstVisit?: boolean;
}) {
  const mounted = useMounted();
  const [name, setName] = usePlayerName();
  const [skipped, setSkipped] = useStoredState<boolean>(
    'player-name-skipped',
    false,
    'tab',
  );
  const [editing, setEditing] = React.useState(false);

  const shouldPrompt =
    mounted && promptOnFirstVisit && !name.trim() && !skipped;
  const open = editing || shouldPrompt;

  return (
    <>
      {mounted && (
        <button
          type='button'
          onClick={() => setEditing(true)}
          title='Ubah nama pemain'
          className='inline-flex items-center gap-1.5 rounded-full border border-line bg-surface/60 px-3 py-1 text-xs font-medium text-[var(--mute)] transition-colors hover:border-line-strong hover:text-ink'
        >
          <span aria-hidden className='size-1.5 rounded-full bg-accent' />
          <span className='max-w-[8rem] truncate'>
            {name.trim() || 'Atur nama'}
          </span>
        </button>
      )}

      {open && (
        <PlayerNameModal
          initialName={name}
          onSave={(next) => {
            setName(next);
            setSkipped(false);
            setEditing(false);
          }}
          onClose={() => {
            if (!name.trim()) setSkipped(true);
            setEditing(false);
          }}
        />
      )}
    </>
  );
}
