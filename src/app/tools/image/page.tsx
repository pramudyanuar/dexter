'use client';

import * as React from 'react';

import { formatBytes } from '@/lib/transfer/format';

import ToolShell from '@/components/tools/ToolShell';

type OutputFormat = 'image/webp' | 'image/jpeg' | 'image/png';

interface ProcessedImage {
  url: string;
  size: number;
  width: number;
  height: number;
  ext: string;
}

export default function ImageToolPage() {
  const [sourceFile, setSourceFile] = React.useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = React.useState('');
  const [origDims, setOrigDims] = React.useState<{
    w: number;
    h: number;
  } | null>(null);
  const [format, setFormat] = React.useState<OutputFormat>('image/webp');
  const [quality, setQuality] = React.useState(82);
  const [maxWidth, setMaxWidth] = React.useState('');
  const [output, setOutput] = React.useState<ProcessedImage | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      if (output?.url) URL.revokeObjectURL(output.url);
    };
  }, [sourceUrl, output?.url]);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Pilih file gambar (PNG, JPG, WebP, GIF).');
      return;
    }
    setError('');
    setSourceFile(file);
    const url = URL.createObjectURL(file);
    setSourceUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    const img = new Image();
    img.onload = () =>
      setOrigDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
  };

  React.useEffect(() => {
    if (!sourceUrl || !origDims) return;
    let cancelled = false;
    const busyTimer = setTimeout(() => {
      if (!cancelled) setBusy(true);
    }, 0);

    const img = new Image();
    img.onload = () => {
      clearTimeout(busyTimer);
      if (cancelled) return;
      const limitW = Number(maxWidth);
      let targetW = img.naturalWidth;
      let targetH = img.naturalHeight;
      if (limitW > 0 && targetW > limitW) {
        targetH = Math.round((targetH * limitW) / targetW);
        targetW = limitW;
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setBusy(false);
        return;
      }
      if (format === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetW, targetH);
      }
      ctx.drawImage(img, 0, 0, targetW, targetH);

      canvas.toBlob(
        (blob) => {
          if (cancelled) return;
          setBusy(false);
          if (!blob) {
            setError('Gagal memproses gambar.');
            return;
          }
          const outUrl = URL.createObjectURL(blob);
          const ext =
            format === 'image/webp'
              ? 'webp'
              : format === 'image/jpeg'
                ? 'jpg'
                : 'png';
          setOutput((prev) => {
            if (prev?.url) URL.revokeObjectURL(prev.url);
            return {
              url: outUrl,
              size: blob.size,
              width: targetW,
              height: targetH,
              ext,
            };
          });
        },
        format,
        quality / 100,
      );
    };
    img.src = sourceUrl;

    return () => {
      cancelled = true;
      clearTimeout(busyTimer);
    };
  }, [sourceUrl, origDims, format, quality, maxWidth]);

  const savedPct =
    sourceFile && output
      ? Math.round(((sourceFile.size - output.size) / sourceFile.size) * 100)
      : 0;

  return (
    <ToolShell
      title='Kompres & Ubah Gambar'
      description='Kompres ukuran, ubah dimensi, dan konversi format gambar langsung di browser tanpa mengirim ke server.'
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
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        className='mb-6 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line-strong bg-surface/40 p-6 text-center'
      >
        <input
          ref={fileRef}
          type='file'
          accept='image/*'
          className='hidden'
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <p className='text-sm text-[var(--mute)]'>
          {sourceFile
            ? `File aktif: ${sourceFile.name} (${formatBytes(sourceFile.size)})`
            : 'Seret gambar ke sini atau pilih file dari perangkat'}
        </p>
        <button
          type='button'
          onClick={() => fileRef.current?.click()}
          className='rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:opacity-90'
        >
          {sourceFile ? 'Ganti Gambar' : 'Pilih Gambar'}
        </button>
      </div>

      {sourceFile && (
        <div className='grid gap-6 md:grid-cols-[280px_1fr]'>
          <div className='flex flex-col gap-4 rounded-xl border border-line bg-surface/50 p-4'>
            <label className='flex flex-col gap-1.5 text-xs text-[var(--mute)]'>
              Format Output
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as OutputFormat)}
                className='rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink'
              >
                <option value='image/webp'>WebP (paling hemat)</option>
                <option value='image/jpeg'>JPEG</option>
                <option value='image/png'>PNG (lossless)</option>
              </select>
            </label>

            {format !== 'image/png' && (
              <label className='flex flex-col gap-1.5 text-xs text-[var(--mute)]'>
                Kualitas ({quality}%)
                <input
                  type='range'
                  min={10}
                  max={100}
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                />
              </label>
            )}

            <label className='flex flex-col gap-1.5 text-xs text-[var(--mute)]'>
              Lebar Maksimal (px, opsional)
              <input
                type='number'
                min={16}
                placeholder={origDims ? `Asli: ${origDims.w}px` : 'Asli'}
                value={maxWidth}
                onChange={(e) => setMaxWidth(e.target.value)}
                className='rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink'
              />
            </label>

            {output && (
              <a
                href={output.url}
                download={`${sourceFile.name.replace(/\.[^.]+$/, '')}.${output.ext}`}
                className='mt-2 block w-full rounded-lg bg-ink px-4 py-2 text-center text-sm font-medium text-paper transition hover:opacity-90'
              >
                Unduh Hasil ({formatBytes(output.size)})
              </a>
            )}
          </div>

          <div className='flex flex-col gap-3 rounded-xl border border-line bg-surface/50 p-4'>
            <div className='flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--mute)]'>
              <span>
                Asli: {origDims ? `${origDims.w}×${origDims.h}` : '...'} (
                {formatBytes(sourceFile.size)})
              </span>
              {output && (
                <span>
                  Hasil: {output.width}×{output.height} (
                  {formatBytes(output.size)}) ·{' '}
                  <strong
                    className={savedPct >= 0 ? 'text-accent' : 'text-err'}
                  >
                    {savedPct >= 0 ? `hemat ${savedPct}%` : `+${-savedPct}%`}
                  </strong>
                </span>
              )}
            </div>

            {busy ? (
              <div className='flex h-64 items-center justify-center text-sm text-[var(--mute)]'>
                Memproses gambar...
              </div>
            ) : (
              output && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={output.url}
                  alt='Hasil kompresi'
                  className='max-h-[420px] w-full rounded-lg border border-line bg-paper object-contain'
                />
              )
            )}
          </div>
        </div>
      )}
    </ToolShell>
  );
}
