'use client';

import * as React from 'react';

import ToolShell from '@/features/tools/components/ToolShell';

const SAMPLE_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEyMyIsIm5hbWEiOiJEZXh0ZXIiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MTk5OTk5OTk5OX0.signature';

function decodeBase64Url(part: string): string {
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  const padded = pad ? b64 + '='.repeat(4 - pad) : b64;
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function formatUnix(sec: unknown): string | null {
  if (typeof sec !== 'number' || !Number.isFinite(sec)) return null;
  return new Date(sec * 1000).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function JwtToolPage() {
  const [token, setToken] = React.useState(SAMPLE_JWT);
  const [now, setNow] = React.useState(() => Date.now());

  const decoded = React.useMemo(() => {
    const clean = token.trim();
    if (!clean) return { header: null, payload: null, error: '' };
    const parts = clean.split('.');
    if (parts.length < 2 || parts.length > 3) {
      return {
        header: null,
        payload: null,
        error: 'Format JWT harus terdiri dari 2 atau 3 bagian (dipisah titik).',
      };
    }
    try {
      const header = JSON.parse(decodeBase64Url(parts[0])) as Record<
        string,
        unknown
      >;
      const payload = JSON.parse(decodeBase64Url(parts[1])) as Record<
        string,
        unknown
      >;
      return { header, payload, error: '' };
    } catch {
      return {
        header: null,
        payload: null,
        error: 'Gagal membaca Base64URL/JSON dari token JWT.',
      };
    }
  }, [token]);

  const expSec =
    decoded.payload && typeof decoded.payload.exp === 'number'
      ? decoded.payload.exp
      : null;
  const isExpired = expSec !== null && expSec * 1000 < now;

  return (
    <ToolShell
      title='JWT Decoder'
      description='Decode header dan payload JWT secara lokal di browser. Token tidak pernah dikirim ke server.'
      wide
    >
      <div className='flex flex-col gap-4'>
        <textarea
          rows={4}
          value={token}
          onChange={(e) => {
            setToken(e.target.value);
            setNow(Date.now());
          }}
          placeholder='Tempel token JWT (eyJ...) di sini...'
          className='w-full rounded-xl border border-line-strong bg-paper p-3 font-mono text-xs break-all text-ink focus:border-accent focus:outline-none'
        />

        {decoded.error && (
          <div className='rounded-xl border border-err/40 bg-err/10 px-3.5 py-2 text-xs text-err'>
            {decoded.error}
          </div>
        )}

        {decoded.header && decoded.payload && (
          <>
            {expSec !== null && (
              <div
                className={`rounded-xl border px-4 py-2.5 text-xs ${
                  isExpired
                    ? 'border-err/40 bg-err/10 text-err'
                    : 'border-accent/40 bg-accent/10 text-accent'
                }`}
              >
                {isExpired ? 'Token sudah kedaluwarsa' : 'Token masih berlaku'}{' '}
                — exp: {formatUnix(expSec)}
              </div>
            )}

            <div className='grid gap-4 md:grid-cols-2'>
              <div className='rounded-xl border border-line bg-surface/50 p-4'>
                <h2 className='mb-2 text-xs font-medium text-[var(--mute)]'>
                  HEADER
                </h2>
                <pre className='overflow-x-auto font-mono text-xs text-ink'>
                  {JSON.stringify(decoded.header, null, 2)}
                </pre>
              </div>

              <div className='rounded-xl border border-line bg-surface/50 p-4'>
                <h2 className='mb-2 text-xs font-medium text-[var(--mute)]'>
                  PAYLOAD
                </h2>
                <pre className='overflow-x-auto font-mono text-xs text-ink'>
                  {JSON.stringify(decoded.payload, null, 2)}
                </pre>
                {typeof decoded.payload.iat === 'number' && (
                  <p className='mt-3 border-t border-line pt-2 text-[11px] text-[var(--mute)]'>
                    iat: {formatUnix(decoded.payload.iat)}
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </ToolShell>
  );
}
