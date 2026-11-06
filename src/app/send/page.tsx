'use client';

import Link from 'next/link';
import * as React from 'react';

import { TransferDriver, uploadFile } from '@/lib/transfer/client';
import { formatBytes, formatDuration } from '@/lib/transfer/format';
import { buildPathname, newFileId, sanitizeName } from '@/lib/transfer/naming';

import AuthGate, { useAuth } from '@/components/AuthGate';
import ConfirmDialog from '@/components/ConfirmDialog';

interface FileInfo {
  id: string;
  name: string;
  size: number;
  uploadedAt: number;
  expiresAt: number;
}

interface TransferInfo {
  driver: TransferDriver;
  files: FileInfo[];
  used: number;
  quota: number;
  maxFile: number;
  ttlHours: number;
}

interface UploadItem {
  key: string;
  name: string;
  size: number;
  percent: number;
  error?: string;
}

const POLL_MS = 15_000;

function Send() {
  const { logout, expire } = useAuth();
  const [info, setInfo] = React.useState<TransferInfo | null>(null);
  const [error, setError] = React.useState('');
  const [uploads, setUploads] = React.useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<FileInfo | null>(
    null,
  );
  const [now, setNow] = React.useState(() => Date.now());
  const fileInput = React.useRef<HTMLInputElement>(null);
  const infoRef = React.useRef<TransferInfo | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch('/api/transfer', { cache: 'no-store' });
      if (res.status === 401) return expire();
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      infoRef.current = data;
      setInfo(data);
      setNow(Date.now());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat daftar');
    }
  }, [expire]);

  // the other device may have uploaded something: keep the list fresh
  React.useEffect(() => {
    const first = setTimeout(refresh, 0);
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const patchUpload = (key: string, patch: Partial<UploadItem>) =>
    setUploads((list) =>
      list.map((u) => (u.key === key ? { ...u, ...patch } : u)),
    );

  const sendFiles = async (files: File[]) => {
    const current = infoRef.current;
    if (!files.length || !current) return;

    const items = files.map((file) => ({
      file,
      item: {
        key: newFileId(),
        name: file.name,
        size: file.size,
        percent: 0,
      } as UploadItem,
    }));
    setUploads((list) => [...items.map((i) => i.item), ...list]);

    // one at a time: keeps progress readable and respects the quota check
    let used = current.used;
    for (const { file, item } of items) {
      if (file.size === 0) {
        patchUpload(item.key, { error: 'File kosong' });
      } else if (file.size > current.maxFile) {
        patchUpload(item.key, {
          error: `Terlalu besar (maks ${formatBytes(current.maxFile)})`,
        });
      } else if (used + file.size > current.quota) {
        patchUpload(item.key, { error: 'Penyimpanan penuh' });
      } else {
        try {
          await uploadFile(
            file,
            buildPathname(newFileId(), sanitizeName(file.name)),
            current.driver,
            (percent) => patchUpload(item.key, { percent }),
          );
          used += file.size;
          setUploads((list) => list.filter((u) => u.key !== item.key));
          await refresh();
        } catch (err) {
          patchUpload(item.key, {
            error: err instanceof Error ? err.message : 'Gagal mengunggah',
          });
        }
      }
    }
  };

  const remove = async (file: FileInfo) => {
    setPendingDelete(null);
    try {
      const res = await fetch(
        `/api/transfer?id=${encodeURIComponent(file.id)}`,
        {
          method: 'DELETE',
        },
      );
      if (res.status === 401) return expire();
      if (!res.ok)
        throw new Error((await res.json()).error ?? 'Gagal menghapus');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus');
    }
  };

  // paste a screenshot or copied file straight into the page
  React.useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length) {
        e.preventDefault();
        sendFiles(files);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  const action =
    'text-mute hover:text-accent text-xs transition disabled:opacity-30';

  return (
    <div
      className='relative flex min-h-dvh flex-col bg-paper font-mono text-[13.5px] text-ink'
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDragging(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        sendFiles(Array.from(e.dataTransfer.files));
      }}
    >
      {isDragging && (
        <div className='pointer-events-none absolute inset-2 z-30 flex items-center justify-center border border-dashed border-accent bg-paper/90 text-accent'>
          lepas file di sini untuk mengunggah
        </div>
      )}

      <header className='border-b border-line'>
        <div className='flex w-full items-center justify-between gap-4 px-4 py-2.5'>
          <span className='text-sm'>
            <span className='text-accent'>dexter@send</span>
            <span className='text-mute'>:</span>
            <Link href='/apps' className='text-info hover:underline'>
              ~
            </Link>
            <span className='text-info'>/send</span>{' '}
            <span className='text-hash'>(main)</span>
          </span>
          <button type='button' onClick={logout} className={action}>
            :logout
          </button>
        </div>
      </header>

      <main className='w-full max-w-3xl flex-1 px-4 py-6 leading-6'>
        <p>
          <span className='text-accent select-none'>$</span> send
        </p>
        <p className='mt-1 text-mute'>
          # Unggah di sini, lalu buka halaman ini di device lain untuk
          mengunduh. Seret file, tempel, atau pilih.
        </p>

        <div className='mt-3 flex flex-wrap items-center gap-x-4 gap-y-1'>
          <button
            type='button'
            onClick={() => fileInput.current?.click()}
            disabled={!info}
            className='text-info hover:underline disabled:opacity-40'
          >
            [pilih file]
          </button>
          <button type='button' onClick={refresh} className={action}>
            [muat ulang]
          </button>
          <input
            ref={fileInput}
            type='file'
            multiple
            hidden
            onChange={(e) => {
              sendFiles(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />
        </div>

        {info?.driver === 'local' && (
          <p className='mt-3 text-xs text-hash'>
            # Mode lokal (dev): file disimpan di folder .data/ komputer ini,
            bukan di Vercel Blob.
          </p>
        )}
        {error && <p className='mt-3 whitespace-pre-wrap text-err'>{error}</p>}

        {uploads.length > 0 && (
          <ul className='mt-4 space-y-2'>
            {uploads.map((u) => (
              <li key={u.key}>
                <div className='flex justify-between gap-4'>
                  <span className='truncate'>{u.name}</span>
                  <span className='shrink-0 text-mute'>
                    {formatBytes(u.size)}
                  </span>
                </div>
                {u.error ? (
                  <div className='flex justify-between text-xs text-err'>
                    <span>{u.error}</span>
                    <button
                      type='button'
                      onClick={() =>
                        setUploads((l) => l.filter((x) => x.key !== u.key))
                      }
                      className='hover:underline'
                    >
                      [tutup]
                    </button>
                  </div>
                ) : (
                  <div className='text-xs text-accent'>
                    [{'#'.repeat(Math.round(u.percent / 5)).padEnd(20, '-')}]{' '}
                    {u.percent}%
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <ul className='mt-6 divide-y divide-line border-y border-line'>
          {info && info.files.length === 0 && uploads.length === 0 && (
            <li className='py-3 text-mute'>belum ada file</li>
          )}
          {info?.files.map((file) => (
            <li
              key={file.id}
              className='flex flex-wrap items-center gap-x-4 gap-y-1 py-3'
            >
              <span
                className='min-w-0 flex-1 basis-48 truncate'
                title={file.name}
              >
                {file.name}
              </span>
              <span className='text-xs text-mute'>
                {formatBytes(file.size)} · sisa{' '}
                {formatDuration(Math.max(0, file.expiresAt - now))}
              </span>
              <span className='flex gap-3'>
                <a
                  href={`/api/transfer/download?id=${encodeURIComponent(file.id)}`}
                  download={file.name}
                  className='text-xs text-info hover:underline'
                >
                  [unduh]
                </a>
                <button
                  type='button'
                  onClick={() => setPendingDelete(file)}
                  className='text-xs text-mute hover:text-err'
                >
                  [hapus]
                </button>
              </span>
            </li>
          ))}
        </ul>

        {info && (
          <p className='mt-4 text-xs text-mute'>
            # terpakai {formatBytes(info.used)} dari {formatBytes(info.quota)} ·
            maks {formatBytes(info.maxFile)} per file · file dihapus otomatis
            setelah {info.ttlHours} jam
          </p>
        )}
      </main>

      {pendingDelete && (
        <ConfirmDialog
          danger
          title='hapus file?'
          message={
            <>
              <span className='text-ink'>{pendingDelete.name}</span>
              <br />
              File dihapus dari penyimpanan dan tidak bisa dikembalikan.
            </>
          }
          confirmLabel='hapus'
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => remove(pendingDelete)}
        />
      )}
    </div>
  );
}

export default function SendPage() {
  return (
    <AuthGate>
      <Send />
    </AuthGate>
  );
}
