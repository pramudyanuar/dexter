'use client';

import * as React from 'react';

import ToolShell from '@/features/tools/components/ToolShell';

const WORDS = [
  'langit',
  'kopi',
  'bintang',
  'ombak',
  'senja',
  'hujan',
  'angin',
  'gunung',
  'daun',
  'pelangi',
  'cahaya',
  'batu',
  'sungai',
  'api',
  'awan',
  'bulan',
  'pasir',
  'kayu',
  'embun',
  'rimba',
  'merah',
  'biru',
  'hijau',
  'emas',
  'perak',
  'kilat',
  'gema',
  'nada',
  'peta',
  'kompas',
  'layar',
  'pulau',
];

function secureRandInt(max: number): number {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / max) * max;
  let x = 0;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return x % max;
}

export default function PasswordToolPage() {
  const [mode, setMode] = React.useState<'password' | 'passphrase'>('password');
  const [length, setLength] = React.useState(16);
  const [upper, setUpper] = React.useState(true);
  const [lower, setLower] = React.useState(true);
  const [digits, setDigits] = React.useState(true);
  const [symbols, setSymbols] = React.useState(true);
  const [noAmbiguous, setNoAmbiguous] = React.useState(true);
  const [wordCount, setWordCount] = React.useState(4);
  const [separator, setSeparator] = React.useState('-');
  const [passwords, setPasswords] = React.useState<string[]>([]);
  const [copied, setCopied] = React.useState('');

  const generate = React.useCallback(() => {
    const out: string[] = [];
    for (let k = 0; k < 5; k++) {
      if (mode === 'passphrase') {
        const picked = Array.from(
          { length: wordCount },
          () => WORDS[secureRandInt(WORDS.length)],
        );
        out.push(picked.join(separator));
      } else {
        let pool = '';
        if (upper)
          pool += noAmbiguous
            ? 'ABCDEFGHJKLMNPQRSTUVWXYZ'
            : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        if (lower)
          pool += noAmbiguous
            ? 'abcdefghijkmnopqrstuvwxyz'
            : 'abcdefghijklmnopqrstuvwxyz';
        if (digits) pool += noAmbiguous ? '23456789' : '0123456789';
        if (symbols) pool += '!@#$%^&*()-_=+[]{}';
        if (!pool) pool = 'abcdefghijkmnopqrstuvwxyz23456789';
        let pw = '';
        for (let i = 0; i < length; i++) {
          pw += pool[secureRandInt(pool.length)];
        }
        out.push(pw);
      }
    }
    setPasswords(out);
  }, [
    mode,
    length,
    upper,
    lower,
    digits,
    symbols,
    noAmbiguous,
    wordCount,
    separator,
  ]);

  React.useEffect(() => {
    const t = setTimeout(generate, 0);
    return () => clearTimeout(t);
  }, [generate]);

  const copy = async (id: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? '' : c)), 1500);
  };

  return (
    <ToolShell
      title='Password Generator'
      description='Buat password atau passphrase acak secara aman menggunakan crypto.getRandomValues di browser.'
    >
      <div className='flex flex-col gap-5'>
        <div className='flex items-center justify-between gap-3'>
          <div className='flex gap-2'>
            <button
              type='button'
              onClick={() => setMode('password')}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                mode === 'password'
                  ? 'border-transparent bg-ink text-paper'
                  : 'border-line-strong text-[var(--mute)] hover:text-ink'
              }`}
            >
              Password Acak
            </button>
            <button
              type='button'
              onClick={() => setMode('passphrase')}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                mode === 'passphrase'
                  ? 'border-transparent bg-ink text-paper'
                  : 'border-line-strong text-[var(--mute)] hover:text-ink'
              }`}
            >
              Passphrase
            </button>
          </div>

          <button
            type='button'
            onClick={generate}
            className='rounded-lg bg-ink px-4 py-1.5 text-xs font-medium text-paper transition hover:opacity-90'
          >
            Acak Ulang
          </button>
        </div>

        <div className='rounded-xl border border-line bg-surface/50 p-4'>
          {mode === 'password' ? (
            <div className='flex flex-col gap-4'>
              <label className='flex flex-col gap-1.5 text-xs text-[var(--mute)]'>
                Panjang: <strong className='text-ink'>{length} karakter</strong>
                <input
                  type='range'
                  min={8}
                  max={64}
                  value={length}
                  onChange={(e) => setLength(Number(e.target.value))}
                />
              </label>

              <div className='flex flex-wrap gap-4 text-xs'>
                <label className='flex items-center gap-2'>
                  <input
                    type='checkbox'
                    checked={upper}
                    onChange={(e) => setUpper(e.target.checked)}
                  />
                  Huruf besar (A-Z)
                </label>
                <label className='flex items-center gap-2'>
                  <input
                    type='checkbox'
                    checked={lower}
                    onChange={(e) => setLower(e.target.checked)}
                  />
                  Huruf kecil (a-z)
                </label>
                <label className='flex items-center gap-2'>
                  <input
                    type='checkbox'
                    checked={digits}
                    onChange={(e) => setDigits(e.target.checked)}
                  />
                  Angka (0-9)
                </label>
                <label className='flex items-center gap-2'>
                  <input
                    type='checkbox'
                    checked={symbols}
                    onChange={(e) => setSymbols(e.target.checked)}
                  />
                  Simbol (!@#$)
                </label>
                <label className='flex items-center gap-2 text-[var(--mute)]'>
                  <input
                    type='checkbox'
                    checked={noAmbiguous}
                    onChange={(e) => setNoAmbiguous(e.target.checked)}
                  />
                  Hindari karakter mirip (0/O, 1/l/I)
                </label>
              </div>
            </div>
          ) : (
            <div className='grid grid-cols-2 gap-4'>
              <label className='flex flex-col gap-1.5 text-xs text-[var(--mute)]'>
                Jumlah Kata: <strong className='text-ink'>{wordCount}</strong>
                <input
                  type='range'
                  min={3}
                  max={8}
                  value={wordCount}
                  onChange={(e) => setWordCount(Number(e.target.value))}
                />
              </label>
              <label className='flex flex-col gap-1.5 text-xs text-[var(--mute)]'>
                Pemisah
                <select
                  value={separator}
                  onChange={(e) => setSeparator(e.target.value)}
                  className='rounded-lg border border-line-strong bg-paper px-3 py-1.5 text-sm text-ink'
                >
                  <option value='-'>Tanda hubung (-)</option>
                  <option value='_'>Garis bawah (_)</option>
                  <option value='.'>Titik (.)</option>
                  <option value=' '>Spasi</option>
                </select>
              </label>
            </div>
          )}
        </div>

        <ul className='flex flex-col gap-2'>
          {passwords.map((pw, idx) => (
            <li
              key={`${idx}-${pw}`}
              className='flex items-center justify-between gap-3 rounded-xl border border-line bg-surface/50 px-4 py-3'
            >
              <span className='min-w-0 flex-1 font-mono text-sm break-all text-ink'>
                {pw}
              </span>
              <button
                type='button'
                onClick={() => copy(`pw-${idx}`, pw)}
                className='shrink-0 rounded-lg border border-line-strong px-3 py-1 text-xs transition hover:border-accent hover:text-accent'
              >
                {copied === `pw-${idx}` ? 'Tersalin' : 'Salin'}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </ToolShell>
  );
}
