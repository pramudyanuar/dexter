'use client';

import * as React from 'react';

import type { BugReport } from '@/lib/rooms/bug-reports';

import { useCopy } from '@/components/games/RoomBar';

const date = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'medium',
});

export default function AdminBugReports({
  onExpire,
}: {
  onExpire: () => void;
}) {
  const [reports, setReports] = React.useState<BugReport[] | null>(null);
  const [selected, setSelected] = React.useState('');
  const [refresh, setRefresh] = React.useState(0);
  const [error, setError] = React.useState('');
  const { copied, copy } = useCopy();

  React.useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const res = await fetch('/api/admin/bug-reports', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (res.status === 401) return onExpire();
        const data = await res.json();
        if (controller.signal.aborted) return;
        if (!res.ok) throw new Error(data.error ?? 'Gagal memuat laporan.');
        setReports(data.reports);
      } catch (err) {
        if (!controller.signal.aborted)
          setError(
            err instanceof Error ? err.message : 'Gagal memuat laporan.',
          );
      }
    }
    void load();
    return () => controller.abort();
  }, [onExpire, refresh]);

  return (
    <section
      aria-labelledby='bug-reports-heading'
      className='min-w-0 space-y-4'
    >
      <div className='flex items-center justify-between gap-3'>
        <h2 id='bug-reports-heading' className='text-lg font-semibold'>
          Laporan bug
        </h2>
        <button
          type='button'
          onClick={() => {
            setError('');
            setReports(null);
            setRefresh((n) => n + 1);
          }}
          className='rounded-lg border border-line-strong px-3 py-1 text-xs hover:border-accent'
        >
          Segarkan laporan
        </button>
      </div>
      {error ? (
        <p role='alert' className='text-sm text-err'>
          {error}
        </p>
      ) : !reports ? (
        <p role='status' className='text-sm text-mute'>
          Memuat laporan…
        </p>
      ) : reports.length === 0 ? (
        <p className='text-sm text-mute'>Belum ada laporan bug.</p>
      ) : (
        <ul className='space-y-3'>
          {reports.map((report) => {
            const { room } = report;
            const open = selected === report.id;
            const detailId = `bug-${report.id}`;
            return (
              <li
                key={report.id}
                className='min-w-0 rounded-xl border border-line bg-card p-4'
              >
                <div className='flex flex-wrap items-baseline gap-x-3 gap-y-1'>
                  <h3 className='font-semibold'>
                    {room.game} · {room.code}
                  </h3>
                  <time
                    dateTime={new Date(report.capturedAt).toISOString()}
                    className='text-xs text-mute'
                  >
                    {date.format(report.capturedAt)}
                  </time>
                  <span className='text-xs text-mute'>
                    {room.status} · v{room.version}
                  </span>
                </div>
                <p className='my-3 text-sm wrap-break-word whitespace-pre-wrap'>
                  {report.description}
                </p>
                <button
                  type='button'
                  aria-expanded={open}
                  aria-controls={open ? detailId : undefined}
                  onClick={() => setSelected(open ? '' : report.id)}
                  className='rounded-md border border-line-strong px-2.5 py-1 text-xs hover:border-accent'
                >
                  {open ? 'Tutup kondisi game' : 'Lihat kondisi game'}
                </button>
                {open && (
                  <div id={detailId} className='mt-3 space-y-2'>
                    {report.stateOmitted && (
                      <p className='text-xs text-mute'>
                        Data papan melebihi batas ukuran. Informasi room lain
                        tetap tersedia.
                      </p>
                    )}
                    <button
                      type='button'
                      onClick={() =>
                        void copy(report.id, JSON.stringify(report, null, 2))
                      }
                      className='rounded-md border border-line-strong px-2.5 py-1 text-xs hover:border-accent'
                    >
                      {copied === report.id ? 'Tersalin' : 'Salin laporan JSON'}
                    </button>
                    <pre className='max-h-80 overflow-auto rounded-lg border border-line bg-paper p-3 text-xs'>
                      {JSON.stringify(
                        { browser: report.browser, ...room },
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
