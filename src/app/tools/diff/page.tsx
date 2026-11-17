'use client';

import * as React from 'react';

import ToolShell from '@/components/tools/ToolShell';

interface DiffLine {
  type: 'same' | 'add' | 'del';
  text: string;
}

function diffLines(aText: string, bText: string): DiffLine[] {
  const a = aText.split('\n');
  const b = bText.split('\n');
  const m = a.length;
  const n = b.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array<number>(n + 1).fill(0),
  );
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j]
          ? 1 + dp[i + 1][j + 1]
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push({ type: 'same', text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: 'del', text: a[i] });
      i++;
    } else {
      out.push({ type: 'add', text: b[j] });
      j++;
    }
  }
  while (i < m) out.push({ type: 'del', text: a[i++] });
  while (j < n) out.push({ type: 'add', text: b[j++] });
  return out;
}

export default function DiffToolPage() {
  const [left, setLeft] = React.useState(
    'nama: dexter\nversi: 1.0\nfitur: games\nstatus: aktif',
  );
  const [right, setRight] = React.useState(
    'nama: dexter\nversi: 2.0\nfitur: games + tools\nmode: publik\nstatus: aktif',
  );

  const lines = React.useMemo(() => diffLines(left, right), [left, right]);
  const added = lines.filter((l) => l.type === 'add').length;
  const deleted = lines.filter((l) => l.type === 'del').length;

  return (
    <ToolShell
      title='Diff Checker'
      description='Bandingkan dua teks atau kode baris demi baris untuk melihat bagian yang ditambah atau dihapus.'
      wide
    >
      <div className='mb-4 grid gap-4 md:grid-cols-2'>
        <div className='flex flex-col gap-1.5'>
          <span className='text-xs text-[var(--mute)]'>Teks Asli</span>
          <textarea
            rows={10}
            value={left}
            onChange={(e) => setLeft(e.target.value)}
            className='w-full rounded-xl border border-line-strong bg-paper p-3 font-mono text-xs text-ink focus:border-accent focus:outline-none'
          />
        </div>
        <div className='flex flex-col gap-1.5'>
          <span className='text-xs text-[var(--mute)]'>Teks Baru</span>
          <textarea
            rows={10}
            value={right}
            onChange={(e) => setRight(e.target.value)}
            className='w-full rounded-xl border border-line-strong bg-paper p-3 font-mono text-xs text-ink focus:border-accent focus:outline-none'
          />
        </div>
      </div>

      <div className='mb-3 flex flex-wrap items-center justify-between gap-2 text-xs'>
        <div className='flex gap-3'>
          <span className='text-accent'>+{added} ditambah</span>
          <span className='text-err'>-{deleted} dihapus</span>
        </div>
        <div className='flex gap-2'>
          <button
            type='button'
            onClick={() => {
              setLeft(right);
              setRight(left);
            }}
            className='rounded-lg border border-line-strong px-2.5 py-1 text-[var(--mute)] hover:text-ink'
          >
            Tukar Kiri/Kanan
          </button>
          <button
            type='button'
            onClick={() => {
              setLeft('');
              setRight('');
            }}
            className='rounded-lg border border-line-strong px-2.5 py-1 text-[var(--mute)] hover:text-ink'
          >
            Kosongkan
          </button>
        </div>
      </div>

      <div className='overflow-hidden rounded-xl border border-line bg-paper font-mono text-xs'>
        {lines.map((line, idx) => (
          <div
            key={idx}
            className={`flex gap-3 px-3 py-1 ${
              line.type === 'add'
                ? 'bg-accent/15 text-accent'
                : line.type === 'del'
                  ? 'bg-err/15 text-err'
                  : 'text-ink'
            }`}
          >
            <span className='w-4 shrink-0 opacity-70 select-none'>
              {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}
            </span>
            <span className='break-all whitespace-pre-wrap'>
              {line.text || ' '}
            </span>
          </div>
        ))}
      </div>
    </ToolShell>
  );
}
