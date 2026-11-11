import { NextResponse } from 'next/server';

import { define, DefLang } from '@/lib/dictionary';
import { createLimiter } from '@/lib/rooms/rate-limit';

/** The games are public, so this is too; it only looks words up. */
const limiter = createLimiter(40, 60_000);

const WORD = /^[a-z]{5}$/;
// Wikimedia asks API clients to say who they are
const HEADERS = { 'User-Agent': 'dexter-games/1.0 (word definitions)' };

const fetcher = (url: string) =>
  fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(6000) });

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const word = (params.get('word') ?? '').toLowerCase();
  const lang = params.get('lang');

  if (!WORD.test(word) || (lang !== 'id' && lang !== 'en')) {
    return NextResponse.json({ error: 'Kata tidak valid' }, { status: 400 });
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'local';
  if (!limiter.allow(ip)) {
    return NextResponse.json(
      { error: 'Terlalu banyak permintaan, coba lagi nanti' },
      { status: 429 },
    );
  }

  const result = await define(word, lang as DefLang, fetcher);
  // a word's meaning does not change: let the CDN keep what was found for a
  // week, but do not remember a failure or an empty answer for long
  const cache = result.entries.length
    ? 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400'
    : result.failed
      ? 'no-store'
      : 'public, max-age=300, s-maxage=3600';
  return NextResponse.json(result, { headers: { 'Cache-Control': cache } });
}
