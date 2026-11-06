'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { CHEATSHEET } from '@/constant/cheatsheet';

function CopyableCode({ children }: { children: string }) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard unavailable (e.g. insecure context)
    }
  };

  return (
    <button
      type='button'
      onClick={copy}
      title='Klik untuk menyalin'
      className='relative max-w-full rounded-md border border-line bg-card px-2.5 py-1 text-left font-mono text-[13px] break-words transition hover:border-info/60'
    >
      {children}
      {copied && (
        <span className='absolute -top-2 right-2 rounded bg-ink px-1.5 text-[10px] text-paper'>
          disalin
        </span>
      )}
    </button>
  );
}

export default function Cheatsheet() {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const clicks = React.useRef({ count: 0, last: 0 });

  // three quick clicks on the logo open the app launcher
  const onLogoClick = () => {
    const now = Date.now();
    const c = clicks.current;
    c.count = now - c.last < 700 ? c.count + 1 : 1;
    c.last = now;
    if (c.count >= 3) {
      c.count = 0;
      router.push('/apps');
    }
  };

  const q = query.trim().toLowerCase();
  const sections = CHEATSHEET.map((s) => ({
    ...s,
    items: q
      ? s.items.filter(
          (i) =>
            i.cmd.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q),
        )
      : s.items,
  })).filter((s) => s.items.length > 0);

  return (
    <div className='min-h-dvh bg-paper font-sans text-ink'>
      <header className='sticky top-0 z-10 border-b border-line bg-paper/90 backdrop-blur'>
        <div className='mx-auto flex max-w-5xl items-center gap-4 px-4 py-3'>
          <button
            type='button'
            onClick={onLogoClick}
            className='text-base font-semibold tracking-tight select-none'
          >
            DevRef
          </button>
          <span className='hidden text-sm text-mute sm:inline'>
            Cheatsheet developer
          </span>
          <input
            type='search'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Cari perintah…'
            aria-label='Cari'
            className='ml-auto w-full max-w-60 rounded-md border border-line bg-card px-3 py-1.5 text-sm placeholder:text-mute focus:border-info focus:ring-0 focus:outline-none'
          />
        </div>
      </header>

      <div className='mx-auto flex max-w-5xl gap-10 px-4 py-8'>
        <nav
          aria-label='Bagian'
          className='sticky top-20 hidden h-fit w-40 shrink-0 text-sm md:block'
        >
          <ul className='space-y-1'>
            {CHEATSHEET.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className='block py-1 text-mute transition hover:text-ink'
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main className='min-w-0 flex-1 space-y-12'>
          {sections.length === 0 && (
            <p className='text-sm text-mute'>
              Tidak ada hasil untuk “{query}”.
            </p>
          )}

          {sections.map((section) => (
            <section key={section.id} id={section.id} className='scroll-mt-20'>
              <h2 className='text-xl font-semibold tracking-tight'>
                {section.title}
              </h2>
              <p className='mt-1 text-sm text-mute'>{section.intro}</p>

              <ul className='mt-4 divide-y divide-line border-y border-line'>
                {section.items.map((item) => (
                  <li
                    key={item.cmd}
                    className='grid gap-1.5 py-3 sm:grid-cols-[minmax(0,5fr)_minmax(0,4fr)] sm:items-center sm:gap-6'
                  >
                    <div>
                      <CopyableCode>{item.cmd}</CopyableCode>
                    </div>
                    <p className='text-sm leading-6 text-mute'>{item.desc}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <p className='border-t border-line pt-6 text-xs text-mute'>
            Referensi singkat; perilaku bisa berbeda antar versi. Cek
            dokumentasi resmi masing-masing alat untuk detailnya. Butuh jeda
            sebentar?{' '}
            <Link href='/games' className='underline hover:text-ink'>
              Main game
            </Link>
            .
          </p>
        </main>
      </div>
    </div>
  );
}
