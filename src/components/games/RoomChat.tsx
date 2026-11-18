'use client';

import * as React from 'react';

import { normalizeCode } from '@/lib/rooms/code-format';
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
  corner,
  inline,
}: {
  session: RoomSession;
  names?: (string | null)[];
  corner?: 'top' | 'bottom';
  inline?: boolean;
}) {
  const { code, token, you } = session;
  const t = useText();
  const lang = useLang();
  const wide = useWide();
  const [openByHand, setOpen] = React.useState(false);
  // on a wide screen or inline mode the chat is a panel that is always there
  const open = inline || wide || openByHand;
  const [lines, setLines] = React.useState<ChatMsg[]>([]);
  const [seen, setSeen] = React.useState(0);
  const [text, setText] = React.useState('');
  /** Where your next line goes; null when you may not talk right now */
  const [channel, setChannel] = React.useState<string | null>('all');
  const [error, setError] = React.useState('');
  /** Names as the room knows them, for games that do not pass their own */
  const [roomNames, setRoomNames] = React.useState<(string | null)[]>([]);
  const shownNames = names ?? roomNames;
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
        names?: (string | null)[];
      };
      if (data.names) {
        const next = data.names;
        setRoomNames((prev) =>
          prev.length === next.length && prev.every((n, i) => n === next[i])
            ? prev
            : next,
        );
      }
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
        inline
          ? 'flex h-full w-full flex-col'
          : wide
            ? 'fixed top-4 right-4 bottom-4 z-30 flex w-80 flex-col'
            : `fixed right-4 z-40 flex flex-col items-end gap-2 ${
                corner === 'top' ? 'top-3 flex-col-reverse' : 'bottom-4'
              }`
      }
    >
      {open && (
        <section
          aria-label={t.chatRoom}
          className={`a-slide-up flex flex-col overflow-hidden rounded-xl border border-line-strong bg-card ${
            inline
              ? 'h-full w-full'
              : wide
                ? 'h-full w-full shadow-2xl'
                : 'h-[min(24rem,60dvh)] w-80 max-w-[calc(100vw-2rem)] shadow-2xl'
          }`}
          onKeyDown={(e) => {
            // keep typing here from triggering game shortcuts
            e.stopPropagation();
            if (e.key === 'Escape' && !wide && !inline) toggle();
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
              const isAdmin = l.seat === -1;
              const mine = l.seat === you;
              if (isAdmin) {
                return (
                  <div
                    key={l.id}
                    className='my-1 rounded-xl border border-[#e4b34a]/50 bg-[#e4b34a]/15 px-3 py-2 text-left'
                  >
                    <div className='mb-0.5 flex items-center gap-1.5 text-[11px]'>
                      <span className='rounded bg-[#e4b34a] px-1.5 py-px font-bold text-[#14161c]'>
                        ADMIN
                      </span>
                      <span className='text-[var(--mute)]'>
                        {time(l.at, t.locale)}
                      </span>
                    </div>
                    <p className='text-sm font-medium [overflow-wrap:anywhere] break-words text-ink'>
                      {l.text}
                    </p>
                  </div>
                );
              }
              return (
                <div
                  key={l.id}
                  className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}
                >
                  <span className='mb-0.5 text-[11px] text-[var(--mute)]'>
                    {seatName(lang, l.seat, you, shownNames)} ·{' '}
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
          {token ? (
            <form
              onSubmit={send}
              className='flex gap-2 border-t border-line p-2'
            >
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
          ) : (
            <div className='border-t border-line px-3 py-2 text-center text-xs text-[#e4b34a]'>
              Mode Spectate (Admin)
            </div>
          )}
        </section>
      )}

      {!wide && !inline && (
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
  corner = 'bottom',
  inline = false,
}: {
  game: GameId;
  /** Players' names; when left out the chat asks the room for them */
  names?: (string | null)[];
  /** Where the chat button sits on a narrow screen (top keeps it off a hand of cards) */
  corner?: 'top' | 'bottom';
  /** Render inline inside a game's own layout instead of fixed floating/docked */
  inline?: boolean;
}) {
  const [session] = useStoredState<RoomSession | null>(
    `room-session-${game}`,
    null,
    'tab',
  );
  const [spectateCode, setSpectateCode] = React.useState('');

  React.useEffect(() => {
    const t = setTimeout(() => {
      const raw = new URLSearchParams(window.location.search).get('spectate');
      if (raw) setSpectateCode(normalizeCode(raw));
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const effective =
    session ??
    (spectateCode ? { code: spectateCode, token: '', you: -1 } : null);

  // a new room starts a new conversation
  return effective ? (
    <Chat
      key={effective.code}
      session={effective}
      names={names}
      corner={corner}
      inline={inline}
    />
  ) : null;
}
