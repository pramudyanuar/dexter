'use client';

import * as React from 'react';

import { encodeQrMatrix, qrToSvg } from '@/lib/tools/qr';

import ToolShell from '@/components/tools/ToolShell';

export default function QrToolPage() {
  const [text, setText] = React.useState('https://github.com');
  const [fg, setFg] = React.useState('#111111');
  const [bg, setBg] = React.useState('#ffffff');
  const [sizePx, setSizePx] = React.useState(320);
  const [copied, setCopied] = React.useState(false);

  const result = React.useMemo(() => {
    const trimmed = text.trim();
    if (!trimmed) return { matrix: null, error: 'Masukkan teks atau URL.' };
    try {
      const matrix = encodeQrMatrix(trimmed);
      return { matrix, error: '' };
    } catch (err) {
      return {
        matrix: null,
        error: err instanceof Error ? err.message : 'Gagal membuat QR code.',
      };
    }
  }, [text]);

  const svgString = React.useMemo(() => {
    if (!result.matrix) return '';
    return qrToSvg(result.matrix, fg, bg, 4);
  }, [result.matrix, fg, bg]);

  const downloadSvg = () => {
    if (!svgString) return;
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'qrcode.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPng = () => {
    if (!result.matrix) return;
    const matrix = result.matrix;
    const margin = 4;
    const total = matrix.length + margin * 2;
    const scale = Math.max(4, Math.floor(sizePx / total));
    const canvas = document.createElement('canvas');
    canvas.width = total * scale;
    canvas.height = total * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = fg;
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix.length; c++) {
        if (matrix[r][c]) {
          ctx.fillRect(
            (c + margin) * scale,
            (r + margin) * scale,
            scale,
            scale,
          );
        }
      }
    }
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'qrcode.png';
    a.click();
  };

  const copySvg = async () => {
    if (!svgString) return;
    await navigator.clipboard.writeText(svgString);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <ToolShell
      title='QR Code Generator'
      description='Buat QR code dari teks, tautan, atau format Wi-Fi langsung di browser.'
    >
      <div className='grid gap-6 md:grid-cols-[1fr_280px]'>
        <div className='flex flex-col gap-4 rounded-xl border border-line bg-surface/50 p-4'>
          <div>
            <label
              htmlFor='qr-input'
              className='mb-1.5 block text-xs font-medium text-[var(--mute)]'
            >
              Teks atau URL
            </label>
            <textarea
              id='qr-input'
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder='https://contoh.com atau teks bebas...'
              className='w-full rounded-lg border border-line-strong bg-paper p-3 font-mono text-sm text-ink focus:border-accent focus:outline-none'
            />
          </div>

          <div className='flex flex-wrap gap-2'>
            <button
              type='button'
              onClick={() => setText('WIFI:T:WPA;S:NamaWiFi;P:PasswordWiFi;;')}
              className='rounded-lg border border-line-strong px-2.5 py-1 text-xs text-[var(--mute)] transition hover:text-ink'
            >
              Template Wi-Fi
            </button>
            <button
              type='button'
              onClick={() => setText('https://')}
              className='rounded-lg border border-line-strong px-2.5 py-1 text-xs text-[var(--mute)] transition hover:text-ink'
            >
              Template URL
            </button>
          </div>

          <div className='grid grid-cols-3 gap-3 border-t border-line pt-4'>
            <label className='flex flex-col gap-1 text-xs text-[var(--mute)]'>
              Warna QR
              <input
                type='color'
                value={fg}
                onChange={(e) => setFg(e.target.value)}
                className='h-9 w-full cursor-pointer rounded border border-line-strong bg-paper p-1'
              />
            </label>
            <label className='flex flex-col gap-1 text-xs text-[var(--mute)]'>
              Latar
              <input
                type='color'
                value={bg}
                onChange={(e) => setBg(e.target.value)}
                className='h-9 w-full cursor-pointer rounded border border-line-strong bg-paper p-1'
              />
            </label>
            <label className='flex flex-col gap-1 text-xs text-[var(--mute)]'>
              Ukuran PNG
              <select
                value={sizePx}
                onChange={(e) => setSizePx(Number(e.target.value))}
                className='h-9 rounded-lg border border-line-strong bg-paper px-2 text-xs text-ink'
              >
                <option value={256}>256 px</option>
                <option value={320}>320 px</option>
                <option value={512}>512 px</option>
                <option value={1024}>1024 px</option>
              </select>
            </label>
          </div>
        </div>

        <div className='flex flex-col items-center justify-between gap-4 rounded-xl border border-line bg-surface/50 p-4'>
          {result.error ? (
            <div className='flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-line p-4 text-center text-xs text-err'>
              {result.error}
            </div>
          ) : (
            <div
              className='aspect-square w-full overflow-hidden rounded-lg border border-line'
              dangerouslySetInnerHTML={{ __html: svgString }}
            />
          )}

          <div className='flex w-full flex-col gap-2'>
            <button
              type='button'
              disabled={!result.matrix}
              onClick={downloadPng}
              className='w-full rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:opacity-90 disabled:opacity-40'
            >
              Unduh PNG
            </button>
            <div className='grid grid-cols-2 gap-2'>
              <button
                type='button'
                disabled={!result.matrix}
                onClick={downloadSvg}
                className='rounded-lg border border-line-strong px-3 py-1.5 text-xs transition hover:border-accent disabled:opacity-40'
              >
                Unduh SVG
              </button>
              <button
                type='button'
                disabled={!result.matrix}
                onClick={copySvg}
                className='rounded-lg border border-line-strong px-3 py-1.5 text-xs transition hover:border-accent disabled:opacity-40'
              >
                {copied ? 'Tersalin' : 'Salin SVG'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ToolShell>
  );
}
