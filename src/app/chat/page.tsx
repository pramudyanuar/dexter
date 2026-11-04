'use client';

import Link from 'next/link';
import * as React from 'react';
import '@/lib/env';

import { Attachment, formatTextFile, readAttachment } from '@/lib/attachments';
import {
  activePath,
  addNode,
  Chat,
  ChatNode,
  childrenMap,
  emptyChat,
  newId,
  pathTo,
  selectNode,
  siblingsIn,
  titleFrom,
  Usage,
} from '@/lib/chatTree';
import useStoredState from '@/lib/useStoredState';

import AuthGate from '@/components/AuthGate';
import { useAuth } from '@/components/AuthGate';
import Markdown from '@/components/Markdown';
import Sidebar from '@/components/Sidebar';

import {
  DEFAULT_MODEL,
  MAX_ATTACHMENTS,
  MAX_REQUEST_IMAGE_CHARS,
  MODELS,
  PROVIDERS,
  USAGE_DELIMITER,
} from '@/constant/chat';

const NO_CHATS: Chat[] = [];

const SUGGESTIONS = [
  'Apa beda useEffect dan useLayoutEffect? Kapan pakai yang mana?',
  'Bikin endpoint REST di Next.js dengan validasi zod',
  'Kenapa Promise.all gagal semua kalau satu reject, dan alternatifnya?',
];

/** Short fake commit hash so every reply looks like `[main 3f2a9c1]`. */
function shortHash(text: string) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (h * 33) ^ text.charCodeAt(i);
  return (h >>> 0).toString(16).padStart(7, '0').slice(0, 7);
}

const fmt = (n: number) => n.toLocaleString('en-US');

const actionButton =
  'text-mute hover:text-accent text-xs transition disabled:opacity-30 disabled:hover:text-mute';
// always visible on touch screens, on hover for desktop
const hoverActions =
  'md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100';

/** `‹ 2/3 ›` for switching between versions of a message. */
function Switcher({
  index,
  count,
  disabled,
  onChange,
}: {
  index: number;
  count: number;
  disabled: boolean;
  onChange: (index: number) => void;
}) {
  if (count < 2) return null;
  return (
    <span className='text-xs text-mute'>
      <button
        type='button'
        aria-label='Versi sebelumnya'
        disabled={disabled || index === 0}
        onClick={() => onChange(index - 1)}
        className='px-1 hover:text-accent disabled:opacity-30'
      >
        ‹
      </button>
      {index + 1}/{count}
      <button
        type='button'
        aria-label='Versi berikutnya'
        disabled={disabled || index === count - 1}
        onClick={() => onChange(index + 1)}
        className='px-1 hover:text-accent disabled:opacity-30'
      >
        ›
      </button>
    </span>
  );
}

function ChatApp() {
  const { logout, expire } = useAuth();
  const [chats, setChats] = useStoredState<Chat[]>('chats', NO_CHATS);
  const [currentId, setCurrentId] = useStoredState<string | null>(
    'chat-current',
    null,
  );
  const [storedModel, setModel] = useStoredState<string>(
    'chat-model',
    DEFAULT_MODEL,
  );
  // a model saved by an older version may no longer exist
  const option = MODELS.find((m) => m.id === storedModel) ?? MODELS[0];

  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  // reply being streamed; only saved to the chat once it is complete
  const [draft, setDraft] = React.useState<string | null>(null);
  const [error, setError] = React.useState('');
  const [files, setFiles] = React.useState<Attachment[]>([]);
  // image data lives in memory only: base64 would overflow localStorage
  const [images, setImagesState] = React.useState<Record<string, string[]>>({});
  const [notice, setNotice] = React.useState('');
  const [editing, setEditing] = React.useState<{
    id: string;
    text: string;
  } | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const chatEndRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  // refs hold the latest value for code that runs after an await
  const chatsRef = React.useRef(chats);
  const imagesRef = React.useRef(images);
  React.useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  const chat = chats.find((c) => c.id === currentId) ?? null;
  const path = React.useMemo(() => (chat ? activePath(chat) : []), [chat]);
  const kids = React.useMemo(() => (chat ? childrenMap(chat) : null), [chat]);

  const totals = Object.values(chat?.nodes ?? {}).reduce(
    (sum, n) => ({
      prompt: sum.prompt + (n.usage?.prompt ?? 0),
      completion: sum.completion + (n.usage?.completion ?? 0),
      total: sum.total + (n.usage?.total ?? 0),
    }),
    { prompt: 0, completion: 0, total: 0 },
  );

  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
  }, [path.length, draft, currentId]);

  // grow the textarea with its content, up to a cap
  React.useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  const putImages = (id: string, urls: string[]) => {
    imagesRef.current = { ...imagesRef.current, [id]: urls };
    setImagesState(imagesRef.current);
  };

  /** Saves a chat, replacing it in place or adding it to the list. */
  const commit = (next: Chat) => {
    const list = chatsRef.current;
    const updated = list.some((c) => c.id === next.id)
      ? list.map((c) => (c.id === next.id ? next : c))
      : [next, ...list];
    chatsRef.current = updated;
    setChats(updated);
  };

  const addFiles = async (list: File[]) => {
    setNotice('');
    const room = MAX_ATTACHMENTS - files.length;
    if (list.length > room) {
      setNotice(`Maksimal ${MAX_ATTACHMENTS} lampiran per pesan`);
    }

    const results = await Promise.allSettled(
      list.slice(0, Math.max(room, 0)).map(readAttachment),
    );
    const added: Attachment[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') added.push(r.value);
      else setNotice(r.reason instanceof Error ? r.reason.message : 'Gagal');
    }
    if (added.length) setFiles((prev) => [...prev, ...added]);
  };

  /** Streams a reply to `userNode` and saves it as a child of that node. */
  const runReply = async (base: Chat, userNode: ChatNode) => {
    setError('');
    setIsLoading(true);
    setDraft('');

    // include images from the newest messages first, within the size budget
    const chain = pathTo(base, userNode.id);
    const sendImages: Record<string, string[]> = {};
    let budget = MAX_REQUEST_IMAGE_CHARS;
    if (option.vision) {
      for (const n of [...chain].reverse()) {
        const urls = imagesRef.current[n.id];
        if (!urls) continue;
        const size = urls.reduce((sum, u) => sum + u.length, 0);
        if (size > budget) break;
        budget -= size;
        sendImages[n.id] = urls;
      }
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: option.id,
          messages: chain.map((n) => ({
            role: n.role,
            content: sendImages[n.id]
              ? [
                  { type: 'text', text: n.content },
                  ...sendImages[n.id].map((url) => ({
                    type: 'image_url',
                    image_url: { url },
                  })),
                ]
              : n.content,
          })),
        }),
      });

      if (res.status === 401) {
        expire();
        return;
      }
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let raw = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });
        setDraft(raw.split(USAGE_DELIMITER)[0]);
      }

      // the server appends token usage after the delimiter
      const [text, usageJson] = raw.split(USAGE_DELIMITER);
      let usage: Usage | undefined;
      try {
        usage = usageJson ? JSON.parse(usageJson) : undefined;
      } catch {
        // no usage shown if malformed
      }

      // an error raised mid-stream is appended to the text by the server
      const errAt = text.lastIndexOf('\n\nError: ');
      const reply = errAt >= 0 ? text.slice(0, errAt) : text;
      if (errAt >= 0) setError(text.slice(errAt + 2));

      if (reply.trim()) {
        const latest = chatsRef.current.find((c) => c.id === base.id) ?? base;
        commit(
          addNode(latest, {
            id: newId(),
            parent: userNode.id,
            role: 'assistant',
            content: reply,
            usage,
            model: option.label,
          }),
        );
      }
    } catch (err) {
      setError(
        `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    } finally {
      setDraft(null);
      setIsLoading(false);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if ((!text && files.length === 0) || isLoading) return;

    const newImages = files.flatMap((f) => (f.kind === 'image' ? [f] : []));
    if (newImages.length && !option.vision) {
      setNotice(
        `${option.label} tidak bisa membaca gambar. Pilih model bertanda "gambar".`,
      );
      return;
    }
    if (
      newImages.reduce((n, f) => n + f.dataUrl.length, 0) >
      MAX_REQUEST_IMAGE_CHARS
    ) {
      setNotice('Gambar terlalu besar, kurangi jumlahnya');
      return;
    }

    const fileBlocks = files.flatMap((f) =>
      f.kind === 'text' ? [formatTextFile(f.name, f.text)] : [],
    );
    const node: ChatNode = {
      id: newId(),
      parent: path.length ? path[path.length - 1].id : null,
      role: 'user',
      content:
        [text, ...fileBlocks].filter(Boolean).join('\n\n') ||
        '(lihat gambar terlampir)',
      shown: text,
      fileBlocks: fileBlocks.length ? fileBlocks : undefined,
      attachments: files.length ? files.map((f) => f.name) : undefined,
    };

    const base = chat ?? {
      ...emptyChat(),
      title: titleFrom(text || files[0].name),
    };
    const next = addNode(base, node);
    if (newImages.length)
      putImages(
        node.id,
        newImages.map((f) => f.dataUrl),
      );

    commit(next);
    setCurrentId(next.id);
    setFiles([]);
    setNotice('');
    setInput('');
    runReply(next, node);
  };

  const submitEdit = () => {
    if (!chat || !editing || isLoading) return;
    const orig = chat.nodes[editing.id];
    const text = editing.text.trim();
    if (!text && !orig.fileBlocks?.length && !orig.attachments?.length) return;

    // a sibling of the original: both versions stay, only the shown one changes
    const node: ChatNode = {
      ...orig,
      id: newId(),
      shown: text,
      content:
        [text, ...(orig.fileBlocks ?? [])].filter(Boolean).join('\n\n') ||
        '(lihat gambar terlampir)',
    };
    const oldImages = imagesRef.current[orig.id];
    if (oldImages) putImages(node.id, oldImages);

    const next = addNode(chat, node);
    commit(next);
    setEditing(null);
    runReply(next, node);
  };

  const regenerate = (reply: ChatNode) => {
    if (!chat || !reply.parent || isLoading) return;
    runReply(chat, chat.nodes[reply.parent]);
  };

  const switchTo = (id: string) => {
    if (chat && !isLoading) commit(selectNode(chat, id));
  };

  const openChat = (id: string | null) => {
    setCurrentId(id);
    setEditing(null);
    setError('');
    setFiles([]);
    setNotice('');
  };

  const deleteChat = (id: string) => {
    const updated = chatsRef.current.filter((c) => c.id !== id);
    chatsRef.current = updated;
    setChats(updated);
    if (id === currentId) openChat(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = Array.from(e.clipboardData.files);
    if (pasted.length) {
      e.preventDefault();
      addFiles(pasted);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  const quietField =
    'rounded-sm border-line bg-transparent px-2 py-0.5 text-xs text-mute focus:border-accent focus:ring-0 focus:outline-none';
  const isEmpty = path.length === 0 && draft === null;
  const lastNode = path[path.length - 1];
  const needsReply = !isLoading && lastNode?.role === 'user';

  const renderUser = (node: ChatNode) => {
    const sibs = kids ? siblingsIn(kids, node) : [node];
    const text = node.shown ?? node.content;

    if (editing?.id === node.id) {
      return (
        <div>
          <div className='flex gap-2'>
            <span className='pt-[3px] leading-6 text-accent select-none'>
              $
            </span>
            <textarea
              autoFocus
              rows={Math.min(10, editing.text.split('\n').length + 1)}
              value={editing.text}
              aria-label='Edit pesan'
              onChange={(e) =>
                setEditing({ id: node.id, text: e.target.value })
              }
              onKeyDown={(e) => {
                if (e.key === 'Escape') setEditing(null);
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitEdit();
              }}
              className='w-full resize-y rounded-sm border-line bg-card p-2 leading-6 focus:border-accent focus:ring-0 focus:outline-none'
            />
          </div>
          <div className='mt-1 flex gap-3 pl-4 text-xs'>
            <button
              type='button'
              onClick={submitEdit}
              className='text-accent hover:underline'
            >
              [kirim versi baru]
            </button>
            <button
              type='button'
              onClick={() => setEditing(null)}
              className='text-mute hover:text-ink'
            >
              [batal]
            </button>
            <span className='text-mute'>ctrl+enter kirim, esc batal</span>
          </div>
        </div>
      );
    }

    return (
      <div className='group'>
        {text && (
          <p className='flex gap-2 leading-6 font-semibold'>
            <span className='text-accent select-none'>$</span>
            <span className='whitespace-pre-wrap'>{text}</span>
          </p>
        )}
        {(node.attachments || images[node.id]) && (
          <div className='mt-2 flex flex-wrap items-end gap-2 pl-4'>
            {images[node.id]?.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={url}
                alt=''
                className='max-h-32 max-w-[40%] rounded-sm border border-line'
              />
            ))}
            {node.attachments?.map((name) => (
              <span key={name} className='text-xs text-mute'>
                + {name}
              </span>
            ))}
          </div>
        )}
        <div className='mt-1 flex items-center gap-3 pl-4'>
          <Switcher
            index={sibs.findIndex((s) => s.id === node.id)}
            count={sibs.length}
            disabled={isLoading}
            onChange={(i) => switchTo(sibs[i].id)}
          />
          <span className={hoverActions}>
            <button
              type='button'
              disabled={isLoading}
              onClick={() => setEditing({ id: node.id, text: text })}
              className={actionButton}
            >
              [edit]
            </button>
          </span>
        </div>
      </div>
    );
  };

  const renderAssistant = (node: ChatNode) => {
    const sibs = kids ? siblingsIn(kids, node) : [node];
    return (
      <div className='group'>
        <Markdown>{node.content}</Markdown>
        <div className='mt-3 flex flex-wrap items-center gap-x-3 gap-y-1'>
          {node.usage && (
            <p className='text-xs text-mute'>
              [<span className='text-accent'>main</span>{' '}
              <span className='text-hash'>{shortHash(node.content)}</span>] ↑
              {fmt(node.usage.prompt)} ↓{fmt(node.usage.completion)} ={' '}
              {fmt(node.usage.total)} tok
              {node.model ? ` · ${node.model}` : ''}
            </p>
          )}
          <Switcher
            index={sibs.findIndex((s) => s.id === node.id)}
            count={sibs.length}
            disabled={isLoading}
            onChange={(i) => switchTo(sibs[i].id)}
          />
          <span className={hoverActions}>
            <button
              type='button'
              disabled={isLoading}
              onClick={() => regenerate(node)}
              className={actionButton}
            >
              [ulang]
            </button>
          </span>
        </div>
      </div>
    );
  };

  return (
    <div
      className='relative flex h-dvh flex-col bg-paper font-mono text-[13.5px] text-ink'
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDragging(false);
        }
      }}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className='pointer-events-none absolute inset-2 z-30 flex items-center justify-center border border-dashed border-accent bg-paper/90 text-accent'>
          lepas file di sini (gambar atau teks)
        </div>
      )}

      <header className='border-b border-line'>
        <div className='flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5'>
          <span className='text-sm'>
            <span className='text-accent'>dexter@{option.provider}</span>
            <span className='text-mute'>:</span>
            <Link href='/apps' className='text-info hover:underline'>
              ~
            </Link>
            <span className='text-info'>/chat</span>{' '}
            <span className='text-hash'>(main)</span>
          </span>
          <div className='flex items-center gap-3'>
            <button
              type='button'
              onClick={() => setSidebarOpen(true)}
              className={`${actionButton} md:hidden`}
            >
              :ls
            </button>
            <select
              value={option.id}
              onChange={(e) => setModel(e.target.value)}
              disabled={isLoading}
              aria-label='Model'
              className={`${quietField} pr-7`}
            >
              {(Object.keys(PROVIDERS) as (keyof typeof PROVIDERS)[]).map(
                (id) => (
                  <optgroup key={id} label={PROVIDERS[id].label}>
                    {MODELS.filter((m) => m.provider === id).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                        {m.vision ? ' · gambar' : ''}
                      </option>
                    ))}
                  </optgroup>
                ),
              )}
            </select>
            <button
              type='button'
              onClick={() => openChat(null)}
              disabled={isLoading || isEmpty}
              className={actionButton}
            >
              :new
            </button>
            <button type='button' onClick={logout} className={actionButton}>
              :logout
            </button>
          </div>
        </div>
      </header>

      <div className='flex min-h-0 flex-1'>
        <Sidebar
          chats={chats}
          currentId={chat?.id ?? null}
          open={sidebarOpen}
          disabled={isLoading}
          onSelect={openChat}
          onNew={() => openChat(null)}
          onDelete={deleteChat}
          onClose={() => setSidebarOpen(false)}
        />

        <div className='flex min-w-0 flex-1 flex-col'>
          <main className='flex-1 overflow-y-auto'>
            <div className='w-full px-4 py-6'>
              {isEmpty ? (
                <div className='leading-6'>
                  <p>On branch main</p>
                  <p className='text-mute'>
                    Your branch is up to date with &apos;{option.provider}
                    /main&apos;.
                  </p>
                  <p className='mt-4'>nothing to commit, working tree clean</p>
                  <p className='mt-4 text-mute'>
                    # Tanya soal kode. Enter kirim, Shift+Enter baris baru.
                    Tempel, seret, atau pilih gambar dan file teks.
                  </p>
                  <ul className='mt-3 space-y-1'>
                    {SUGGESTIONS.map((text) => (
                      <li key={text}>
                        <button
                          type='button'
                          onClick={() => {
                            setInput(text);
                            inputRef.current?.focus();
                          }}
                          className='flex gap-2 text-left transition hover:text-accent'
                        >
                          <span className='text-accent'>$</span>
                          <span>{text}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <ol className='space-y-6'>
                  {path.map((node) => (
                    <li key={node.id}>
                      {node.role === 'user'
                        ? renderUser(node)
                        : renderAssistant(node)}
                    </li>
                  ))}
                  {draft !== null && (
                    <li>
                      {draft && <Markdown>{draft}</Markdown>}
                      <span className='caret' aria-hidden />
                    </li>
                  )}
                </ol>
              )}

              {error && (
                <p className='mt-4 whitespace-pre-wrap text-err'>{error}</p>
              )}
              {needsReply && (
                <button
                  type='button'
                  onClick={() => chat && runReply(chat, lastNode)}
                  className={`${actionButton} mt-3`}
                >
                  [kirim ulang]
                </button>
              )}
              <div ref={chatEndRef} />
            </div>
          </main>

          <form onSubmit={handleSend} className='border-t border-line'>
            <div className='w-full px-4 py-3'>
              {notice && <p className='mb-2 text-xs text-err'>{notice}</p>}
              {files.length > 0 && (
                <ul className='mb-2 flex flex-wrap gap-2'>
                  {files.map((f) => (
                    <li
                      key={f.id}
                      className='flex items-center gap-2 rounded-sm border border-line px-2 py-0.5 text-xs text-mute'
                    >
                      {f.kind === 'image' && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={f.dataUrl}
                          alt=''
                          className='h-5 w-5 rounded-sm object-cover'
                        />
                      )}
                      <span className='max-w-[16ch] truncate'>{f.name}</span>
                      <button
                        type='button'
                        aria-label={`Hapus ${f.name}`}
                        onClick={() =>
                          setFiles((prev) => prev.filter((x) => x.id !== f.id))
                        }
                        className='hover:text-err'
                      >
                        x
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className='flex items-start gap-2'>
                <span className='pt-[3px] leading-6 text-accent select-none'>
                  $
                </span>
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  placeholder='tanya sesuatu…'
                  aria-label='Pesan'
                  className='max-h-[200px] flex-1 resize-none border-0 bg-transparent p-0 leading-6 placeholder:text-mute focus:ring-0 focus:outline-none'
                />
                <input
                  ref={fileInputRef}
                  type='file'
                  multiple
                  hidden
                  accept='image/*,text/*,.md,.json,.js,.jsx,.ts,.tsx,.py,.go,.rs,.java,.c,.cpp,.h,.cs,.php,.rb,.sh,.sql,.yml,.yaml,.toml,.env,.css,.html,.xml,.log,.csv'
                  onChange={(e) => {
                    addFiles(Array.from(e.target.files ?? []));
                    e.target.value = '';
                  }}
                />
                <button
                  type='button'
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className={`${actionButton} pt-[3px]`}
                >
                  [+ file]
                </button>
                <button
                  type='submit'
                  disabled={isLoading || (!input.trim() && files.length === 0)}
                  className={`${actionButton} pt-[3px]`}
                >
                  [kirim ↵]
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <footer className='border-t border-line bg-card text-xs text-mute'>
        <div className='flex w-full items-center justify-between gap-4 px-4 py-1'>
          <span>
            {option.provider}:{option.model}
          </span>
          <span>
            chat: ↑{fmt(totals.prompt)} ↓{fmt(totals.completion)} ={' '}
            <span className='text-ink'>{fmt(totals.total)}</span> tok
          </span>
        </div>
      </footer>
    </div>
  );
}

export default function ChatPage() {
  return (
    <AuthGate>
      <ChatApp />
    </AuthGate>
  );
}
