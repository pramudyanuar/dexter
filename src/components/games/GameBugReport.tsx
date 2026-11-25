'use client';

import { Bug } from 'lucide-react';
import * as React from 'react';

import { BUG_DESCRIPTION_MAX } from '@/lib/rooms/bug-reports';
import { callRoom } from '@/lib/rooms/room-request';
import type { RoomSession } from '@/lib/rooms/useRoom';
import useStoredState from '@/lib/useStoredState';

function ReportButton({ session }: { session: RoomSession }) {
  const { code, token } = session;
  const [draft, setDraft] = React.useState<string | null>(null);
  const [description, setDescription] = React.useState('');
  const [status, setStatus] = React.useState<
    'capturing' | 'sending' | 'sent' | 'idle'
  >('idle');
  const [error, setError] = React.useState('');
  const modal = React.useRef<HTMLDialogElement>(null);
  const request = React.useRef<AbortController | null>(null);
  const title = React.useId();
  const path = `/api/rooms/${encodeURIComponent(code)}/bug-reports`;

  React.useEffect(() => () => request.current?.abort(), []);

  const capture = async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setDraft(null);
    setStatus('capturing');
    setError('');
    try {
      const { id } = await callRoom(path, {
        token,
        body: { action: 'capture' },
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
      });
      if (!controller.signal.aborted) setDraft(id);
    } catch (err) {
      if (!controller.signal.aborted)
        setError(
          err instanceof Error && err.name === 'Error'
            ? err.message
            : 'Gagal mengambil catatan game.',
        );
    } finally {
      if (!controller.signal.aborted) setStatus('idle');
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status !== 'idle' || !draft || !description.trim()) return;
    const controller = new AbortController();
    request.current = controller;
    setStatus('sending');
    setError('');
    try {
      await callRoom(path, {
        token,
        body: { action: 'submit', id: draft, description },
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
      });
      if (!controller.signal.aborted) setStatus('sent');
    } catch (err) {
      if (controller.signal.aborted) return;
      if ((err as { status?: number }).status === 404) setDraft(null);
      setStatus('idle');
      setError(
        err instanceof Error && err.name === 'Error'
          ? err.message
          : 'Gagal mengirim laporan.',
      );
    }
  };

  return (
    <>
      <button
        type='button'
        aria-label='Laporkan bug'
        title='Laporkan bug'
        onClick={() => {
          setDescription('');
          modal.current?.showModal();
          void capture();
        }}
        className='fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-3 z-40 flex size-10 items-center justify-center rounded-full border border-line-strong bg-card text-ink shadow-md hover:border-accent'
      >
        <Bug size={18} aria-hidden='true' />
      </button>
      <dialog
        ref={modal}
        aria-labelledby={title}
        onClose={() => {
          request.current?.abort();
          setStatus('idle');
        }}
        onCancel={(e) => {
          if (status === 'sending') e.preventDefault();
        }}
        onKeyDown={(e) => e.stopPropagation()}
        className='m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-line-strong bg-card p-5 text-ink shadow-xl backdrop:bg-black/60'
      >
        <h2 id={title} className='mb-2 text-lg font-semibold'>
          Laporkan bug
        </h2>
        {status === 'sent' ? (
          <>
            <p role='status' className='text-sm'>
              Laporan terkirim. Terima kasih!
            </p>
            <button
              type='button'
              onClick={() => modal.current?.close()}
              className='mt-4 rounded-lg border border-line-strong px-3 py-2 text-sm'
            >
              Tutup
            </button>
          </>
        ) : (
          <form onSubmit={submit} className='flex flex-col gap-3'>
            <p className='text-sm text-mute'>
              Kondisi game saat laporan dibuka disertakan agar admin bisa
              mengecek masalahnya.
            </p>
            <label className='flex flex-col gap-1 text-sm font-medium'>
              Apa yang terjadi?
              <textarea
                rows={4}
                required
                maxLength={BUG_DESCRIPTION_MAX}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder='Ceritakan langkah sebelum bug muncul dan hasil yang kamu harapkan.'
                className='w-full resize-y rounded-lg border border-line-strong bg-paper p-2 text-sm font-normal text-ink'
              />
            </label>
            {status === 'capturing' && (
              <p role='status' className='text-xs text-mute'>
                Mengambil catatan game…
              </p>
            )}
            {error && (
              <p role='alert' className='text-sm text-err'>
                {error}
              </p>
            )}
            <div className='flex flex-wrap justify-end gap-2'>
              <button
                type='button'
                onClick={() => modal.current?.close()}
                disabled={status === 'sending'}
                className='rounded-lg border border-line-strong px-3 py-2 text-sm'
              >
                Batal
              </button>
              {draft || status === 'capturing' ? (
                <button
                  type='submit'
                  disabled={status !== 'idle' || !description.trim()}
                  className='rounded-lg bg-ink px-3 py-2 text-sm font-medium text-paper disabled:opacity-40'
                >
                  {status === 'sending' ? 'Mengirim…' : 'Kirim laporan'}
                </button>
              ) : (
                <button
                  type='button'
                  onClick={capture}
                  className='rounded-lg bg-ink px-3 py-2 text-sm font-medium text-paper'
                >
                  Ambil catatan game
                </button>
              )}
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}

export default function GameBugReport({ game }: { game: string }) {
  const [session] = useStoredState<RoomSession | null>(
    `room-session-${game}`,
    null,
    'tab',
  );
  return session?.code && session.token ? (
    <ReportButton key={session.code} session={session} />
  ) : null;
}
