'use client';

import * as React from 'react';

import type { DefineResult, DefLang } from '@/lib/dictionary';

type Loaded = { key: string; result: DefineResult | null };

/** Whether the server's reply has the shape of a definition (and not an error). */
const isResult = (data: unknown): data is DefineResult =>
  !!data &&
  typeof data === 'object' &&
  Array.isArray((data as DefineResult).entries);

/**
 * What a word means: its senses by part of speech, with where they come from.
 * Looks the word up when it appears, and says so plainly when nothing is found.
 */
export default function WordDefinition({
  word,
  lang,
}: {
  word: string;
  lang: DefLang;
}) {
  const key = `${lang}:${word}`;
  const [loaded, setLoaded] = React.useState<Loaded>({ key: '', result: null });
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/define?word=${encodeURIComponent(word)}&lang=${lang}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled)
          setLoaded({ key, result: isResult(data) ? data : null });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ key, result: null });
      });
    return () => {
      cancelled = true;
    };
  }, [key, word, lang, attempt]);

  const loading = loaded.key !== key;
  const result = loaded.result;
  const unreachable = !loading && (!result || result.failed);
  const empty =
    !loading && !!result && !result.failed && !result.entries.length;
  const fallbackUrl =
    result?.url ??
    (lang === 'id'
      ? `https://kbbi.kemdikbud.go.id/entri/${word}`
      : `https://en.wiktionary.org/wiki/${word}`);

  return (
    <section
      aria-label='Arti kata'
      className='a-slide-up mt-4 rounded-xl border border-line bg-surface/50 p-4 text-left text-sm'
    >
      <div className='flex items-baseline justify-between gap-3'>
        <h2 className='text-lg font-semibold tracking-wide uppercase'>
          {word}
        </h2>
        <span className='text-xs text-[var(--mute)]'>
          {lang === 'id' ? 'arti kata' : 'arti kata (bahasa Inggris)'}
        </span>
      </div>

      {loading && (
        <div className='mt-3 space-y-2' aria-busy='true'>
          <div className='h-3 w-4/5 animate-pulse rounded bg-line' />
          <div className='h-3 w-3/5 animate-pulse rounded bg-line' />
        </div>
      )}

      {!loading &&
        result?.entries.map((entry, i) => (
          <div key={i} className='mt-3'>
            {entry.pos && (
              <p className='text-xs text-[var(--mute)] italic'>{entry.pos}</p>
            )}
            <ol className='mt-1 list-decimal space-y-1 pl-5'>
              {entry.definitions.map((d, j) => (
                <li key={j}>{d}</li>
              ))}
            </ol>
          </div>
        ))}

      {!loading &&
        result &&
        result.entries.length > 0 &&
        result.defLang !== lang && (
          <p className='mt-3 text-xs text-[var(--mute)]'>
            Belum ada penjelasan berbahasa Indonesia untuk kata ini, jadi
            artinya ditulis dalam bahasa Inggris.
          </p>
        )}

      {empty && (
        <p className='mt-3 text-[var(--mute)]'>
          Belum ada definisi untuk kata ini di kamus yang kami pakai.
        </p>
      )}

      {unreachable && (
        <p className='mt-3 text-[var(--mute)]'>
          Definisi belum bisa dimuat sekarang.{' '}
          <button
            type='button'
            onClick={() => {
              setLoaded({ key: '', result: null });
              setAttempt((n) => n + 1);
            }}
            className='text-ink underline underline-offset-2'
          >
            Coba lagi
          </button>
        </p>
      )}

      {!loading && (
        <p className='mt-3 text-xs text-[var(--mute)]'>
          {result && result.entries.length > 0
            ? `Sumber: ${result.source}. `
            : ''}
          <a
            href={fallbackUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='underline underline-offset-2 hover:text-ink'
          >
            {lang === 'id' && !result?.entries.length
              ? 'Cari di KBBI'
              : 'Selengkapnya'}
          </a>
        </p>
      )}
    </section>
  );
}
