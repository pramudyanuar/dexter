'use client';

import * as React from 'react';

import { CHAT_MAX_LENGTH, ChatMsg, GameId } from '@/lib/rooms/types';
import type { RoomSession } from '@/lib/rooms/useRoom';
import useStoredState from '@/lib/useStoredState';
import useWide from '@/lib/useWide';

import { seatName, useLang, useText } from '@/components/games/lang';

const POLL_CLOSED_MS = 3000;
const POLL_OPEN_MS = 1200;

const time = (at: number, locale: string) =>
  new Date(at).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });

function Chat({
  session,
  names,
}: {
  session: RoomSession;
  names?: (string | null)[];
}) {
  const { code, token, you } = session;
  const t = useText();
  const lang = useLang();
  const wide = useWide();
  const [openByHand, setOpen] = React.useState(false);
  // on a wide screen the chat is a panel that is always there
  const open = wide || openByHand;
  const [lines, setLines] = React.useState<ChatMsg[]>([]);
  const [seen, setSeen] = React.useState(0);
  const [text, setText] = React.useState('');
  /** Where your next line goes; null when you may not talk right now */
  const [channel, setChannel] = React.useState<string | null>('all');
  const [error, setError] = React.useState('');
  const lastId = React.useRef<string | null>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const fetchNew = React.useCallback(async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      const after = lastId.current ? `?after=${lastId.current}` : '';
      const res = await fetch(`/api/rooms/${code}/chat${after}`, {
        cache: 'no-store',
        headers: { 'x-player-token': token },
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        messages: ChatMsg[];
        channel?: string | null;
      };
      // games with private chat say where this player may talk right now
      setChannel(data.channel === undefined ? 'all' : data.channel);
      if (!data.messages.length) return;
      lastId.current = data.messages[data.messages.length - 1].id;
      setLines((prev) => {
        const known = new Set(prev.map((l) => l.id));
        const fresh = data.messages.filter((m) => !known.has(m.id));
        return fresh.length ? [...prev, ...fresh].slice(-50) : prev;
      });
    } catch {
      // a dropped connection: try again on the next tick
    }
  }, [code, token]);

  React.useEffect(() => {
    const first = setTimeout(fetchNew, 0);
    const timer = setInterval(fetchNew, open ? POLL_OPEN_MS : POLL_CLOSED_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [fetchNew, open]);

  // stay at the newest line while the panel is open
  React.useEffect(() => {
    if (open) {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [open, lines]);

  React.useEffect(() => {
    if (openByHand) inputRef.current?.focus();
  }, [openByHand]);

  const unread = open
    ? 0
    : lines.slice(seen).filter((l) => l.seat !== you).length;

  const toggle = () => {
    setSeen(lines.length);
    setOpen((o) => !o);
    setError('');
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText('');
    setError('');
    try {
      const res = await fetch(`/api/rooms/${code}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-player-token': token,
        },
        body: JSON.stringify({ text: body }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setText(body);
        setError(data.error ?? t.sendFailed);
        return;
      }
      void fetchNew();
    } catch {
      setText(body);
      setError(t.sendFailed);
    }
  };

  return (
    <div
      className={
        wide
          ? 'fixed top-4 right-4 bottom-4 z-30 flex w-80 flex-col'
          : 'fixed right-4 bottom-4 z-40 flex flex-col items-end gap-2'
      }
    >
      {open && (
        <section
          aria-label={t.chatRoom}
          className={`a-slide-up flex flex-col overflow-hidden rounded-xl border border-line-strong bg-card shadow-2xl ${
            wide
              ? 'h-full w-full'
              : 'h-[min(24rem,60dvh)] w-80 max-w-[calc(100vw-2rem)]'
          }`}
          onKeyDown={(e) => {
            // keep typing here from triggering game shortcuts
            e.stopPropagation();
            if (e.key === 'Escape' && !wide) toggle();
          }}
        >
          <div className='flex items-center justify-between border-b border-line px-3 py-2 text-sm'>
            <span className='font-medium'>{t.chat}</span>
            <span className='text-xs text-[var(--mute)]'>
              {t.room} {code}
            </span>
          </div>

          <div
            ref={listRef}
            role='log'
            aria-live='polite'
            className='flex-1 space-y-2 overflow-y-auto px-3 py-2'
          >
            {lines.length === 0 && (
              <p className='pt-6 text-center text-xs text-[var(--mute)]'>
                {t.noMessages}
              </p>
            )}
            {lines.map((l) => {
              const mine = l.seat === you;
              return (
                <div
                  key={l.id}
                  className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}
                >
                  <span className='mb-0.5 text-[11px] text-[var(--mute)]'>
                    {seatName(lang, l.seat, you, names)} ·{' '}
                    {time(l.at, t.locale)}
                    {l.channel && (
                      <span className='ml-1 rounded bg-hash/15 px-1 text-[10px] text-hash uppercase'>
                        {l.channel === 'wolves'
                          ? t.wolvesOnly
                          : l.channel === 'dead'
                            ? t.deadOnly
                            : l.channel}
                      </span>
                    )}
                  </span>
                  <span
                    className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm break-words ${
                      mine
                        ? 'rounded-br-md bg-accent/20'
                        : 'rounded-bl-md bg-surface'
                    }`}
                  >
                    {l.text}
                  </span>
                </div>
              );
            })}
          </div>

          {error && (
            <p className='px-3 pb-1 text-xs text-err' role='alert'>
              {error}
            </p>
          )}
          <form onSubmit={send} className='flex gap-2 border-t border-line p-2'>
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={CHAT_MAX_LENGTH}
              disabled={channel === null}
              placeholder={channel === null ? t.muted : t.write}
              aria-label={t.message}
              autoComplete='off'
              className='min-w-0 flex-1'
            />
            <button
              type='submit'
              disabled={!text.trim() || channel === null}
              className='rounded-lg bg-ink px-3 text-sm font-medium text-paper transition-opacity disabled:opacity-40'
            >
              {t.send}
            </button>
          </form>
        </section>
      )}

      {!wide && (
        <button
          type='button'
          onClick={toggle}
          aria-expanded={open}
          aria-label={
            unread
              ? `Chat, ${unread} pesan baru`
              : open
                ? 'Tutup chat'
                : 'Buka chat'
          }
          className='flex items-center gap-2 rounded-full border border-line-strong bg-card px-4 py-2 text-sm shadow-lg transition-[transform,border-color] hover:-translate-y-0.5 hover:border-[var(--mute)] active:scale-95'
        >
          Chat
          {unread > 0 && (
            <span className='a-pop flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold text-paper'>
              {unread}
            </span>
          )}
        </button>
      )}
    </div>
  );
}

/**
 * A chat for the room the player is currently in. It finds the room from the
 * saved session, so any online game page can use it with one line.
 */
export default function RoomChat({
  game,
  names,
}: {
  game: GameId;
  /** Players' names, for games that want the chat to show them */
  names?: (string | null)[];
}) {
  const [session] = useStoredState<RoomSession | null>(
    `room-session-${game}`,
    null,
    'tab',
  );
  // a new room starts a new conversation
  return session ? (
    <Chat key={session.code} session={session} names={names} />
  ) : null;
}
