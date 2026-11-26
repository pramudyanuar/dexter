'use client';

import {
  Check,
  ChevronRight,
  LoaderCircle,
  RefreshCw,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import {
  type AdminBugReport,
  BUG_REPORT_PAGE_SIZE,
} from '@/lib/game-bugs/types';

import ConfirmDialog from '@/components/ConfirmDialog';
import { useCopy } from '@/components/games/RoomBar';

const dateFormat = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export default function AdminBugReports({
  onExpire,
}: {
  onExpire: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const [version, setVersion] = useState(0);
  const detailDialog = useRef<HTMLDialogElement>(null);
  const [detail, setDetail] = useState<AdminBugReport | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminBugReport | null>(
    null,
  );
  const [changingId, setChangingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const { copied, copy } = useCopy();
  const [result, setResult] = useState<{
    offset: number;
    version: number;
    reports: AdminBugReport[];
    hasMore: boolean;
    error?: string;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function loadReports() {
      try {
        const response = await fetch(`/api/admin/game-bugs?offset=${offset}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (response.status === 401) return onExpire();
        const page = (await response.json()) as {
          reports: AdminBugReport[];
          hasMore: boolean;
          error?: string;
        };
        if (!response.ok) throw new Error(page.error);
        if (!controller.signal.aborted) setResult({ offset, version, ...page });
      } catch (error) {
        if (!controller.signal.aborted) {
          setResult({
            offset,
            version,
            reports: [],
            hasMore: false,
            error:
              (error instanceof Error && error.message) ||
              'Gagal memuat laporan bug.',
          });
        }
      }
    }
    void loadReports();
    return () => controller.abort();
  }, [offset, version, onExpire]);

  const page =
    result?.offset === offset && result.version === version ? result : null;
  const busy = changingId !== null;

  async function changeReport(
    report: AdminBugReport,
    done: boolean | 'delete',
  ) {
    if (busy) return;
    const deleting = done === 'delete';
    setPendingDelete(null);
    setChangingId(report.id);
    setActionError('');
    try {
      const source = report.snapshot ? 'room' : 'game';
      const response = await fetch(
        `/api/admin/game-bugs?source=${source}&id=${report.id}&at=${report.at}`,
        deleting
          ? { method: 'DELETE' }
          : {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ done }),
            },
      );
      if (response.status === 401) return onExpire();
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        if (response.status === 404) setVersion((current) => current + 1);
        throw new Error(data.error);
      }
      if (deleting) {
        if (page?.reports.length === 1)
          setOffset((current) => Math.max(0, current - BUG_REPORT_PAGE_SIZE));
        setVersion((current) => current + 1);
      } else {
        setResult(
          (current) =>
            current && {
              ...current,
              reports: current.reports.map((row) =>
                row.id === report.id ? { ...row, done } : row,
              ),
            },
        );
      }
    } catch (error) {
      setActionError(
        (error instanceof Error && error.message) ||
          'Perubahan laporan belum tersimpan. Coba lagi.',
      );
    } finally {
      setChangingId(null);
    }
  }

  return (
    <section aria-labelledby='admin-bug-reports-title' className='w-full'>
      <div className='mb-4 flex items-center justify-between gap-3 sm:mb-5'>
        <h2
          id='admin-bug-reports-title'
          className='text-xl font-semibold tracking-tight'
        >
          Laporan Bug
        </h2>
        <button
          type='button'
          disabled={busy}
          onClick={() => {
            setActionError('');
            setOffset(0);
            setVersion((current) => current + 1);
          }}
          className='inline-flex min-h-11 items-center gap-2 rounded-lg border border-line-strong bg-surface/50 px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent enabled:cursor-pointer enabled:hover:border-accent disabled:opacity-50'
        >
          <RefreshCw aria-hidden='true' size={15} />
          Segarkan
        </button>
      </div>
      {actionError && (
        <p
          role='alert'
          className='mb-4 rounded-lg border border-err/30 bg-err/10 px-4 py-3 text-sm text-err'
        >
          {actionError}
        </p>
      )}
      {page ? (
        page.error ? (
          <p
            role='alert'
            className='rounded-lg border border-err/30 bg-err/10 px-4 py-3 text-sm text-err'
          >
            {page.error}
          </p>
        ) : page.reports.length ? (
          <ul className='grid gap-2'>
            {page.reports.map((report) => (
              <li
                key={report.id}
                className='grid min-w-0 gap-1 rounded-lg border border-line bg-surface/60 px-3 py-2'
              >
                <div className='flex min-w-0 items-baseline justify-between gap-2'>
                  <h3 className='truncate text-sm font-semibold text-ink'>
                    {report.gameTitle}
                    {report.snapshot && ` · ${report.snapshot.room.code}`}
                  </h3>
                  <time
                    className='shrink-0 text-xs text-mute'
                    dateTime={new Date(report.at).toISOString()}
                  >
                    {dateFormat.format(report.at)}
                  </time>
                </div>
                <button
                  type='button'
                  aria-haspopup='dialog'
                  aria-label={`Baca laporan ${report.gameTitle}`}
                  onClick={() => {
                    setDetail(report);
                    detailDialog.current?.showModal();
                  }}
                  className='flex min-h-8 min-w-0 cursor-pointer items-center justify-between gap-2 rounded-sm text-left text-sm text-ink hover:text-accent focus-visible:ring-2 focus-visible:ring-accent'
                >
                  <span className='line-clamp-3 wrap-anywhere'>
                    {report.description}
                  </span>
                  <ChevronRight
                    aria-hidden='true'
                    size={15}
                    className='shrink-0'
                  />
                </button>
                <div className='flex min-w-0 items-center justify-between gap-2'>
                  <p className='flex min-w-0 items-center gap-1.5 text-xs text-mute'>
                    <UserRound
                      aria-hidden='true'
                      size={14}
                      className='shrink-0'
                    />
                    <span className='sr-only'>Pelapor</span>
                    <span className='truncate'>
                      {report.playerName || 'Tanpa nama'}
                    </span>
                  </p>
                  <div className='flex shrink-0 items-center gap-2 text-xs'>
                    <button
                      type='button'
                      aria-pressed={report.done}
                      aria-busy={changingId === report.id}
                      title={
                        report.done ? 'Buka kembali laporan' : 'Tandai selesai'
                      }
                      disabled={busy}
                      onClick={() => void changeReport(report, !report.done)}
                      className={`inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2.5 font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent enabled:cursor-pointer enabled:hover:border-accent disabled:opacity-60 ${
                        report.done
                          ? 'border-accent/30 bg-accent/10 text-accent'
                          : 'border-line-strong text-ink'
                      }`}
                    >
                      {changingId === report.id ? (
                        <LoaderCircle
                          aria-hidden='true'
                          size={14}
                          className='motion-safe:animate-spin'
                        />
                      ) : (
                        <Check aria-hidden='true' size={14} />
                      )}
                      Selesai
                    </button>
                    <button
                      type='button'
                      disabled={busy}
                      onClick={() => setPendingDelete(report)}
                      className='inline-flex min-h-8 items-center gap-1.5 rounded-md border border-line-strong px-2.5 font-medium text-err transition-colors focus-visible:ring-2 focus-visible:ring-err enabled:cursor-pointer enabled:hover:border-err/50 enabled:hover:bg-err/10 disabled:opacity-50'
                    >
                      <Trash2 aria-hidden='true' size={14} />
                      Hapus
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className='rounded-xl border border-dashed border-line px-5 py-10 text-center text-sm text-mute'>
            Belum ada laporan bug.
          </p>
        )
      ) : (
        <p
          role='status'
          className='rounded-xl border border-line px-5 py-10 text-center text-sm text-mute'
        >
          Memuat laporan…
        </p>
      )}
      {(offset > 0 || page?.hasMore) && (
        <div className='mt-4 flex justify-end gap-2 text-xs'>
          <button
            type='button'
            disabled={busy || offset === 0}
            onClick={() => setOffset(offset - BUG_REPORT_PAGE_SIZE)}
            className='min-h-11 rounded-lg border border-line-strong px-3 focus-visible:ring-2 focus-visible:ring-accent enabled:cursor-pointer enabled:hover:border-accent disabled:opacity-50'
          >
            Sebelumnya
          </button>
          <button
            type='button'
            disabled={busy || !page?.hasMore}
            onClick={() => setOffset(offset + BUG_REPORT_PAGE_SIZE)}
            className='min-h-11 rounded-lg border border-line-strong px-3 focus-visible:ring-2 focus-visible:ring-accent enabled:cursor-pointer enabled:hover:border-accent disabled:opacity-50'
          >
            Berikutnya
          </button>
        </div>
      )}
      <dialog
        ref={detailDialog}
        aria-labelledby='admin-bug-detail-title'
        onClose={() => setDetail(null)}
        className='m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-xl border border-line bg-paper p-5 text-ink shadow-xl backdrop:bg-black/60'
      >
        <h3 id='admin-bug-detail-title' className='text-base font-semibold'>
          Detail laporan bug
        </h3>
        {detail && (
          <>
            <p className='mt-2 text-sm text-mute'>
              {detail.gameTitle} · {detail.playerName || 'Tanpa nama'}
            </p>
            <p className='mt-1 font-mono text-xs wrap-anywhere text-mute'>
              {detail.pathname}
            </p>
            <p className='mt-4 text-sm leading-relaxed wrap-anywhere whitespace-pre-wrap'>
              {detail.description}
            </p>
            {detail.snapshot && (
              <details className='mt-4 space-y-2 text-sm'>
                <summary className='cursor-pointer font-medium'>
                  Kondisi game
                </summary>
                <p className='text-xs text-mute'>
                  {detail.snapshot.room.code} · {detail.snapshot.room.status} ·
                  v{detail.snapshot.room.version} ·{' '}
                  {dateFormat.format(detail.snapshot.capturedAt)}
                </p>
                {detail.snapshot.stateOmitted && (
                  <p className='text-xs text-mute'>
                    Data papan melebihi batas ukuran. Informasi room lain tetap
                    tersedia.
                  </p>
                )}
                <button
                  type='button'
                  onClick={() =>
                    void copy(
                      detail.id,
                      JSON.stringify(detail.snapshot, null, 2),
                    )
                  }
                  className='rounded-md border border-line-strong px-2.5 py-1 text-xs hover:border-accent'
                >
                  {copied === detail.id ? 'Tersalin' : 'Salin laporan JSON'}
                </button>
                <pre className='max-h-72 overflow-auto rounded-lg border border-line bg-card p-3 text-xs'>
                  {JSON.stringify(
                    {
                      browser: detail.snapshot.browser,
                      ...detail.snapshot.room,
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
            )}
          </>
        )}
        <form method='dialog' className='mt-4 flex justify-end'>
          <button
            type='submit'
            className='min-h-9 cursor-pointer rounded-md border border-line-strong px-3 text-sm font-medium hover:border-accent focus-visible:ring-2 focus-visible:ring-accent'
          >
            Tutup
          </button>
        </form>
      </dialog>
      {pendingDelete && (
        <ConfirmDialog
          danger
          title='Hapus laporan bug?'
          message={
            <>
              <p>
                Laporan {pendingDelete.gameTitle} ini akan dihapus permanen.
              </p>
              <p className='mt-2 line-clamp-2 text-ink'>
                {pendingDelete.description}
              </p>
            </>
          }
          confirmLabel='Hapus'
          cancelLabel='Batal'
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void changeReport(pendingDelete, 'delete')}
        />
      )}
    </section>
  );
}
