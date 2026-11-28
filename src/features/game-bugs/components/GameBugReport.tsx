'use client';

import { usePathname } from 'next/navigation';
import { FormEvent, useEffect, useRef, useState } from 'react';

import useStoredState from '@/hooks/useStoredState';

import {
  BUG_DESCRIPTION_LIMIT,
  getBugReportGame,
} from '@/features/game-bugs/types';
import usePlayerName from '@/features/games/hooks/usePlayerName';
import { callRoom } from '@/features/rooms/room-request';
import type { RoomSession } from '@/features/rooms/useRoom';

const SAVE_ERROR = 'Laporan belum dapat disimpan. Coba lagi.';

export default function GameBugReport({ game }: { game: string }) {
  const pathname = usePathname();
  const page = pathname && getBugReportGame(pathname);
  const [session] = useStoredState<RoomSession | null>(
    `room-session-${game}`,
    null,
    'tab',
  );
  if (!page) return null;
  return (
    <ReportTab
      key={pathname}
      pathname={pathname}
      gameTitle={page.gameTitle}
      session={session?.code && session.token ? session : null}
    />
  );
}

const roomPath = (code: string) =>
  `/api/rooms/${encodeURIComponent(code)}/bug-reports`;

function ReportTab({
  gameTitle,
  pathname,
  session,
}: {
  gameTitle: string;
  pathname: string;
  session: RoomSession | null;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const captureRequest = useRef<AbortController | null>(null);
  const submission = useRef<{ requestId: string; playerName: string } | null>(
    null,
  );
  const submitting = useRef(false);
  const [playerName] = usePlayerName();
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [reportRoom, setReportRoom] = useState<RoomSession | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const needsCapture = reportRoom !== null && !draft;

  useEffect(() => () => captureRequest.current?.abort(), []);

  useEffect(() => {
    if (!sent) return;
    closeButton.current?.focus();
    const timer = window.setTimeout(() => dialog.current?.close(), 1000);
    return () => window.clearTimeout(timer);
  }, [sent]);

  async function capture({ code, token }: RoomSession) {
    captureRequest.current?.abort();
    const controller = new AbortController();
    captureRequest.current = controller;
    setCapturing(true);
    setError('');
    try {
      const { id } = await callRoom(roomPath(code), {
        token,
        body: { action: 'capture' },
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
      });
      if (!controller.signal.aborted) setDraft(id);
    } catch (error) {
      if (!controller.signal.aborted) {
        setError(
          error instanceof Error && error.name === 'Error'
            ? error.message
            : 'Gagal mengambil catatan game.',
        );
      }
    } finally {
      if (!controller.signal.aborted) setCapturing(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || needsCapture || !description.trim()) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      const signal = AbortSignal.timeout(8000);
      if (reportRoom) {
        await callRoom(roomPath(reportRoom.code), {
          token: reportRoom.token,
          body: { action: 'submit', id: draft, description },
          signal,
        });
      } else {
        submission.current ??= {
          requestId: crypto.getRandomValues(new Uint32Array(4)).join('-'),
          playerName,
        };
        await callRoom('/api/game-bugs', {
          body: { pathname, description, ...submission.current },
          signal,
        });
      }
      submission.current = null;
      setDescription('');
      setSent(true);
    } catch (error) {
      if (reportRoom && (error as { status?: number }).status === 404)
        setDraft(null);
      setError(
        error instanceof Error && error.name === 'Error'
          ? error.message
          : SAVE_ERROR,
      );
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
        onClick={() => {
          setReportRoom(session);
          setDraft(null);
          dialog.current?.showModal();
          if (session) void capture(session);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ')
            event.stopPropagation();
        }}
        className='group fixed top-[42%] right-[env(safe-area-inset-right)] z-40 flex h-24 w-11 cursor-pointer touch-manipulation justify-end rounded-l-lg focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset'
      >
        <span className='flex h-full w-7 rotate-180 items-center justify-center rounded-r-lg border border-l-0 border-line-strong bg-card text-xs font-semibold text-ink shadow-lg transition-colors [writing-mode:vertical-rl] group-hover:border-accent group-hover:bg-surface sm:w-9'>
          Laporkan bug
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
          captureRequest.current?.abort();
          setCapturing(false);
          setSent(false);
          setError('');
        }}
        className='m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-xl border border-line bg-surface p-5 text-ink shadow-xl backdrop:bg-black/60 sm:p-6'
      >
        <h2 id='game-bug-title' className='text-lg font-semibold'>
          Laporkan bug
        </h2>
        <p className='mt-1 text-sm text-mute'>{gameTitle}</p>
        <form onSubmit={submit} className='mt-5'>
          {sent ? (
            <p role='status' className='text-sm'>
              Laporan terkirim. Terima kasih!
            </p>
          ) : (
            <>
              {reportRoom && (
                <p className='mb-3 text-sm text-mute'>
                  Kondisi game saat laporan dibuka disertakan agar admin bisa
                  mengecek masalahnya.
                </p>
              )}
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
              {capturing && (
                <p role='status' className='mt-2 text-sm text-mute'>
                  Mengambil catatan game…
                </p>
              )}
              {reportRoom && needsCapture && !capturing && (
                <div className='mt-3 flex flex-wrap gap-3 text-sm'>
                  <button
                    type='button'
                    onClick={() => void capture(reportRoom)}
                    className='underline'
                  >
                    Ambil catatan lagi
                  </button>
                  <button
                    type='button'
                    onClick={() => {
                      setReportRoom(null);
                      setError('');
                    }}
                    className='underline'
                  >
                    Lanjut tanpa catatan room
                  </button>
                </div>
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
                disabled={busy || needsCapture || !description.trim()}
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
