'use client';

import * as React from 'react';

import {
  generatePasteCode,
  MAX_CONTENT_BYTES,
  MAX_SUBJECT_LEN,
  normalizePasteCode,
  PASTE_CODE_PATTERN,
  PasteMemo,
  PasteTtl,
  utf8Bytes,
} from '@/lib/paste/types';
import { formatBytes, formatDuration } from '@/lib/transfer/format';

import ToolShell from '@/components/tools/ToolShell';

const POLL_MS = 3_000;

function readRoomFromHash(): string {
  if (typeof window === 'undefined') return '';
  const match = /^#?r=([0-9\s-]{6,10})$/.exec(window.location.hash.trim());
  if (!match) return '';
  const normalized = normalizePasteCode(match[1]);
  return PASTE_CODE_PATTERN.test(normalized) ? normalized : '';
}

export default function PastePage() {
  const [roomCode, setRoomCode] = React.useState('');
  const [joinInput, setJoinInput] = React.useState('');
  const [memos, setMemos] = React.useState<PasteMemo[]>([]);
  const [subject, setSubject] = React.useState('');
  const [content, setContent] = React.useState('');
  const [ttl, setTtl] = React.useState<PasteTtl>('1h');
  const [query, setQuery] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState('');
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [now, setNow] = React.useState(() => Date.now());
  const etagRef = React.useRef<string>('');

  const openRoom = React.useCallback((raw: string) => {
    const code = normalizePasteCode(raw);
    if (!PASTE_CODE_PATTERN.test(code)) {
      setError('Kode ruang harus berupa 6 angka.');
      return;
    }
    setError('');
    etagRef.current = '';
    setMemos([]);
    setRoomCode(code);
    setJoinInput(code);
    window.history.replaceState(null, '', `/paste#r=${code}`);
  }, []);

  React.useEffect(() => {
    const first = setTimeout(() => {
      const initial = readRoomFromHash();
      if (initial) {
        setRoomCode(initial);
        setJoinInput(initial);
      }
    }, 0);
    const onHash = () => {
      const next = readRoomFromHash();
      if (next) {
        etagRef.current = '';
        setRoomCode(next);
        setJoinInput(next);
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => {
      clearTimeout(first);
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  const fetchMemos = React.useCallback(async (code: string, quiet = false) => {
    if (!code) return;
    if (!quiet) setLoading(true);
    try {
      const headers: HeadersInit = {};
      if (etagRef.current) headers['If-None-Match'] = etagRef.current;
      const res = await fetch(`/api/paste?code=${encodeURIComponent(code)}`, {
        cache: 'no-store',
        headers,
      });
      if (res.status === 304) {
        setNow(Date.now());
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      etagRef.current = res.headers.get('etag') ?? '';
      setMemos(Array.isArray(data.memos) ? data.memos : []);
      setNow(Date.now());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat memo');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!roomCode) return;
    const first = setTimeout(() => fetchMemos(roomCode, false), 0);
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') fetchMemos(roomCode, true);
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchMemos(roomCode, true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [roomCode, fetchMemos]);

  const createNewRoom = () => {
    openRoom(generatePasteCode());
  };

  const leaveRoom = () => {
    setRoomCode('');
    setMemos([]);
    etagRef.current = '';
    setError('');
    window.history.replaceState(null, '', '/paste');
  };

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(key);
      setTimeout(() => setCopiedId((cur) => (cur === key ? null : cur)), 1500);
    } catch {
      setError('Gagal menyalin ke clipboard');
    }
  };

  const contentBytes = utf8Bytes(content);
  const overLimit = contentBytes > MAX_CONTENT_BYTES;

  const submitMemo = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!roomCode || sending || !content.trim() || overLimit) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/paste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: roomCode, subject, content, ttl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      etagRef.current = '';
      setMemos(Array.isArray(data.memos) ? data.memos : []);
      setSubject('');
      setContent('');
      setNow(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim memo');
    } finally {
      setSending(false);
    }
  };

  const deleteMemo = async (id: string) => {
    if (!roomCode) return;
    try {
      const res = await fetch(
        `/api/paste?code=${encodeURIComponent(roomCode)}&id=${encodeURIComponent(id)}`,
        { method: 'DELETE' },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      etagRef.current = '';
      setMemos(Array.isArray(data.memos) ? data.memos : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus memo');
    }
  };

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return memos;
    return memos.filter(
      (m) =>
        m.subject.toLowerCase().includes(q) ||
        m.content.toLowerCase().includes(q),
    );
  }, [memos, query]);

  return (
    <ToolShell
      title='Copy-Paste Bersama'
      description='Papan teks sementara antar device dengan kode ruang 6 angka. Sinkron otomatis tiap 3 detik tanpa login.'
    >
      {error && (
        <div
          role='alert'
          className='mb-4 rounded-xl border border-err/40 bg-err/10 px-4 py-2.5 text-sm text-err'
        >
          {error}
        </div>
      )}

      {!roomCode ? (
        <div className='rounded-xl border border-line bg-surface/50 p-5'>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              openRoom(joinInput);
            }}
            className='flex flex-col gap-3 sm:flex-row'
          >
            <input
              type='text'
              inputMode='numeric'
              placeholder='Masukkan kode 6 angka (mis. 123456)'
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value)}
              className='flex-1 rounded-lg border border-line-strong bg-paper px-3.5 py-2 font-mono text-sm text-ink placeholder:text-[var(--mute)] focus:border-accent focus:outline-none'
            />
            <button
              type='submit'
              className='rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:opacity-90'
            >
              Buka Ruang
            </button>
          </form>

          <div className='mt-4 flex items-center justify-between border-t border-line pt-4'>
            <span className='text-xs text-[var(--mute)]'>
              Belum punya kode ruang?
            </span>
            <button
              type='button'
              onClick={createNewRoom}
              className='rounded-lg border border-line-strong px-3.5 py-1.5 text-sm text-ink transition hover:border-accent hover:text-accent'
            >
              + Buat Ruang Baru
            </button>
          </div>
        </div>
      ) : (
        <div className='flex flex-col gap-5'>
          {/* Room header */}
          <div className='flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface/50 px-4 py-3'>
            <div className='flex items-center gap-3'>
              <span className='text-xs text-[var(--mute)]'>Ruang</span>
              <span className='font-mono text-lg font-semibold tracking-widest text-accent'>
                {roomCode}
              </span>
            </div>

            <div className='flex flex-wrap items-center gap-2'>
              <button
                type='button'
                onClick={() => copyText('code', roomCode)}
                className='rounded-lg border border-line-strong px-3 py-1.5 text-xs transition hover:border-[var(--mute)]'
              >
                {copiedId === 'code' ? 'Kode Tersalin' : 'Salin Kode'}
              </button>
              <button
                type='button'
                onClick={() =>
                  copyText(
                    'link',
                    `${window.location.origin}/paste#r=${roomCode}`,
                  )
                }
                className='rounded-lg border border-line-strong px-3 py-1.5 text-xs transition hover:border-[var(--mute)]'
              >
                {copiedId === 'link' ? 'Tautan Tersalin' : 'Salin Tautan'}
              </button>
              <button
                type='button'
                onClick={leaveRoom}
                className='rounded-lg border border-line-strong px-3 py-1.5 text-xs text-[var(--mute)] transition hover:text-ink'
              >
                Ganti Ruang
              </button>
            </div>
          </div>

          {/* Compose form */}
          <form
            onSubmit={submitMemo}
            className='flex flex-col gap-3 rounded-xl border border-line bg-surface/50 p-4'
          >
            <div className='flex flex-col gap-2 sm:flex-row'>
              <input
                type='text'
                maxLength={MAX_SUBJECT_LEN}
                placeholder='Judul memo (opsional)'
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className='flex-1 rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink placeholder:text-[var(--mute)] focus:border-accent focus:outline-none'
              />
              <select
                aria-label='Masa berlaku memo'
                value={ttl}
                onChange={(e) => setTtl(e.target.value as PasteTtl)}
                className='rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none'
              >
                <option value='10m'>Aktif 10 menit</option>
                <option value='1h'>Aktif 1 jam</option>
                <option value='24h'>Aktif 24 jam</option>
              </select>
            </div>

            <textarea
              rows={5}
              placeholder='Tempel atau tulis teks di sini... (Ctrl+Enter untuk kirim)'
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  submitMemo();
                }
              }}
              className='w-full resize-y rounded-lg border border-line-strong bg-paper p-3 font-mono text-sm text-ink placeholder:text-[var(--mute)] focus:border-accent focus:outline-none'
            />

            <div className='flex items-center justify-between gap-3'>
              <span
                className={`text-xs ${overLimit ? 'text-err' : 'text-[var(--mute)]'}`}
              >
                {formatBytes(contentBytes)} / {formatBytes(MAX_CONTENT_BYTES)}
              </span>
              <button
                type='submit'
                disabled={sending || !content.trim() || overLimit}
                className='rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:opacity-90 disabled:opacity-40'
              >
                {sending ? 'Mengirim...' : 'Kirim Memo'}
              </button>
            </div>
          </form>

          {/* Search & List */}
          <div className='flex items-center justify-between gap-3'>
            <input
              type='search'
              placeholder='Cari memo di ruang ini...'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className='w-full rounded-lg border border-line bg-surface/40 px-3 py-1.5 text-sm text-ink placeholder:text-[var(--mute)] focus:border-accent focus:outline-none'
            />
            <button
              type='button'
              onClick={() => fetchMemos(roomCode, false)}
              className='shrink-0 rounded-lg border border-line-strong px-3 py-1.5 text-xs text-[var(--mute)] transition hover:text-ink'
            >
              {loading ? 'Memuat...' : 'Segarkan'}
            </button>
          </div>

          {filtered.length === 0 ? (
            <div className='rounded-xl border border-dashed border-line py-10 text-center text-sm text-[var(--mute)]'>
              {memos.length === 0
                ? 'Belum ada memo di ruang ini. Kirim teks dari atas atau buka tautan ini di perangkat lain.'
                : 'Tidak ada memo yang cocok dengan pencarian.'}
            </div>
          ) : (
            <ul className='flex flex-col gap-3'>
              {filtered.map((memo) => {
                const isLong =
                  memo.content.length > 400 ||
                  memo.content.split('\n').length > 6;
                const isExpanded = Boolean(expanded[memo.id]);
                const remaining = Math.max(0, memo.expiresAt - now);

                return (
                  <li
                    key={memo.id}
                    className='rounded-xl border border-line bg-surface/50 p-4'
                  >
                    <div className='mb-2 flex flex-wrap items-center justify-between gap-2'>
                      <div>
                        <h2 className='text-sm font-semibold text-ink'>
                          {memo.subject}
                        </h2>
                        <span className='text-xs text-[var(--mute)]'>
                          {formatBytes(utf8Bytes(memo.content))} · sisa{' '}
                          {formatDuration(remaining)}
                        </span>
                      </div>

                      <div className='flex items-center gap-2'>
                        <button
                          type='button'
                          onClick={() => copyText(memo.id, memo.content)}
                          className='rounded-lg border border-line-strong px-2.5 py-1 text-xs transition hover:border-accent hover:text-accent'
                        >
                          {copiedId === memo.id ? 'Tersalin' : 'Salin'}
                        </button>
                        <button
                          type='button'
                          onClick={() => deleteMemo(memo.id)}
                          className='rounded-lg border border-line-strong px-2.5 py-1 text-xs text-[var(--mute)] transition hover:border-err/50 hover:text-err'
                        >
                          Hapus
                        </button>
                      </div>
                    </div>

                    <pre
                      className={`overflow-x-auto rounded-lg border border-line bg-paper p-3 font-mono text-[13px] leading-relaxed break-words whitespace-pre-wrap text-ink ${
                        isLong && !isExpanded
                          ? 'max-h-40 overflow-y-hidden'
                          : ''
                      }`}
                    >
                      {memo.content}
                    </pre>

                    {isLong && (
                      <button
                        type='button'
                        onClick={() =>
                          setExpanded((prev) => ({
                            ...prev,
                            [memo.id]: !isExpanded,
                          }))
                        }
                        className='mt-2 text-xs text-accent hover:underline'
                      >
                        {isExpanded ? 'Ringkas' : 'Tampilkan lengkap'}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </ToolShell>
  );
}
