'use client';

import { usePathname } from 'next/navigation';
import { FormEvent, useEffect, useRef, useState } from 'react';

import { BUG_DESCRIPTION_LIMIT, getBugReportGame } from '@/lib/game-bugs/types';
import usePlayerName from '@/lib/usePlayerName';

const SAVE_ERROR = 'Laporan belum dapat disimpan. Coba lagi.';

export default function GameBugTab() {
  const pathname = usePathname();
  const game = getBugReportGame(pathname);
  if (!game) return null;
  return (
    <ReportTab key={pathname} pathname={pathname} gameTitle={game.gameTitle} />
  );
}

function ReportTab({
  gameTitle,
  pathname,
}: {
  gameTitle: string;
  pathname: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const submission = useRef<{ requestId: string; playerName: string } | null>(
    null,
  );
  const submitting = useRef(false);
  const [playerName] = usePlayerName();
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sent) return;
    closeButton.current?.focus();
    const timer = window.setTimeout(() => dialog.current?.close(), 1000);
    return () => window.clearTimeout(timer);
  }, [sent]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !description.trim()) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      submission.current ??= {
        requestId: crypto.getRandomValues(new Uint32Array(4)).join('-'),
        playerName,
      };
      const response = await fetch('/api/game-bugs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pathname,
          description,
          ...submission.current,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(result?.error ?? SAVE_ERROR);
        return;
      }
      submission.current = null;
      setDescription('');
      setSent(true);
    } catch {
      setError(SAVE_ERROR);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type='button'
        aria-haspopup='dialog'
        onClick={() => dialog.current?.showModal()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ')
            event.stopPropagation();
        }}
        className='group fixed top-[42%] right-[env(safe-area-inset-right)] z-40 flex h-24 w-11 cursor-pointer touch-manipulation justify-end rounded-l-lg focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset'
      >
        <span className='flex h-full w-7 rotate-180 items-center justify-center rounded-r-lg border border-l-0 border-line-strong bg-card text-xs font-semibold text-ink shadow-lg transition-colors [writing-mode:vertical-rl] group-hover:border-accent group-hover:bg-surface sm:w-9'>
          Lapor bug
        </span>
      </button>
      <dialog
        ref={dialog}
        aria-labelledby='game-bug-title'
        onKeyDown={(event) => event.stopPropagation()}
        onCancel={(event) => {
          if (submitting.current) event.preventDefault();
        }}
        onClose={() => {
          setSent(false);
          setError('');
        }}
        className='m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-xl border border-line bg-surface p-5 text-ink shadow-xl backdrop:bg-black/60 sm:p-6'
      >
        <h2 id='game-bug-title' className='text-lg font-semibold'>
          Lapor bug
        </h2>
        <p className='mt-1 text-sm text-mute'>{gameTitle}</p>
        <form onSubmit={submit} className='mt-5'>
          {sent ? (
            <p role='status' className='text-sm'>
              Laporan bug sudah tersimpan.
            </p>
          ) : (
            <>
              <label
                htmlFor='game-bug-description'
                className='mb-2 block text-sm font-medium'
              >
                Apa yang terjadi?
              </label>
              <textarea
                id='game-bug-description'
                required
                rows={5}
                maxLength={BUG_DESCRIPTION_LIMIT}
                readOnly={busy}
                value={description}
                onChange={(event) => {
                  submission.current = null;
                  setDescription(event.target.value);
                  setError('');
                }}
                placeholder='Ceritakan langkah sebelum bug muncul.'
                className='block w-full resize-y rounded-lg border border-line-strong bg-card px-3 py-2 text-base text-ink placeholder:text-mute focus:border-accent focus:ring-accent'
              />
              {error && (
                <p role='alert' className='mt-2 text-sm text-err'>
                  {error}
                </p>
              )}
            </>
          )}
          <div className='mt-4 flex flex-wrap justify-end gap-2 text-sm'>
            <button
              type='button'
              ref={closeButton}
              disabled={busy}
              onClick={() => dialog.current?.close()}
              className='min-h-11 rounded-lg border border-line-strong px-4 font-medium hover:border-mute focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50'
            >
              {sent ? 'Tutup' : 'Batal'}
            </button>
            {!sent && (
              <button
                type='submit'
                disabled={busy || !description.trim()}
                className='min-h-11 rounded-lg bg-ink px-4 font-semibold text-paper hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50'
              >
                {busy ? 'Mengirim…' : 'Kirim laporan'}
              </button>
            )}
          </div>
        </form>
      </dialog>
    </>
  );
}
