import { NextResponse } from 'next/server';
import { createHash, randomUUID } from 'node:crypto';

import { getPasteStore } from '@/lib/paste/store';
import {
  MAX_CONTENT_BYTES,
  MAX_MEMOS,
  MAX_SUBJECT_LEN,
  normalizePasteCode,
  PASTE_CODE_PATTERN,
  PASTE_TTL_SECONDS,
  PasteMemo,
  PasteTtl,
  utf8Bytes,
} from '@/lib/paste/types';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };
const NO_STORE_ERROR =
  'Penyimpanan papan teks belum diatur. Hubungkan Upstash Redis ke project ini (lihat .env.example).';

function revisionOf(memos: PasteMemo[]): string {
  return createHash('sha1').update(JSON.stringify(memos)).digest('hex');
}

export async function GET(req: Request) {
  const store = getPasteStore();
  if (!store) {
    return NextResponse.json({ error: NO_STORE_ERROR }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const code = normalizePasteCode(searchParams.get('code') ?? '');
  if (!PASTE_CODE_PATTERN.test(code)) {
    return NextResponse.json(
      { error: 'Kode ruang harus berupa 6 angka' },
      { status: 400 },
    );
  }

  const memos = await store.list(code);
  const rev = revisionOf(memos);
  const etag = `"${rev}"`;
  if (req.headers.get('if-none-match') === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { ...NO_STORE_HEADERS, ETag: etag },
    });
  }

  return NextResponse.json(
    { code, memos, revision: rev },
    { headers: { ...NO_STORE_HEADERS, ETag: etag } },
  );
}

export async function POST(req: Request) {
  const store = getPasteStore();
  if (!store) {
    return NextResponse.json({ error: NO_STORE_ERROR }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as {
    code?: string;
    subject?: string;
    content?: string;
    ttl?: string;
  } | null;

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 });
  }

  const code = normalizePasteCode(String(body.code ?? ''));
  if (!PASTE_CODE_PATTERN.test(code)) {
    return NextResponse.json(
      { error: 'Kode ruang harus berupa 6 angka' },
      { status: 400 },
    );
  }

  const content = String(body.content ?? '');
  if (!content.trim()) {
    return NextResponse.json(
      { error: 'Isi teks tidak boleh kosong' },
      { status: 400 },
    );
  }

  if (utf8Bytes(content) > MAX_CONTENT_BYTES) {
    return NextResponse.json(
      { error: 'Ukuran teks melebihi batas 100 KB' },
      { status: 413 },
    );
  }

  const ttlKey: PasteTtl =
    body.ttl === '10m' || body.ttl === '24h' ? body.ttl : '1h';
  const ttlMs = PASTE_TTL_SECONDS[ttlKey] * 1000;

  const existing = await store.list(code);
  const rawSubject = String(body.subject ?? '').trim();
  const subject = rawSubject
    ? rawSubject.slice(0, MAX_SUBJECT_LEN)
    : `Memo ${existing.length + 1}`;

  const now = Date.now();
  const memo: PasteMemo = {
    id: randomUUID(),
    subject,
    content,
    createdAt: now,
    expiresAt: now + ttlMs,
  };

  const next = [memo, ...existing].slice(0, MAX_MEMOS);
  await store.save(code, next);

  return NextResponse.json(
    { code, memo, memos: next, revision: revisionOf(next) },
    { status: 201, headers: NO_STORE_HEADERS },
  );
}

export async function DELETE(req: Request) {
  const store = getPasteStore();
  if (!store) {
    return NextResponse.json({ error: NO_STORE_ERROR }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const code = normalizePasteCode(searchParams.get('code') ?? '');
  const id = (searchParams.get('id') ?? '').trim();

  if (!PASTE_CODE_PATTERN.test(code) || !id) {
    return NextResponse.json(
      { error: 'Parameter code dan id wajib valid' },
      { status: 400 },
    );
  }

  const existing = await store.list(code);
  const next = existing.filter((m) => m.id !== id);
  await store.save(code, next);

  return NextResponse.json(
    { code, memos: next, revision: revisionOf(next) },
    { headers: NO_STORE_HEADERS },
  );
}
