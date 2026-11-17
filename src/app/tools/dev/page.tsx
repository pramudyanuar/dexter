'use client';

import * as React from 'react';

import ToolShell from '@/components/tools/ToolShell';

type Tab = 'json' | 'base64' | 'uuid-hash';

function sortJsonKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonKeys);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      out[k] = sortJsonKeys((value as Record<string, unknown>)[k]);
    }
    return out;
  }
  return value;
}

function toBase64Utf8(text: string, urlSafe: boolean): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin);
  return urlSafe
    ? b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    : b64;
}

function fromBase64Utf8(input: string): string {
  const normalized = input.trim().replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4;
  const padded = pad ? normalized + '='.repeat(4 - pad) : normalized;
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function digestHex(
  algo: 'SHA-1' | 'SHA-256' | 'SHA-512',
  text: string,
): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest(algo, data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export default function DevToolPage() {
  const [tab, setTab] = React.useState<Tab>('json');
  const [copied, setCopied] = React.useState('');

  // JSON state
  const [jsonInput, setJsonInput] = React.useState(
    '{"nama":"dexter","fitur":["games","paste","tools"],"aktif":true}',
  );
  const [jsonOutput, setJsonOutput] = React.useState('');
  const [jsonError, setJsonError] = React.useState('');

  // Base64 state
  const [b64Input, setB64Input] = React.useState('Halo Dexter!');
  const [b64Output, setB64Output] = React.useState('');
  const [b64UrlSafe, setB64UrlSafe] = React.useState(false);
  const [b64Error, setB64Error] = React.useState('');

  // UUID & Hash state
  const [uuids, setUuids] = React.useState<string[]>(() =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? [crypto.randomUUID()]
      : [],
  );
  const [hashInput, setHashInput] = React.useState('dexter');
  const [hashes, setHashes] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      digestHex('SHA-1', hashInput),
      digestHex('SHA-256', hashInput),
      digestHex('SHA-512', hashInput),
    ])
      .then(([sha1, sha256, sha512]) => {
        if (!cancelled)
          setHashes({ 'SHA-1': sha1, 'SHA-256': sha256, 'SHA-512': sha512 });
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [hashInput]);

  const copy = async (key: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? '' : c)), 1500);
  };

  const runJson = (mode: 'format2' | 'format4' | 'minify' | 'sort') => {
    try {
      const parsed = JSON.parse(jsonInput);
      const target = mode === 'sort' ? sortJsonKeys(parsed) : parsed;
      const spaces = mode === 'minify' ? 0 : mode === 'format4' ? 4 : 2;
      setJsonOutput(JSON.stringify(target, null, spaces));
      setJsonError('');
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'JSON tidak valid');
    }
  };

  const genUuids = (count: number) => {
    setUuids(Array.from({ length: count }, () => crypto.randomUUID()));
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'json', label: 'JSON Formatter' },
    { id: 'base64', label: 'Base64 UTF-8' },
    { id: 'uuid-hash', label: 'UUID & Hash' },
  ];

  return (
    <ToolShell
      title='JSON, Base64 & Hash'
      description='Kumpulan utilitas developer yang berjalan 100% lokal di browser.'
      wide
    >
      <div className='mb-5 flex flex-wrap gap-2'>
        {tabs.map((t) => (
          <button
            key={t.id}
            type='button'
            onClick={() => setTab(t.id)}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
              tab === t.id
                ? 'border-transparent bg-ink text-paper'
                : 'border-line-strong text-[var(--mute)] hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'json' && (
        <div className='flex flex-col gap-4'>
          <div className='flex flex-wrap gap-2'>
            <button
              type='button'
              onClick={() => runJson('format2')}
              className='rounded-lg bg-ink px-3.5 py-1.5 text-xs font-medium text-paper'
            >
              Format (2 spasi)
            </button>
            <button
              type='button'
              onClick={() => runJson('format4')}
              className='rounded-lg border border-line-strong px-3.5 py-1.5 text-xs hover:border-accent'
            >
              Format (4 spasi)
            </button>
            <button
              type='button'
              onClick={() => runJson('minify')}
              className='rounded-lg border border-line-strong px-3.5 py-1.5 text-xs hover:border-accent'
            >
              Minify
            </button>
            <button
              type='button'
              onClick={() => runJson('sort')}
              className='rounded-lg border border-line-strong px-3.5 py-1.5 text-xs hover:border-accent'
            >
              Sort Keys
            </button>
          </div>

          {jsonError && (
            <div className='rounded-lg border border-err/40 bg-err/10 px-3 py-2 text-xs text-err'>
              {jsonError}
            </div>
          )}

          <div className='grid gap-4 md:grid-cols-2'>
            <div className='flex flex-col gap-1.5'>
              <span className='text-xs text-[var(--mute)]'>Input JSON</span>
              <textarea
                rows={14}
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                className='w-full rounded-xl border border-line-strong bg-paper p-3 font-mono text-xs text-ink focus:border-accent focus:outline-none'
              />
            </div>

            <div className='flex flex-col gap-1.5'>
              <div className='flex items-center justify-between'>
                <span className='text-xs text-[var(--mute)]'>Hasil</span>
                {jsonOutput && (
                  <button
                    type='button'
                    onClick={() => copy('json', jsonOutput)}
                    className='text-xs text-accent hover:underline'
                  >
                    {copied === 'json' ? 'Tersalin' : 'Salin Hasil'}
                  </button>
                )}
              </div>
              <textarea
                rows={14}
                readOnly
                value={jsonOutput}
                placeholder='Klik salah satu tombol di atas...'
                className='w-full rounded-xl border border-line bg-surface/50 p-3 font-mono text-xs text-ink focus:outline-none'
              />
            </div>
          </div>
        </div>
      )}

      {tab === 'base64' && (
        <div className='flex flex-col gap-4'>
          <div className='flex flex-wrap items-center gap-3'>
            <button
              type='button'
              onClick={() => {
                try {
                  setB64Output(toBase64Utf8(b64Input, b64UrlSafe));
                  setB64Error('');
                } catch (err) {
                  setB64Error(
                    err instanceof Error ? err.message : 'Gagal encode',
                  );
                }
              }}
              className='rounded-lg bg-ink px-3.5 py-1.5 text-xs font-medium text-paper'
            >
              Encode → Base64
            </button>
            <button
              type='button'
              onClick={() => {
                try {
                  setB64Output(fromBase64Utf8(b64Input));
                  setB64Error('');
                } catch {
                  setB64Error('Input Base64 tidak valid.');
                }
              }}
              className='rounded-lg border border-line-strong px-3.5 py-1.5 text-xs hover:border-accent'
            >
              Decode → Teks
            </button>
            <label className='flex items-center gap-2 text-xs text-[var(--mute)]'>
              <input
                type='checkbox'
                checked={b64UrlSafe}
                onChange={(e) => setB64UrlSafe(e.target.checked)}
              />
              URL-safe (- dan _)
            </label>
          </div>

          {b64Error && (
            <div className='rounded-lg border border-err/40 bg-err/10 px-3 py-2 text-xs text-err'>
              {b64Error}
            </div>
          )}

          <div className='grid gap-4 md:grid-cols-2'>
            <textarea
              rows={10}
              value={b64Input}
              onChange={(e) => setB64Input(e.target.value)}
              placeholder='Masukkan teks atau string Base64...'
              className='w-full rounded-xl border border-line-strong bg-paper p-3 font-mono text-xs text-ink focus:border-accent focus:outline-none'
            />
            <div className='flex flex-col gap-1.5'>
              <textarea
                rows={10}
                readOnly
                value={b64Output}
                placeholder='Hasil...'
                className='w-full rounded-xl border border-line bg-surface/50 p-3 font-mono text-xs text-ink focus:outline-none'
              />
              {b64Output && (
                <button
                  type='button'
                  onClick={() => copy('b64', b64Output)}
                  className='self-end text-xs text-accent hover:underline'
                >
                  {copied === 'b64' ? 'Tersalin' : 'Salin Hasil'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'uuid-hash' && (
        <div className='grid gap-6 md:grid-cols-2'>
          <div className='flex flex-col gap-3 rounded-xl border border-line bg-surface/50 p-4'>
            <div className='flex items-center justify-between'>
              <h2 className='text-sm font-semibold'>UUID v4 Generator</h2>
              <div className='flex gap-1.5'>
                {[1, 5, 10].map((n) => (
                  <button
                    key={n}
                    type='button'
                    onClick={() => genUuids(n)}
                    className='rounded-lg border border-line-strong px-2.5 py-1 text-xs hover:border-accent'
                  >
                    +{n}
                  </button>
                ))}
              </div>
            </div>

            <ul className='flex flex-col gap-1.5'>
              {uuids.map((id) => (
                <li
                  key={id}
                  className='flex items-center justify-between gap-2 rounded-lg border border-line bg-paper px-3 py-1.5 font-mono text-xs'
                >
                  <span className='truncate'>{id}</span>
                  <button
                    type='button'
                    onClick={() => copy(id, id)}
                    className='shrink-0 text-accent hover:underline'
                  >
                    {copied === id ? 'Tersalin' : 'Salin'}
                  </button>
                </li>
              ))}
            </ul>

            {uuids.length > 1 && (
              <button
                type='button'
                onClick={() => copy('all-uuid', uuids.join('\n'))}
                className='self-end text-xs text-[var(--mute)] hover:text-ink'
              >
                {copied === 'all-uuid' ? 'Semua Tersalin' : 'Salin Semua'}
              </button>
            )}
          </div>

          <div className='flex flex-col gap-3 rounded-xl border border-line bg-surface/50 p-4'>
            <h2 className='text-sm font-semibold'>Hash Generator</h2>
            <textarea
              rows={3}
              value={hashInput}
              onChange={(e) => setHashInput(e.target.value)}
              placeholder='Teks yang ingin di-hash...'
              className='w-full rounded-lg border border-line-strong bg-paper p-2.5 font-mono text-xs text-ink focus:border-accent focus:outline-none'
            />
            <div className='flex flex-col gap-2'>
              {Object.entries(hashes).map(([algo, hex]) => (
                <div
                  key={algo}
                  className='rounded-lg border border-line bg-paper p-2.5'
                >
                  <div className='mb-1 flex items-center justify-between text-[11px] text-[var(--mute)]'>
                    <span>{algo}</span>
                    <button
                      type='button'
                      onClick={() => copy(algo, hex)}
                      className='text-accent hover:underline'
                    >
                      {copied === algo ? 'Tersalin' : 'Salin'}
                    </button>
                  </div>
                  <div className='font-mono text-xs break-all text-ink'>
                    {hex}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </ToolShell>
  );
}
