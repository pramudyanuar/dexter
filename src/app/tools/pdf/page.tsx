'use client';

import * as React from 'react';

import ToolShell from '@/features/tools/components/ToolShell';
import {
  buildImagesPdf,
  Orientation,
  PageSize,
  PdfImagePage,
} from '@/features/tools/pdf';
import { formatBytes } from '@/features/transfer/format';

interface ImageItem {
  id: string;
  file: File;
  url: string;
  width: number;
  height: number;
}

async function encodeAsJpeg(
  url: string,
  quality: number,
): Promise<PdfImagePage> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Gagal memuat gambar'));
    img.src = url;
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas tidak tersedia');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Gagal encode JPEG'))),
      'image/jpeg',
      quality / 100,
    );
  });
  const buf = await blob.arrayBuffer();
  return {
    jpegBytes: new Uint8Array(buf),
    width: canvas.width,
    height: canvas.height,
  };
}

export default function PdfToolPage() {
  const [items, setItems] = React.useState<ImageItem[]>([]);
  const [pageSize, setPageSize] = React.useState<PageSize>('a4');
  const [orientation, setOrientation] = React.useState<Orientation>('auto');
  const [marginPt, setMarginPt] = React.useState(24);
  const [quality, setQuality] = React.useState(85);
  const [filename, setFilename] = React.useState('dokumen');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const fileRef = React.useRef<HTMLInputElement>(null);
  const urlsRef = React.useRef<string[]>([]);

  React.useEffect(() => {
    const urls = urlsRef.current;
    return () => {
      for (const u of urls) URL.revokeObjectURL(u);
    };
  }, []);

  const addFiles = React.useCallback(async (files: File[]) => {
    const valid = files.filter((f) => f.type.startsWith('image/'));
    if (valid.length === 0) {
      setError('Pilih atau tempel file gambar (PNG, JPG, WebP, GIF).');
      return;
    }
    setError('');
    const loaded: ImageItem[] = [];
    for (const file of valid) {
      const url = URL.createObjectURL(file);
      urlsRef.current.push(url);
      const dims = await new Promise<{ w: number; h: number }>((resolve) => {
        const img = new Image();
        img.onload = () =>
          resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => resolve({ w: 800, h: 600 });
        img.src = url;
      });
      loaded.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        url,
        width: dims.w,
        height: dims.h,
      });
    }
    setItems((prev) => [...prev, ...loaded]);
  }, []);

  React.useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.some((f) => f.type.startsWith('image/'))) {
        e.preventDefault();
        addFiles(files);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [addFiles]);

  const moveItem = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    setItems((prev) => {
      const next = [...prev];
      const [picked] = next.splice(idx, 1);
      next.splice(target, 0, picked);
      return next;
    });
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const generatePdf = async () => {
    if (items.length === 0 || busy) return;
    setBusy(true);
    setError('');
    try {
      const pages: PdfImagePage[] = [];
      for (const it of items) {
        pages.push(await encodeAsJpeg(it.url, quality));
      }
      const bytes = buildImagesPdf(pages, { pageSize, orientation, marginPt });
      const buffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(buffer).set(bytes);
      const blob = new Blob([buffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename.trim() || 'dokumen'}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat PDF');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell
      title='Gambar → PDF'
      description='Gabungkan beberapa gambar atau screenshot (langsung Ctrl+V) menjadi satu file PDF di browser tanpa upload.'
      wide
    >
      {error && (
        <div className='mb-4 rounded-xl border border-err/40 bg-err/10 px-4 py-2.5 text-sm text-err'>
          {error}
        </div>
      )}

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addFiles(Array.from(e.dataTransfer.files));
        }}
        className='mb-6 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line-strong bg-surface/40 p-6 text-center'
      >
        <input
          ref={fileRef}
          type='file'
          accept='image/*'
          multiple
          className='hidden'
          onChange={(e) => {
            if (e.target.files) addFiles(Array.from(e.target.files));
            e.target.value = '';
          }}
        />
        <p className='text-sm text-[var(--mute)]'>
          Seret beberapa gambar ke sini, tekan{' '}
          <kbd className='rounded border border-line-strong px-1.5 py-0.5 font-mono text-xs text-ink'>
            Ctrl+V
          </kbd>{' '}
          untuk tempel screenshot, atau pilih file.
        </p>
        <button
          type='button'
          onClick={() => fileRef.current?.click()}
          className='rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:opacity-90'
        >
          + Tambah Gambar
        </button>
      </div>

      {items.length > 0 && (
        <div className='grid gap-6 md:grid-cols-[280px_1fr]'>
          <div className='flex flex-col gap-4 self-start rounded-xl border border-line bg-surface/50 p-4'>
            <label className='flex flex-col gap-1.5 text-xs text-[var(--mute)]'>
              Nama File PDF
              <input
                type='text'
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                className='rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink'
              />
            </label>

            <label className='flex flex-col gap-1.5 text-xs text-[var(--mute)]'>
              Ukuran Halaman
              <select
                value={pageSize}
                onChange={(e) => setPageSize(e.target.value as PageSize)}
                className='rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink'
              >
                <option value='a4'>A4</option>
                <option value='letter'>Letter</option>
                <option value='fit'>Sesuai Ukuran Gambar</option>
              </select>
            </label>

            {pageSize !== 'fit' && (
              <label className='flex flex-col gap-1.5 text-xs text-[var(--mute)]'>
                Orientasi
                <select
                  value={orientation}
                  onChange={(e) =>
                    setOrientation(e.target.value as Orientation)
                  }
                  className='rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink'
                >
                  <option value='auto'>Otomatis per gambar</option>
                  <option value='portrait'>Portrait</option>
                  <option value='landscape'>Landscape</option>
                </select>
              </label>
            )}

            <label className='flex flex-col gap-1.5 text-xs text-[var(--mute)]'>
              Margin
              <select
                value={marginPt}
                onChange={(e) => setMarginPt(Number(e.target.value))}
                className='rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink'
              >
                <option value={0}>Tanpa Margin (0 pt)</option>
                <option value={16}>Kecil (16 pt)</option>
                <option value={24}>Sedang (24 pt)</option>
                <option value={40}>Lebar (40 pt)</option>
              </select>
            </label>

            <label className='flex flex-col gap-1.5 text-xs text-[var(--mute)]'>
              Kualitas Gambar ({quality}%)
              <input
                type='range'
                min={50}
                max={95}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
              />
            </label>

            <button
              type='button'
              disabled={busy}
              onClick={generatePdf}
              className='mt-2 w-full rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-paper transition hover:opacity-90 disabled:opacity-40'
            >
              {busy
                ? 'Membuat PDF...'
                : `Buat & Unduh PDF (${items.length} hal)`}
            </button>
          </div>

          <ul className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
            {items.map((it, idx) => (
              <li
                key={it.id}
                className='flex flex-col overflow-hidden rounded-xl border border-line bg-surface/50'
              >
                <div className='relative aspect-[4/3] border-b border-line bg-paper'>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={it.url}
                    alt={it.file.name}
                    className='size-full object-contain p-2'
                  />
                  <span className='absolute top-2 left-2 rounded bg-paper/85 px-1.5 py-0.5 font-mono text-[11px] text-ink'>
                    Hal {idx + 1}
                  </span>
                </div>
                <div className='flex items-center justify-between gap-2 px-3 py-2 text-xs'>
                  <div className='min-w-0 flex-1'>
                    <div className='truncate font-medium text-ink'>
                      {it.file.name}
                    </div>
                    <div className='text-[var(--mute)]'>
                      {it.width}×{it.height} · {formatBytes(it.file.size)}
                    </div>
                  </div>
                  <div className='flex shrink-0 items-center gap-1'>
                    <button
                      type='button'
                      disabled={idx === 0}
                      onClick={() => moveItem(idx, -1)}
                      aria-label='Geser ke atas'
                      className='rounded border border-line-strong px-2 py-1 disabled:opacity-30'
                    >
                      ↑
                    </button>
                    <button
                      type='button'
                      disabled={idx === items.length - 1}
                      onClick={() => moveItem(idx, 1)}
                      aria-label='Geser ke bawah'
                      className='rounded border border-line-strong px-2 py-1 disabled:opacity-30'
                    >
                      ↓
                    </button>
                    <button
                      type='button'
                      onClick={() => removeItem(it.id)}
                      aria-label='Hapus gambar'
                      className='rounded border border-line-strong px-2 py-1 text-[var(--mute)] hover:text-err'
                    >
                      ×
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ToolShell>
  );
}
