'use client';

import * as React from 'react';

import ToolShell from '@/features/tools/components/ToolShell';

function toTitleCase(text: string): string {
  return text.replace(
    /\w\S*/g,
    (w) => w[0].toUpperCase() + w.slice(1).toLowerCase(),
  );
}

function splitWords(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);
}

export default function TextToolPage() {
  const [text, setText] = React.useState(
    'Halo dunia!\nIni contoh teks untuk dihitung atau diubah formatnya.',
  );
  const [copied, setCopied] = React.useState(false);

  const stats = React.useMemo(() => {
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars = text.length;
    const charsNoSpace = text.replace(/\s/g, '').length;
    const lines = text ? text.split('\n').length : 0;
    const readMin = Math.max(1, Math.ceil(words / 200));
    return { words, chars, charsNoSpace, lines, readMin };
  }, [text]);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const transforms: { label: string; run: () => void }[] = [
    { label: 'UPPERCASE', run: () => setText(text.toUpperCase()) },
    { label: 'lowercase', run: () => setText(text.toLowerCase()) },
    { label: 'Title Case', run: () => setText(toTitleCase(text)) },
    {
      label: 'camelCase',
      run: () =>
        setText(
          splitWords(text)
            .map((w, i) =>
              i === 0
                ? w.toLowerCase()
                : w[0].toUpperCase() + w.slice(1).toLowerCase(),
            )
            .join(''),
        ),
    },
    {
      label: 'snake_case',
      run: () =>
        setText(
          splitWords(text)
            .map((w) => w.toLowerCase())
            .join('_'),
        ),
    },
    {
      label: 'kebab-case',
      run: () =>
        setText(
          splitWords(text)
            .map((w) => w.toLowerCase())
            .join('-'),
        ),
    },
    {
      label: 'Hapus Duplikat Baris',
      run: () => setText(Array.from(new Set(text.split('\n'))).join('\n')),
    },
    {
      label: 'Urutkan Baris A-Z',
      run: () =>
        setText(
          text
            .split('\n')
            .sort((a, b) => a.localeCompare(b))
            .join('\n'),
        ),
    },
    {
      label: 'Rapikan Spasi',
      run: () =>
        setText(
          text
            .split('\n')
            .map((l) => l.trim().replace(/\s+/g, ' '))
            .join('\n'),
        ),
    },
  ];

  return (
    <ToolShell
      title='Word Counter & Case'
      description='Hitung kata, karakter, estimasi waktu baca, dan ubah format teks sekali klik.'
    >
      <div className='mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4'>
        {[
          ['Kata', stats.words],
          ['Karakter', stats.chars],
          ['Tanpa Spasi', stats.charsNoSpace],
          ['Baris', stats.lines],
        ].map(([label, val]) => (
          <div
            key={String(label)}
            className='rounded-xl border border-line bg-surface/50 px-3.5 py-2.5'
          >
            <div className='text-xs text-[var(--mute)]'>{label}</div>
            <div className='font-mono text-xl font-semibold text-ink'>
              {val}
            </div>
          </div>
        ))}
      </div>

      <div className='mb-3 flex flex-wrap gap-2'>
        {transforms.map((t) => (
          <button
            key={t.label}
            type='button'
            onClick={t.run}
            className='rounded-lg border border-line-strong px-2.5 py-1 text-xs text-ink transition hover:border-accent hover:text-accent'
          >
            {t.label}
          </button>
        ))}
      </div>

      <textarea
        rows={11}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='Tempel atau ketik teks di sini...'
        className='w-full rounded-xl border border-line-strong bg-paper p-3.5 font-mono text-sm text-ink focus:border-accent focus:outline-none'
      />

      <div className='mt-3 flex items-center justify-between text-xs text-[var(--mute)]'>
        <span>Estimasi baca: ~{stats.readMin} menit</span>
        <div className='flex gap-2'>
          <button
            type='button'
            onClick={copy}
            className='rounded-lg border border-line-strong px-3 py-1.5 text-ink hover:border-accent'
          >
            {copied ? 'Tersalin' : 'Salin Teks'}
          </button>
          <button
            type='button'
            onClick={() => setText('')}
            className='rounded-lg border border-line-strong px-3 py-1.5 hover:text-ink'
          >
            Kosongkan
          </button>
        </div>
      </div>
    </ToolShell>
  );
}
