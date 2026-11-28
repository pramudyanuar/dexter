'use client';

import * as React from 'react';

import ToolShell from '@/features/tools/components/ToolShell';

const PRESETS = [
  { label: 'Email', pattern: '[\\w.+-]+@[\\w-]+\\.[\\w.-]+', flags: 'g' },
  { label: 'URL', pattern: 'https?:\\/\\/[^\\s]+', flags: 'g' },
  { label: 'Angka', pattern: '\\d+(?:\\.\\d+)?', flags: 'g' },
  { label: 'Tanggal', pattern: '(\\d{4})-(\\d{2})-(\\d{2})', flags: 'g' },
];

export default function RegexToolPage() {
  const [pattern, setPattern] = React.useState('(\\w+)@([\\w.-]+)');
  const [flags, setFlags] = React.useState('g');
  const [sample, setSample] = React.useState(
    'Hubungi admin@dexter.dev atau support@contoh.id sebelum 2026-12-31.',
  );

  const parsed = React.useMemo(() => {
    if (!pattern)
      return { matches: [], parts: [{ text: sample, hit: false }], error: '' };
    try {
      const safeFlags = flags.includes('g') ? flags : `${flags}g`;
      const re = new RegExp(pattern, safeFlags);
      const matches: { index: number; value: string; groups: string[] }[] = [];
      const parts: { text: string; hit: boolean }[] = [];
      let last = 0;

      for (const m of sample.matchAll(re)) {
        const idx = m.index ?? 0;
        const val = m[0];
        if (idx > last)
          parts.push({ text: sample.slice(last, idx), hit: false });
        if (val.length > 0) parts.push({ text: val, hit: true });
        last = idx + val.length;
        matches.push({
          index: idx,
          value: val,
          groups: m.slice(1).map((g) => g ?? ''),
        });
        if (val.length === 0) break;
      }
      if (last < sample.length)
        parts.push({ text: sample.slice(last), hit: false });

      return { matches, parts, error: '' };
    } catch (err) {
      return {
        matches: [],
        parts: [{ text: sample, hit: false }],
        error: err instanceof Error ? err.message : 'Pola RegEx tidak valid',
      };
    }
  }, [pattern, flags, sample]);

  const toggleFlag = (f: string) => {
    setFlags((prev) =>
      prev.includes(f) ? prev.replace(f, '') : `${prev}${f}`,
    );
  };

  return (
    <ToolShell
      title='Regex Tester'
      description='Uji pola ekspresi reguler secara langsung di browser dengan highlight dan daftar capture group.'
      wide
    >
      <div className='flex flex-col gap-4'>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-xs text-[var(--mute)]'>Preset:</span>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type='button'
              onClick={() => {
                setPattern(p.pattern);
                setFlags(p.flags);
              }}
              className='rounded-lg border border-line-strong px-2.5 py-1 text-xs text-[var(--mute)] hover:border-accent hover:text-ink'
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className='flex flex-col gap-2 sm:flex-row'>
          <div className='flex flex-1 items-center rounded-xl border border-line-strong bg-paper px-3'>
            <span className='font-mono text-sm text-[var(--mute)]'>/</span>
            <input
              type='text'
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder='pola regex...'
              className='w-full bg-transparent px-2 py-2 font-mono text-sm text-ink focus:outline-none'
            />
            <span className='font-mono text-sm text-[var(--mute)]'>
              /{flags}
            </span>
          </div>

          <div className='flex items-center gap-1.5'>
            {['g', 'i', 'm', 's'].map((f) => (
              <button
                key={f}
                type='button'
                onClick={() => toggleFlag(f)}
                className={`rounded-lg border px-3 py-2 font-mono text-xs ${
                  flags.includes(f)
                    ? 'border-transparent bg-ink text-paper'
                    : 'border-line-strong text-[var(--mute)] hover:text-ink'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {parsed.error && (
          <div className='rounded-xl border border-err/40 bg-err/10 px-3.5 py-2 text-xs text-err'>
            {parsed.error}
          </div>
        )}

        <div className='grid gap-4 md:grid-cols-2'>
          <div className='flex flex-col gap-1.5'>
            <span className='text-xs text-[var(--mute)]'>Teks Uji</span>
            <textarea
              rows={8}
              value={sample}
              onChange={(e) => setSample(e.target.value)}
              className='w-full rounded-xl border border-line-strong bg-paper p-3 font-mono text-xs leading-relaxed text-ink focus:border-accent focus:outline-none'
            />
          </div>

          <div className='flex flex-col gap-1.5'>
            <span className='text-xs text-[var(--mute)]'>
              Highlight ({parsed.matches.length} cocok)
            </span>
            <div className='min-h-[192px] rounded-xl border border-line bg-surface/50 p-3 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap'>
              {parsed.parts.map((part, i) =>
                part.hit ? (
                  <mark
                    key={i}
                    className='rounded bg-accent/25 px-0.5 text-accent'
                  >
                    {part.text}
                  </mark>
                ) : (
                  <React.Fragment key={i}>{part.text}</React.Fragment>
                ),
              )}
            </div>
          </div>
        </div>

        {parsed.matches.length > 0 && (
          <div className='rounded-xl border border-line bg-surface/50 p-4'>
            <h2 className='mb-2 text-xs font-medium text-[var(--mute)]'>
              Daftar Kecocokan
            </h2>
            <ul className='flex flex-col gap-1.5 font-mono text-xs'>
              {parsed.matches.slice(0, 30).map((m, i) => (
                <li
                  key={i}
                  className='flex flex-wrap items-center gap-2 rounded-lg border border-line bg-paper px-3 py-1.5'
                >
                  <span className='text-[var(--mute)]'>#{i + 1}</span>
                  <span className='text-accent'>{m.value}</span>
                  {m.groups.length > 0 && (
                    <span className='text-[var(--mute)]'>
                      groups: [{m.groups.map((g) => `"${g}"`).join(', ')}]
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ToolShell>
  );
}
