'use client';

import * as React from 'react';

const JSDOS_CSS = 'https://v8.js-dos.com/latest/js-dos.css';
const JSDOS_JS = 'https://v8.js-dos.com/latest/js-dos.js';

interface DosProps {
  stop?: () => Promise<void> | void;
}

declare global {
  interface Window {
    Dos?: (
      element: HTMLElement,
      options: {
        url: string;
        autoStart?: boolean;
        mouseCapture?: boolean;
      },
    ) => DosProps;
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`,
    );
    if (existing && window.Dos) {
      resolve();
      return;
    }
    const script = existing ?? document.createElement('script');
    script.src = src;
    script.async = true;
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener(
      'error',
      () => reject(new Error('Gagal memuat emulator js-dos')),
      { once: true },
    );
    if (!existing) document.head.appendChild(script);
  });
}

export default function JsDosPlayer({
  title,
  bundleUrl,
  controls,
}: {
  title: string;
  bundleUrl: string;
  controls: string;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [errorMsg, setErrorMsg] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    let instance: DosProps | null = null;

    if (!document.querySelector(`link[href="${JSDOS_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = JSDOS_CSS;
      document.head.appendChild(link);
    }

    loadScript(JSDOS_JS)
      .then(() => {
        if (cancelled || !containerRef.current || !window.Dos) return;
        instance = window.Dos(containerRef.current, {
          url: bundleUrl,
          autoStart: true,
          mouseCapture: true,
        });
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(
          err instanceof Error ? err.message : `Gagal menjalankan ${title}`,
        );
        setStatus('error');
      });

    return () => {
      cancelled = true;
      if (instance && typeof instance.stop === 'function') {
        void instance.stop();
      }
    };
  }, [bundleUrl, title]);

  return (
    <div className='mx-auto flex w-full max-w-4xl flex-col gap-3'>
      <div className='flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface/60 px-4 py-2.5 text-xs'>
        <div className='flex items-center gap-2'>
          <span className='font-semibold text-ink'>{title}</span>
          <span className='rounded-full border border-line-strong bg-paper px-2 py-0.5 text-[10px] text-[var(--mute)]'>
            DOSBox WASM
          </span>
        </div>
        <span className='text-[var(--mute)]'>
          Klik layar untuk mulai &amp; tangkap mouse
        </span>
      </div>

      <div className='relative aspect-[16/10] w-full overflow-hidden rounded-xl border-2 border-[#3b2024] bg-black shadow-2xl'>
        {status === 'loading' && (
          <div className='absolute inset-0 z-10 flex items-center justify-center bg-black/85 text-sm text-[var(--mute)]'>
            Memuat {title} (DOSBox WebAssembly)…
          </div>
        )}
        {status === 'error' && (
          <div className='absolute inset-0 z-10 flex items-center justify-center bg-black/90 p-6 text-center text-sm text-err'>
            {errorMsg}
          </div>
        )}
        <div ref={containerRef} className='size-full' />
      </div>

      <p className='text-center text-xs text-[var(--mute)]'>{controls}</p>
    </div>
  );
}
