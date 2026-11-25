'use client';

import Link from 'next/link';
import * as React from 'react';

import { AdminRoomSummary } from '@/lib/rooms/admin';
import { DEFAULT_GAME_CONFIG, GameConfig } from '@/lib/rooms/game-config';
import { ChatMsg, RoomStatus } from '@/lib/rooms/types';

import AdminBugReports from '@/components/admin/AdminBugReports';
import AdminConfigPanel from '@/components/admin/AdminConfigPanel';
import ConfirmDialog from '@/components/ConfirmDialog';
import DocumentTitle from '@/components/games/DocumentTitle';

interface SummaryStats {
  total: number;
  waiting: number;
  playing: number;
  over: number;
  totalPlayers: number;
  byGame: Record<string, number>;
}

interface RoomDetail {
  room: AdminRoomSummary;
  options: unknown;
  state: unknown;
  chat: ChatMsg[];
}

const POLL_MS = 5_000;

function formatAgo(ts: number, now: number): string {
  const sec = Math.max(0, Math.floor((now - ts) / 1000));
  if (sec < 60) return `${sec}d lalu`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m lalu`;
  return `${Math.floor(min / 60)}j lalu`;
}

function statusBadge(status: RoomStatus) {
  if (status === 'playing') return 'bg-accent/15 text-accent border-accent/30';
  if (status === 'waiting') return 'bg-info/15 text-info border-info/30';
  return 'bg-line text-[var(--mute)] border-line-strong';
}

function AdminDashboard({
  onLogout,
  onExpire,
  canLogout,
}: {
  onLogout: () => void;
  onExpire: () => void;
  canLogout: boolean;
}) {
  const logout = onLogout;
  const expire = onExpire;
  const [summary, setSummary] = React.useState<SummaryStats | null>(null);
  const [rooms, setRooms] = React.useState<AdminRoomSummary[]>([]);
  const [selectedCode, setSelectedCode] = React.useState<string>('');
  const [detail, setDetail] = React.useState<RoomDetail | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<'all' | RoomStatus>(
    'all',
  );
  const [gameFilter, setGameFilter] = React.useState('all');
  const [query, setQuery] = React.useState('');
  const [autoRefresh, setAutoRefresh] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [busyAction, setBusyAction] = React.useState(false);
  const [error, setError] = React.useState('');
  const [announceText, setAnnounceText] = React.useState('');
  const [showState, setShowState] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<string | null>(null);
  const [pendingBulk, setPendingBulk] = React.useState<
    'cleanup' | 'all' | null
  >(null);
  const [tab, setTab] = React.useState<'rooms' | 'config' | 'bugs'>('rooms');
  const [config, setConfig] = React.useState<GameConfig>(DEFAULT_GAME_CONFIG);
  const [savingConfig, setSavingConfig] = React.useState(false);
  const [configNotice, setConfigNotice] = React.useState('');
  const [now, setNow] = React.useState(() => Date.now());
  const chatListRef = React.useRef<HTMLDivElement>(null);
  const stickToBottomRef = React.useRef(true);
  const lastChatKeyRef = React.useRef('');

  React.useEffect(() => {
    const el = chatListRef.current;
    if (!el || !detail) return;
    const lastId = detail.chat[detail.chat.length - 1]?.id ?? '';
    const key = `${detail.room.code}:${lastId}`;
    const roomChanged = !lastChatKeyRef.current.startsWith(
      `${detail.room.code}:`,
    );
    if (roomChanged) stickToBottomRef.current = true;
    if (key !== lastChatKeyRef.current && stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
    lastChatKeyRef.current = key;
  }, [detail]);

  const loadRooms = React.useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const res = await fetch('/api/admin/rooms', { cache: 'no-store' });
        if (res.status === 401) return expire();
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        setSummary(data.summary);
        setRooms(data.rooms);
        setNow(Date.now());
        setError('');
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Gagal memuat daftar room',
        );
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [expire],
  );

  const loadDetail = React.useCallback(
    async (code: string) => {
      if (!code) {
        setDetail(null);
        return;
      }
      try {
        const res = await fetch(
          `/api/admin/rooms/${encodeURIComponent(code)}`,
          {
            cache: 'no-store',
          },
        );
        if (res.status === 401) return expire();
        if (res.status === 404) {
          setDetail(null);
          return;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        setDetail(data);
      } catch {
        // ignore transient detail polling errors
      }
    },
    [expire],
  );

  React.useEffect(() => {
    const first = setTimeout(() => {
      loadRooms(false);
    }, 0);
    if (!autoRefresh) return () => clearTimeout(first);
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadRooms(true);
        if (selectedCode) loadDetail(selectedCode);
      }
    }, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [autoRefresh, loadRooms, loadDetail, selectedCode]);

  React.useEffect(() => {
    if (!selectedCode) return;
    const t = setTimeout(() => loadDetail(selectedCode), 0);
    return () => clearTimeout(t);
  }, [selectedCode, loadDetail]);

  const runAction = async (code: string, payload: Record<string, unknown>) => {
    setBusyAction(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/rooms/${encodeURIComponent(code)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) return expire();
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      await Promise.all([loadRooms(true), loadDetail(code)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menjalankan aksi');
    } finally {
      setBusyAction(false);
    }
  };

  const deleteRoom = async (code: string) => {
    setBusyAction(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/rooms/${encodeURIComponent(code)}`, {
        method: 'DELETE',
      });
      if (res.status === 401) return expire();
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      if (selectedCode === code) {
        setSelectedCode('');
        setDetail(null);
      }
      await loadRooms(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus room');
    } finally {
      setBusyAction(false);
      setPendingDelete(null);
    }
  };

  const deleteBulk = async (scope: 'cleanup' | 'all') => {
    setBusyAction(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/rooms?scope=${scope}`, {
        method: 'DELETE',
      });
      if (res.status === 401) return expire();
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      if (scope === 'all') {
        setSelectedCode('');
        setDetail(null);
      } else if (selectedCode) {
        await loadDetail(selectedCode);
      }
      await loadRooms(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus room');
    } finally {
      setBusyAction(false);
      setPendingBulk(null);
    }
  };

  React.useEffect(() => {
    const t = setTimeout(() => {
      fetch('/api/admin/config', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.config) setConfig(d.config);
        })
        .catch(() => null);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const saveConfig = async () => {
    setSavingConfig(true);
    setConfigNotice('');
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      if (res.status === 401) return expire();
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setConfig(data.config);
      setConfigNotice('Pengaturan tersimpan! Berlaku untuk room baru.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Gagal menyimpan pengaturan',
      );
    } finally {
      setSavingConfig(false);
    }
  };

  const resetConfig = async () => {
    setSavingConfig(true);
    setConfigNotice('');
    try {
      const res = await fetch('/api/admin/config', { method: 'DELETE' });
      if (res.status === 401) return expire();
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setConfig(data.config);
      setConfigNotice('Pengaturan dikembalikan ke default.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mereset pengaturan');
    } finally {
      setSavingConfig(false);
    }
  };

  const filteredRooms = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return rooms.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (gameFilter !== 'all' && r.game !== gameFilter) return false;
      if (!q) return true;
      return (
        r.code.toLowerCase().includes(q) ||
        r.game.toLowerCase().includes(q) ||
        r.players.some((p) => p.name.toLowerCase().includes(q))
      );
    });
  }, [rooms, statusFilter, gameFilter, query]);

  const gameOptions = React.useMemo(
    () => Object.keys(summary?.byGame ?? {}).sort(),
    [summary?.byGame],
  );

  return (
    <div className='games-ui flex min-h-dvh flex-col overflow-x-hidden text-[15px] text-ink'>
      <DocumentTitle title='Admin Dashboard' />

      <header className='border-b border-line bg-paper/80 backdrop-blur'>
        <div className='mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3'>
          <div className='flex items-center gap-3'>
            <span className='font-mono text-sm font-semibold text-accent'>
              /admin
            </span>
            <span className='text-xs text-[var(--mute)]'>
              Game Room Monitor & Moderation
            </span>
          </div>

          <div className='flex items-center gap-3 text-xs'>
            <label className='flex items-center gap-1.5 text-[var(--mute)]'>
              <input
                type='checkbox'
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh (5d)
            </label>
            <button
              type='button'
              onClick={() => {
                loadRooms(false);
                if (selectedCode) loadDetail(selectedCode);
              }}
              className='rounded-lg border border-line-strong px-2.5 py-1 text-ink hover:border-accent'
            >
              {loading ? 'Memuat...' : 'Segarkan'}
            </button>
            <Link href='/games' className='text-[var(--mute)] hover:text-ink'>
              Games
            </Link>
            {canLogout && (
              <button
                type='button'
                onClick={logout}
                className='text-[var(--mute)] hover:text-err'
              >
                :logout
              </button>
            )}
          </div>
        </div>
      </header>

      <main className='mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-4 py-6'>
        {error && (
          <div
            role='alert'
            className='rounded-xl border border-err/40 bg-err/10 px-4 py-2.5 text-sm text-err'
          >
            {error}
          </div>
        )}

        {/* Tab switcher */}
        <div className='flex flex-wrap gap-2 border-b border-line pb-3'>
          <button
            type='button'
            onClick={() => setTab('rooms')}
            className={`rounded-full border px-4 py-1 text-xs font-medium transition ${
              tab === 'rooms'
                ? 'border-transparent bg-ink text-paper'
                : 'border-line-strong text-[var(--mute)] hover:text-ink'
            }`}
          >
            Monitor Room
          </button>
          <button
            type='button'
            onClick={() => setTab('config')}
            className={`rounded-full border px-4 py-1 text-xs font-medium transition ${
              tab === 'config'
                ? 'border-transparent bg-ink text-paper'
                : 'border-line-strong text-[var(--mute)] hover:text-ink'
            }`}
          >
            Pengaturan Game (CMS)
          </button>
          <button
            type='button'
            onClick={() => setTab('bugs')}
            className={`rounded-full border px-4 py-1 text-xs font-medium transition ${
              tab === 'bugs'
                ? 'border-transparent bg-ink text-paper'
                : 'border-line-strong text-[var(--mute)] hover:text-ink'
            }`}
          >
            Laporan Bug
          </button>
        </div>

        {tab === 'bugs' ? (
          <AdminBugReports onExpire={expire} />
        ) : tab === 'config' ? (
          <AdminConfigPanel
            config={config}
            setConfig={setConfig}
            saving={savingConfig}
            notice={configNotice}
            onSave={saveConfig}
            onReset={resetConfig}
          />
        ) : (
          <>
            {/* Stats */}
            <div className='grid grid-cols-2 gap-3 sm:grid-cols-5'>
              {[
                ['Total Room', summary?.total ?? 0],
                ['Playing', summary?.playing ?? 0],
                ['Waiting', summary?.waiting ?? 0],
                ['Over', summary?.over ?? 0],
                ['Pemain Aktif', summary?.totalPlayers ?? 0],
              ].map(([label, val]) => (
                <div
                  key={String(label)}
                  className='rounded-xl border border-line bg-surface/50 px-4 py-3'
                >
                  <div className='text-xs text-[var(--mute)]'>{label}</div>
                  <div className='mt-0.5 font-mono text-2xl font-semibold text-ink'>
                    {val}
                  </div>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <div className='flex flex-wrap gap-1.5'>
                {(['all', 'playing', 'waiting', 'over'] as const).map((st) => (
                  <button
                    key={st}
                    type='button'
                    onClick={() => setStatusFilter(st)}
                    className={`rounded-full border px-3 py-1 text-xs capitalize transition ${
                      statusFilter === st
                        ? 'border-transparent bg-ink text-paper'
                        : 'border-line-strong text-[var(--mute)] hover:text-ink'
                    }`}
                  >
                    {st === 'all' ? 'Semua' : st}
                  </button>
                ))}
              </div>

              <div className='flex flex-wrap items-center gap-2'>
                <select
                  aria-label='Filter game'
                  value={gameFilter}
                  onChange={(e) => setGameFilter(e.target.value)}
                  className='rounded-lg border border-line-strong bg-paper px-3 py-1.5 text-xs text-ink'
                >
                  <option value='all'>Semua Game</option>
                  {gameOptions.map((g) => (
                    <option key={g} value={g}>
                      {g} ({summary?.byGame[g] ?? 0})
                    </option>
                  ))}
                </select>

                <input
                  type='search'
                  placeholder='Cari kode room / pemain...'
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className='rounded-lg border border-line-strong bg-paper px-3 py-1.5 text-xs text-ink placeholder:text-[var(--mute)] focus:border-accent focus:outline-none'
                />

                <button
                  type='button'
                  disabled={busyAction || rooms.length === 0}
                  onClick={() => setPendingBulk('cleanup')}
                  className='rounded-lg border border-line-strong px-3 py-1.5 text-xs text-ink transition hover:border-accent disabled:opacity-40'
                >
                  Hapus Kosong / Done
                </button>

                <button
                  type='button'
                  disabled={busyAction || rooms.length === 0}
                  onClick={() => setPendingBulk('all')}
                  className='rounded-lg border border-err/40 px-3 py-1.5 text-xs text-err transition hover:bg-err/10 disabled:opacity-40'
                >
                  Delete All
                </button>
              </div>
            </div>

            {/* Split view */}
            <div className='grid min-w-0 gap-5 lg:grid-cols-[360px_1fr]'>
              {/* Left: Room list */}
              <div className='flex min-w-0 flex-col gap-2'>
                {filteredRooms.length === 0 ? (
                  <div className='rounded-xl border border-dashed border-line py-12 text-center text-sm text-[var(--mute)]'>
                    Tidak ada room yang cocok.
                  </div>
                ) : (
                  filteredRooms.map((r) => (
                    <button
                      key={r.code}
                      type='button'
                      onClick={() => setSelectedCode(r.code)}
                      className={`flex flex-col gap-1.5 rounded-xl border p-3.5 text-left transition ${
                        selectedCode === r.code
                          ? 'border-accent bg-card'
                          : 'border-line bg-surface/50 hover:border-line-strong'
                      }`}
                    >
                      <div className='flex items-center justify-between gap-2'>
                        <div className='flex items-center gap-2'>
                          <span className='font-mono text-sm font-semibold text-ink'>
                            #{r.code}
                          </span>
                          <span className='rounded bg-paper px-1.5 py-0.5 font-mono text-[11px] text-[var(--mute)]'>
                            {r.game}
                          </span>
                        </div>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${statusBadge(r.status)}`}
                        >
                          {r.status}
                        </span>
                      </div>

                      <div className='flex items-center justify-between text-xs text-[var(--mute)]'>
                        <span>
                          {r.activeCount}/{r.playerCount} pemain aktif
                        </span>
                        <span>{formatAgo(r.lastActiveAt, now)}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* Right: Room inspector */}
              <div className='min-w-0 rounded-xl border border-line bg-surface/50 p-5'>
                {!detail ? (
                  <div className='flex h-full min-h-[320px] items-center justify-center text-sm text-[var(--mute)]'>
                    Pilih salah satu room di sebelah kiri untuk melihat detail &
                    kontrol.
                  </div>
                ) : (
                  <div className='flex flex-col gap-5'>
                    <div className='flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4'>
                      <div>
                        <div className='flex items-center gap-2.5'>
                          <h2 className='font-mono text-xl font-semibold text-ink'>
                            #{detail.room.code}
                          </h2>
                          <span className='rounded border border-line-strong bg-paper px-2 py-0.5 font-mono text-xs'>
                            {detail.room.game}
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-xs uppercase ${statusBadge(detail.room.status)}`}
                          >
                            {detail.room.status}
                          </span>
                        </div>
                        <p className='mt-1 text-xs text-[var(--mute)]'>
                          Versi {detail.room.version} · Dibuat{' '}
                          {formatAgo(detail.room.createdAt, now)} · Aktif{' '}
                          {formatAgo(detail.room.lastActiveAt, now)}
                        </p>
                      </div>

                      <div className='flex flex-wrap gap-2'>
                        <Link
                          href={`/games/${detail.room.game}?spectate=${detail.room.code}`}
                          target='_blank'
                          rel='noreferrer'
                          className='rounded-lg border border-accent/50 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20'
                        >
                          Spectate →
                        </Link>
                        {detail.room.status !== 'over' && (
                          <button
                            type='button'
                            disabled={busyAction}
                            onClick={() =>
                              runAction(detail.room.code, {
                                action: 'forceEnd',
                              })
                            }
                            className='rounded-lg border border-line-strong px-3 py-1.5 text-xs hover:border-accent disabled:opacity-40'
                          >
                            Akhiri Paksa
                          </button>
                        )}
                        <button
                          type='button'
                          disabled={busyAction}
                          onClick={() => setPendingDelete(detail.room.code)}
                          className='rounded-lg border border-err/40 px-3 py-1.5 text-xs text-err hover:bg-err/10 disabled:opacity-40'
                        >
                          Hapus Room
                        </button>
                      </div>
                    </div>

                    {/* Players */}
                    <div>
                      <h3 className='mb-2 text-xs font-medium text-[var(--mute)]'>
                        Daftar Pemain ({detail.room.players.length})
                      </h3>
                      <ul className='flex flex-col gap-2'>
                        {detail.room.players.map((p) => (
                          <li
                            key={p.seat}
                            className='flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-paper px-3 py-2 text-xs'
                          >
                            <div className='flex items-center gap-2'>
                              <span className='font-mono text-[var(--mute)]'>
                                S{p.seat + 1}
                              </span>
                              <span className='font-medium text-ink'>
                                {p.name}
                              </span>
                              {p.isHost && (
                                <span className='rounded bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent'>
                                  Host
                                </span>
                              )}
                              {p.out && (
                                <span className='rounded bg-err/15 px-1.5 py-0.5 text-[10px] text-err'>
                                  Out ({p.why ?? 'removed'})
                                </span>
                              )}
                              {p.strikes > 0 && (
                                <span className='text-[var(--mute)]'>
                                  · {p.strikes} strike
                                </span>
                              )}
                            </div>

                            <div className='flex items-center gap-1.5'>
                              {!p.isHost && !p.out && (
                                <button
                                  type='button'
                                  disabled={busyAction}
                                  onClick={() =>
                                    runAction(detail.room.code, {
                                      action: 'setHost',
                                      seat: p.seat,
                                    })
                                  }
                                  className='rounded border border-line-strong px-2 py-1 hover:border-accent'
                                >
                                  Jadikan Host
                                </button>
                              )}
                              {!p.out && (
                                <button
                                  type='button'
                                  disabled={busyAction}
                                  onClick={() =>
                                    runAction(detail.room.code, {
                                      action: 'kick',
                                      seat: p.seat,
                                    })
                                  }
                                  className='rounded border border-line-strong px-2 py-1 text-[var(--mute)] hover:border-err/50 hover:text-err'
                                >
                                  Kick
                                </button>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Chat & Announce */}
                    <div className='rounded-xl border border-line bg-paper p-3.5'>
                      <h3 className='mb-2 text-xs font-medium text-[var(--mute)]'>
                        Chat Room ({detail.chat.length})
                      </h3>
                      <div
                        ref={chatListRef}
                        onScroll={() => {
                          const el = chatListRef.current;
                          if (!el) return;
                          stickToBottomRef.current =
                            el.scrollHeight - el.scrollTop - el.clientHeight <
                            32;
                        }}
                        className='mb-3 max-h-40 space-y-1.5 overflow-y-auto text-xs'
                      >
                        {detail.chat.length === 0 ? (
                          <p className='text-[var(--mute)]'>Belum ada chat.</p>
                        ) : (
                          detail.chat.map((c) => {
                            const isAdmin = c.seat === -1;
                            const sender = isAdmin
                              ? 'ADMIN'
                              : (detail.room.players.find(
                                  (p) => p.seat === c.seat,
                                )?.name ?? `S${c.seat + 1}`);
                            return (
                              <div
                                key={c.id}
                                className={
                                  isAdmin
                                    ? 'rounded-lg border border-[#e4b34a]/50 bg-[#e4b34a]/15 px-2.5 py-1.5'
                                    : ''
                                }
                              >
                                <span
                                  className={
                                    isAdmin
                                      ? 'mr-1.5 rounded bg-[#e4b34a] px-1.5 py-px text-[10px] font-bold text-[#14161c]'
                                      : 'font-medium text-ink'
                                  }
                                >
                                  {sender}
                                  {!isAdmin && ':'}
                                </span>{' '}
                                <span
                                  className={`[overflow-wrap:anywhere] break-words ${
                                    isAdmin
                                      ? 'font-medium text-ink'
                                      : 'text-[var(--mute)]'
                                  }`}
                                >
                                  {c.text}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!announceText.trim()) return;
                          stickToBottomRef.current = true;
                          runAction(detail.room.code, {
                            action: 'announce',
                            text: announceText,
                          });
                          setAnnounceText('');
                        }}
                        className='flex gap-2'
                      >
                        <input
                          type='text'
                          value={announceText}
                          onChange={(e) => setAnnounceText(e.target.value)}
                          placeholder='Kirim pengumuman admin ke chat room...'
                          className='min-w-0 flex-1 rounded-lg border border-line-strong bg-surface/50 px-3 py-1.5 text-xs text-ink focus:border-accent focus:outline-none'
                        />
                        <button
                          type='submit'
                          disabled={busyAction || !announceText.trim()}
                          className='rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-paper disabled:opacity-40'
                        >
                          Kirim
                        </button>
                      </form>
                    </div>

                    {/* State Inspector */}
                    <div>
                      <button
                        type='button'
                        onClick={() => setShowState((s) => !s)}
                        className='text-xs text-accent hover:underline'
                      >
                        {showState
                          ? 'Sembunyikan State JSON'
                          : 'Lihat State & Options JSON'}
                      </button>
                      {showState && (
                        <pre className='mt-2 max-h-64 overflow-auto rounded-xl border border-line bg-paper p-3 font-mono text-[11px] text-ink'>
                          {JSON.stringify(
                            { options: detail.options, state: detail.state },
                            null,
                            2,
                          )}
                        </pre>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {pendingDelete && (
        <ConfirmDialog
          danger
          title='Hapus room?'
          message={
            <>
              Room <span className='font-mono text-ink'>#{pendingDelete}</span>{' '}
              beserta chat-nya akan dihapus permanen.
            </>
          }
          confirmLabel='Hapus'
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => deleteRoom(pendingDelete)}
        />
      )}

      {pendingBulk && (
        <ConfirmDialog
          danger
          title={
            pendingBulk === 'all'
              ? 'Hapus semua room?'
              : 'Hapus room kosong & selesai?'
          }
          message={
            pendingBulk === 'all'
              ? `Semua ${rooms.length} room aktif beserta chat-nya akan dihapus permanen.`
              : 'Semua room dengan 0 pemain aktif atau berstatus "over" akan dihapus permanen.'
          }
          confirmLabel={pendingBulk === 'all' ? 'Hapus Semua' : 'Bersihkan'}
          onCancel={() => setPendingBulk(null)}
          onConfirm={() => deleteBulk(pendingBulk)}
        />
      )}
    </div>
  );
}

export default function AdminPage() {
  const [status, setStatus] = React.useState<{
    checked: boolean;
    authed: boolean;
    mode: 'dev-open' | 'password' | 'unconfigured';
  }>({ checked: false, authed: false, mode: 'password' });
  const [password, setPassword] = React.useState('');
  const [loginError, setLoginError] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/admin/auth', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) =>
        setStatus({
          checked: true,
          authed: Boolean(d.authed),
          mode: d.mode ?? 'password',
        }),
      )
      .catch(() =>
        setStatus({ checked: true, authed: false, mode: 'password' }),
      );
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || submitting) return;
    setSubmitting(true);
    setLoginError('');
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setPassword('');
      setStatus((prev) => ({ ...prev, authed: true }));
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Gagal masuk');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/auth', { method: 'DELETE' }).catch(() => null);
    setStatus((prev) => ({ ...prev, authed: false }));
  };

  if (!status.checked) {
    return <div className='h-dvh bg-paper' />;
  }

  if (!status.authed) {
    return (
      <div className='games-ui flex min-h-dvh items-center justify-center px-4 text-ink'>
        <DocumentTitle title='Admin Login' />
        <form
          onSubmit={handleLogin}
          className='flex w-full max-w-sm flex-col gap-4 rounded-xl border border-line bg-surface/50 p-6'
        >
          <div>
            <h1 className='font-mono text-lg font-semibold text-accent'>
              /admin
            </h1>
            <p className='mt-1 text-xs text-[var(--mute)]'>
              {status.mode === 'unconfigured'
                ? 'ADMIN_PASSWORD belum diatur di environment server.'
                : 'Masukkan ADMIN_PASSWORD untuk membuka dashboard.'}
            </p>
          </div>

          {status.mode !== 'unconfigured' && (
            <>
              <input
                type='password'
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder='Password admin...'
                className='rounded-lg border border-line-strong bg-paper px-3.5 py-2 font-mono text-sm text-ink focus:border-accent focus:outline-none'
              />
              {loginError && <p className='text-xs text-err'>{loginError}</p>}
              <button
                type='submit'
                disabled={submitting || !password}
                className='rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:opacity-90 disabled:opacity-40'
              >
                {submitting ? 'Memeriksa...' : 'Masuk'}
              </button>
            </>
          )}
        </form>
      </div>
    );
  }

  return (
    <AdminDashboard
      canLogout={status.mode === 'password'}
      onLogout={handleLogout}
      onExpire={() => setStatus((prev) => ({ ...prev, authed: false }))}
    />
  );
}
