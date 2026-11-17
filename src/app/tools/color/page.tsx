'use client';

import * as React from 'react';

import ToolShell from '@/components/tools/ToolShell';

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
    }
    h /= 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function luminance(r: number, g: number, b: number): number {
  const lin = [r, g, b].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrastRatio(hexA: string, hexB: string): number {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  if (!a || !b) return 1;
  const la = luminance(...a);
  const lb = luminance(...b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

export default function ColorToolPage() {
  const [fg, setFg] = React.useState('#e9eaee');
  const [bg, setBg] = React.useState('#0e1015');
  const [copied, setCopied] = React.useState('');

  const fgRgb = hexToRgb(fg) ?? [233, 234, 238];
  const fgHsl = rgbToHsl(...fgRgb);
  const ratio = contrastRatio(fg, bg);

  const formats = [
    { label: 'HEX', value: fg.toUpperCase() },
    { label: 'RGB', value: `rgb(${fgRgb.join(', ')})` },
    { label: 'HSL', value: `hsl(${fgHsl[0]}, ${fgHsl[1]}%, ${fgHsl[2]}%)` },
  ];

  const copy = async (key: string, val: string) => {
    await navigator.clipboard.writeText(val);
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? '' : c)), 1500);
  };

  return (
    <ToolShell
      title='Color & Contrast'
      description='Konversi format warna HEX/RGB/HSL serta cek rasio kontras teks WCAG AA & AAA.'
    >
      <div className='grid gap-6 md:grid-cols-2'>
        <div className='flex flex-col gap-4 rounded-xl border border-line bg-surface/50 p-4'>
          <div className='grid grid-cols-2 gap-3'>
            <label className='flex flex-col gap-1.5 text-xs text-[var(--mute)]'>
              Warna Teks
              <div className='flex items-center gap-2'>
                <input
                  type='color'
                  value={fg}
                  onChange={(e) => setFg(e.target.value)}
                  className='h-9 w-12 cursor-pointer rounded border border-line-strong bg-paper p-0.5'
                />
                <input
                  type='text'
                  value={fg}
                  onChange={(e) => setFg(e.target.value)}
                  className='w-full rounded-lg border border-line-strong bg-paper px-2.5 py-1.5 font-mono text-xs text-ink'
                />
              </div>
            </label>

            <label className='flex flex-col gap-1.5 text-xs text-[var(--mute)]'>
              Warna Latar
              <div className='flex items-center gap-2'>
                <input
                  type='color'
                  value={bg}
                  onChange={(e) => setBg(e.target.value)}
                  className='h-9 w-12 cursor-pointer rounded border border-line-strong bg-paper p-0.5'
                />
                <input
                  type='text'
                  value={bg}
                  onChange={(e) => setBg(e.target.value)}
                  className='w-full rounded-lg border border-line-strong bg-paper px-2.5 py-1.5 font-mono text-xs text-ink'
                />
              </div>
            </label>
          </div>

          <ul className='flex flex-col gap-2 border-t border-line pt-3'>
            {formats.map((f) => (
              <li
                key={f.label}
                className='flex items-center justify-between rounded-lg border border-line bg-paper px-3 py-2 text-xs'
              >
                <span className='text-[var(--mute)]'>{f.label}</span>
                <div className='flex items-center gap-2'>
                  <span className='font-mono text-ink'>{f.value}</span>
                  <button
                    type='button'
                    onClick={() => copy(f.label, f.value)}
                    className='text-accent hover:underline'
                  >
                    {copied === f.label ? 'Tersalin' : 'Salin'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className='flex flex-col gap-4 rounded-xl border border-line bg-surface/50 p-4'>
          <div
            className='flex flex-col gap-1 rounded-xl border border-line p-5'
            style={{ backgroundColor: bg, color: fg }}
          >
            <span className='text-lg font-semibold'>Contoh Judul Besar</span>
            <span className='text-sm'>
              Ini contoh teks paragraf normal di atas warna latar pilihanmu.
            </span>
          </div>

          <div className='flex items-center justify-between'>
            <span className='text-xs text-[var(--mute)]'>Rasio Kontras</span>
            <span className='font-mono text-xl font-semibold text-ink'>
              {ratio.toFixed(2)}:1
            </span>
          </div>

          <div className='grid grid-cols-2 gap-2 text-xs'>
            <div className='rounded-lg border border-line bg-paper px-3 py-2'>
              WCAG AA Normal (≥4.5):{' '}
              <strong className={ratio >= 4.5 ? 'text-accent' : 'text-err'}>
                {ratio >= 4.5 ? 'Lolos' : 'Kurang'}
              </strong>
            </div>
            <div className='rounded-lg border border-line bg-paper px-3 py-2'>
              WCAG AAA Normal (≥7):{' '}
              <strong className={ratio >= 7 ? 'text-accent' : 'text-err'}>
                {ratio >= 7 ? 'Lolos' : 'Kurang'}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </ToolShell>
  );
}
