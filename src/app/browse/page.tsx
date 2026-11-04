'use client';

import Link from 'next/link';
import * as React from 'react';

import AuthGate, { useAuth } from '@/components/AuthGate';

/** Anything that is not clearly an address becomes a search. */
function toTarget(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (!/\s/.test(value) && /^[\w-]+(\.[\w-]+)+(:\d+)?([/?#].*)?$/.test(value)) {
    return `https://${value}`;
  }
  return `https://html.duckduckgo.com/html/?q=${encodeURIComponent(value)}`;
}

function Browse() {
  const { logout, expire } = useAuth();
  const [input, setInput] = React.useState('');
  const [src, setSrc] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const frameRef = React.useRef<HTMLIFrameElement>(null);

  // the proxied page reports where it ended up, so the address bar follows
  React.useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frameRef.current?.contentWindow) return;
      if (e.data?.type !== 'dexter-proxy' || typeof e.data.url !== 'string') {
        return;
      }
      setInput(e.data.url);
      setTitle(typeof e.data.title === 'string' ? e.data.title : '');
      setLoading(false);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const go = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const target = toTarget(input);
    if (!target) return;

    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/proxy-token');
      if (res.status === 401) return expire();
      const { token } = await res.json();
      setSrc(`/api/proxy?url=${encodeURIComponent(target)}&t=${token}`);
    } catch {
      setError('Tidak bisa menghubungi server');
      setLoading(false);
    }
  };

  const actionButton =
    'text-mute hover:text-accent text-xs transition disabled:opacity-30';

  return (
    <div className='flex h-dvh flex-col bg-paper font-mono text-[13.5px] text-ink'>
      <header className='border-b border-line'>
        <div className='flex w-full items-center justify-between gap-4 px-4 py-2.5'>
          <span className='text-sm'>
            <span className='text-accent'>dexter@web</span>
            <span className='text-mute'>:</span>
            <Link href='/apps' className='text-info hover:underline'>
              ~
            </Link>
            <span className='text-info'>/browse</span>{' '}
            <span className='text-hash'>(main)</span>
          </span>
          <button type='button' onClick={logout} className={actionButton}>
            :logout
          </button>
        </div>
      </header>

      <form onSubmit={go} className='border-b border-line'>
        <div className='flex w-full items-center gap-2 px-4 py-2'>
          <span className='text-accent select-none'>$</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='ketik URL atau kata kunci'
            aria-label='Alamat'
            autoCapitalize='off'
            autoCorrect='off'
            spellCheck={false}
            className='min-w-0 flex-1 border-0 bg-transparent p-0 placeholder:text-mute focus:ring-0 focus:outline-none'
          />
          <button
            type='submit'
            disabled={loading || !input.trim()}
            className={actionButton}
          >
            {loading ? '[memuat…]' : '[buka ↵]'}
          </button>
        </div>
      </form>

      {error && <p className='px-4 py-2 text-xs text-err'>{error}</p>}

      {src ? (
        <>
          {title && (
            <p className='truncate border-b border-line px-4 py-1 text-xs text-mute'>
              {title}
            </p>
          )}
          <iframe
            ref={frameRef}
            key={src}
            src={src}
            title='Halaman'
            sandbox='allow-scripts allow-forms'
            referrerPolicy='no-referrer'
            className='w-full flex-1 border-0 bg-white'
          />
        </>
      ) : (
        <main className='w-full flex-1 px-4 py-6 leading-6'>
          <p className='text-mute'>
            # Buka situs lewat server ini. Teks, gambar, dan CSS dimuat;
            JavaScript dimatikan demi keamanan, jadi situs yang bergantung
            padanya (login, video, aplikasi web) tidak akan jalan.
          </p>
          <p className='mt-2 text-mute'>
            # Cocok untuk artikel, dokumentasi, dan halaman statis.
          </p>
        </main>
      )}
    </div>
  );
}

export default function BrowsePage() {
  return (
    <AuthGate>
      <Browse />
    </AuthGate>
  );
}
