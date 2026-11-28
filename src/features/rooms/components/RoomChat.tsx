'use client';

import { ChevronDown, ChevronUp, Sticker } from 'lucide-react';
import * as React from 'react';

import useStoredState from '@/hooks/useStoredState';
import useWide from '@/hooks/useWide';

import { seatName, useLang, useText } from '@/features/games/components/lang';
import { normalizeCode } from '@/features/rooms/code-format';
import {
  getRoomSticker,
  ROOM_STICKERS,
  type RoomSticker,
} from '@/features/rooms/stickers';
import { CHAT_MAX_LENGTH, ChatMsg, GameId } from '@/features/rooms/types';
import type { RoomSession } from '@/features/rooms/useRoom';

const POLL_CLOSED_MS = 3000;
const POLL_OPEN_MS = 1200;

const time = (at: number, locale: string) =>
  new Date(at).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });

function StickerArt({ sticker }: { sticker: RoomSticker }) {
  const lang = useLang();
  return (
    <span className='inline-flex flex-col items-center px-1 py-1 text-center leading-none'>
      <span aria-hidden='true' className='text-[2.25em] drop-shadow-sm'>
        {sticker.art}
      </span>
      <span className='-mt-0.5 rotate-[-6deg] rounded-full bg-ink px-2 py-1 font-black whitespace-nowrap text-paper shadow-sm'>
        {sticker.label[lang]}
      </span>
    </span>
  );
}

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
  const docked = inline || wide;
  const [openByHand, setOpen] = React.useState<boolean | null>(null);
  const open = openByHand ?? docked;
  const [lines, setLines] = React.useState<ChatMsg[]>([]);
  const [seen, setSeen] = React.useState<string | null>(null);
  const [text, setText] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [stickerQuery, setStickerQuery] = React.useState('');
  /** Where your next line goes; null when you may not talk right now */
  const [channel, setChannel] = React.useState<string | null>('all');
  const [error, setError] = React.useState('');
  /** Names as the room knows them, for games that do not pass their own */
  const [roomNames, setRoomNames] = React.useState<(string | null)[]>([]);
  const shownNames = names ?? roomNames;
  const lastId = React.useRef<string | null>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const toggleRef = React.useRef<HTMLButtonElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const pickerButtonRef = React.useRef<HTMLButtonElement>(null);
  const stickerSearchRef = React.useRef<HTMLInputElement>(null);
  const inputId = React.useId();
  const panelId = `${inputId}-panel`;
  const pickerId = `${inputId}-stickers`;
  const showPicker = pickerOpen && channel !== null;
  const searchWords = stickerQuery.trim().toLowerCase().split(/\s+/);
  const visibleStickers = ROOM_STICKERS.filter((sticker) => {
    const searchable =
      `${sticker.art} ${sticker.id} ${sticker.label.id} ${sticker.label.en} ${sticker.keywords}`.toLowerCase();
    return searchWords.every((word) => searchable.includes(word));
  });

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
    if (openByHand && !docked) inputRef.current?.focus();
  }, [docked, openByHand]);

  React.useEffect(() => {
    if (open && showPicker) stickerSearchRef.current?.focus();
  }, [open, showPicker]);

  const unread = open
    ? 0
    : lines
        .slice(lines.findIndex((line) => line.id === seen) + 1)
        .filter((line) => line.seat !== you).length;

  const toggle = () => {
    setSeen(lastId.current);
    setOpen(!open);
    setPickerOpen(false);
    setStickerQuery('');
    setError('');
  };

  const closePicker = () => {
    setPickerOpen(false);
    setStickerQuery('');
    pickerButtonRef.current?.focus();
  };

  const send = async (body: { text: string } | { stickerId: string }) => {
    if (sending || channel === null) return false;
    setSending(true);
    setError('');
    try {
      const res = await fetch(`/api/rooms/${code}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-player-token': token,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? t.sendFailed);
        return false;
      }
      void fetchNew();
      return true;
    } catch {
      setError(t.sendFailed);
      return false;
    } finally {
      setSending(false);
    }
  };

  const sendText = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending || channel === null) return;
    if (inline) inputRef.current?.focus({ preventScroll: true });
    if (await send({ text: body }))
      setText((draft) => (draft === text ? '' : draft));
  };

  const chatToggle = (
    <button
      ref={toggleRef}
      type='button'
      onClick={toggle}
      aria-expanded={open}
      aria-controls={open || docked ? panelId : undefined}
      aria-label={
        unread
          ? `${t.chat}, ${t.unreadChat(unread)}`
          : open
            ? t.closeChat
            : t.openChat
      }
      className={
        docked
          ? 'flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-surface'
          : 'flex items-center gap-2 rounded-full border border-line-strong bg-card px-4 py-2 text-sm shadow-lg transition-[transform,border-color] hover:-translate-y-0.5 hover:border-[var(--mute)] active:scale-95'
      }
    >
      {t.chat}
      {unread > 0 && (
        <span className='a-pop flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold text-paper'>
          {unread}
        </span>
      )}
      {docked &&
        (open ? (
          <ChevronUp size={16} aria-hidden='true' />
        ) : (
          <ChevronDown size={16} aria-hidden='true' />
        ))}
    </button>
  );

  return (
    <div
      data-chat-open={open}
      className={
        inline
          ? 'flex h-full w-full flex-col'
          : wide
            ? `fixed top-4 right-4 z-30 flex w-80 flex-col ${open ? 'bottom-4' : ''}`
            : `fixed right-4 z-40 flex flex-col items-end gap-2 ${
                corner === 'top' ? 'top-3 flex-col-reverse' : 'bottom-4'
              }`
      }
    >
      {(open || docked) && (
        <section
          aria-label={t.chatRoom}
          className={`flex flex-col overflow-hidden rounded-xl border border-line-strong bg-card ${
            docked
              ? `w-full ${open ? 'h-full' : ''} ${wide && !inline ? 'shadow-2xl' : ''}`
              : 'h-[min(24rem,60dvh)] w-80 max-w-[calc(100vw-2rem)] shadow-2xl'
          }`}
          onKeyDown={(e) => {
            // keep typing here from triggering game shortcuts
            e.stopPropagation();
            if (e.key === 'Escape') {
              if (showPicker) {
                e.preventDefault();
                closePicker();
              } else if (open) {
                e.preventDefault();
                toggle();
                toggleRef.current?.focus();
              }
            }
          }}
        >
          <div className='flex shrink-0 items-center justify-between border-b border-line px-3 py-2 text-sm'>
            {docked ? (
              chatToggle
            ) : (
              <span className='font-medium'>{t.chat}</span>
            )}
            <span className='text-xs text-[var(--mute)]'>
              {t.room} {code}
            </span>
          </div>

          <div
            id={panelId}
            hidden={!open}
            className={
              open
                ? 'flex min-h-0 flex-1 flex-col motion-safe:animate-[g-slide-up_240ms_var(--ease)_both]'
                : undefined
            }
          >
            <div
              ref={listRef}
              role='log'
              aria-live='polite'
              className='min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2'
            >
              {lines.length === 0 && (
                <p className='pt-6 text-center text-xs text-[var(--mute)]'>
                  {t.noMessages}
                </p>
              )}
              {lines.map((l) => {
                const isAdmin = l.seat === -1;
                const mine = l.seat === you;
                const sticker = getRoomSticker(l.stickerId);
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
                    {sticker ? (
                      <span
                        role='img'
                        aria-label={sticker.label[lang]}
                        className='text-lg'
                      >
                        <StickerArt sticker={sticker} />
                      </span>
                    ) : (
                      <span
                        className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm break-words ${
                          mine
                            ? 'rounded-br-md bg-accent/20'
                            : 'rounded-bl-md bg-surface'
                        }`}
                      >
                        {l.text}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {token && showPicker && (
              <div
                id={pickerId}
                role='region'
                aria-label={t.stickers}
                className='flex max-h-[55%] min-h-0 flex-col gap-2 overflow-y-auto border-t border-line p-2'
              >
                <input
                  ref={stickerSearchRef}
                  type='search'
                  aria-label={t.searchStickers}
                  placeholder={t.searchStickers}
                  value={stickerQuery}
                  onChange={(e) => setStickerQuery(e.target.value)}
                  className='w-full shrink-0 text-sm'
                />
                {visibleStickers.length ? (
                  <div className='grid grid-cols-4 gap-1'>
                    {visibleStickers.map((sticker) => (
                      <button
                        key={sticker.id}
                        type='button'
                        disabled={sending}
                        aria-label={t.sendSticker(sticker.label[lang])}
                        onClick={async () => {
                          if (await send({ stickerId: sticker.id }))
                            closePicker();
                        }}
                        className='rounded-lg py-1 text-[10px] hover:bg-surface disabled:opacity-50'
                      >
                        <StickerArt sticker={sticker} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p
                    role='status'
                    className='py-2 text-center text-xs text-[var(--mute)]'
                  >
                    {t.noStickers}
                  </p>
                )}
              </div>
            )}

            {error && (
              <p
                id={`${inputId}-error`}
                className='px-3 pb-1 text-xs text-err'
                role='alert'
              >
                {error}
              </p>
            )}
            {token ? (
              <form
                onSubmit={sendText}
                aria-busy={sending}
                className='flex shrink-0 gap-2 border-t border-line p-2'
              >
                <button
                  ref={pickerButtonRef}
                  type='button'
                  aria-label={t.stickers}
                  title={t.stickers}
                  aria-expanded={showPicker}
                  aria-controls={showPicker ? pickerId : undefined}
                  disabled={channel === null}
                  onClick={() => {
                    if (showPicker) closePicker();
                    else setPickerOpen(true);
                  }}
                  className='rounded-lg border border-line px-2 hover:bg-surface disabled:opacity-40 aria-expanded:bg-surface'
                >
                  <Sticker size={18} aria-hidden='true' />
                </button>
                <input
                  ref={inputRef}
                  id={inputId}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setError('');
                  }}
                  maxLength={CHAT_MAX_LENGTH}
                  disabled={channel === null}
                  placeholder={channel === null ? t.muted : t.write}
                  aria-label={t.message}
                  aria-describedby={error ? `${inputId}-error` : undefined}
                  autoComplete='off'
                  enterKeyHint='send'
                  className='min-w-0 flex-1'
                />
                <button
                  type='submit'
                  disabled={sending || !text.trim() || channel === null}
                  className='rounded-lg bg-ink px-3 text-sm font-medium text-paper transition-opacity disabled:opacity-40'
                >
                  {sending
                    ? lang === 'en'
                      ? 'Sending…'
                      : 'Mengirim…'
                    : t.send}
                </button>
              </form>
            ) : (
              <div className='border-t border-line px-3 py-2 text-center text-xs text-[#e4b34a]'>
                Mode Spectate (Admin)
              </div>
            )}
          </div>
        </section>
      )}

      {!docked && chatToggle}
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
