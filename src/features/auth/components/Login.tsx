'use client';

import * as React from 'react';

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const submit = async (value: string) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: value }),
      });
      if (res.ok) return onSuccess();
      const data = await res.json().catch(() => null);
      setError(data?.error ?? `HTTP ${res.status}`);
    } catch {
      setError('Server tidak terjangkau');
    }
    setCode('');
    setBusy(false);
  };

  return (
    <main className='flex h-dvh flex-col justify-center bg-paper px-4 font-mono text-[13.5px] text-ink'>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (code.length === 6 && !busy) submit(code);
        }}
        className='leading-6'
      >
        <p>
          <span className='text-accent'>dexter@chat</span>
          <span className='text-mute'>:</span>
          <span className='text-info'>~</span>
          <span className='text-mute'>$</span> login
        </p>
        <p className='mt-2 text-mute'>
          # Masukkan kode 6 digit dari aplikasi authenticator.
        </p>
        <label className='mt-4 flex items-center gap-2'>
          <span className='text-accent'>otp:</span>
          <input
            autoFocus
            inputMode='numeric'
            autoComplete='one-time-code'
            maxLength={6}
            value={code}
            disabled={busy}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '');
              setCode(value);
              if (value.length === 6) submit(value);
            }}
            aria-label='Kode OTP'
            placeholder='······'
            className='w-28 border-0 bg-transparent p-0 tracking-[0.4em] placeholder:text-mute focus:ring-0 focus:outline-none'
          />
        </label>
        {error && <p className='mt-3 text-err'>{error}</p>}
      </form>
    </main>
  );
}
