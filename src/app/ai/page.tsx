'use client';

import * as React from 'react';

import Markdown from '@/components/Markdown';
import TopNav from '@/components/TopNav';

import DocumentTitle from '@/features/games/components/DocumentTitle';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

type PresetId = 'openai' | 'openrouter' | 'groq' | 'custom';

const PRESETS: Record<
  PresetId,
  { label: string; baseUrl: string; defaultModel: string }
> = {
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
  },
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o-mini',
  },
  groq: {
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
  },
  custom: {
    label: 'Custom / 9Router',
    baseUrl: '/v1',
    defaultModel: '',
  },
};

function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '');
}

export default function AiPage() {
  const [preset, setPreset] = React.useState<PresetId>('openai');
  const [baseUrl, setBaseUrl] = React.useState(PRESETS.openai.baseUrl);
  const [apiKeyInput, setApiKeyInput] = React.useState('');
  const [activeKey, setActiveKey] = React.useState('');
  const [activeUrl, setActiveUrl] = React.useState('');
  const [showKey, setShowKey] = React.useState(false);

  const [models, setModels] = React.useState<string[]>([]);
  const [selectedModel, setSelectedModel] = React.useState(
    PRESETS.openai.defaultModel,
  );
  const [connecting, setConnecting] = React.useState(false);
  const [connectError, setConnectError] = React.useState('');

  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = React.useState('');
  const [streaming, setStreaming] = React.useState(false);
  const [chatError, setChatError] = React.useState('');
  const [copiedBase, setCopiedBase] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const pickPreset = (id: PresetId) => {
    setPreset(id);
    setBaseUrl(PRESETS[id].baseUrl);
    if (PRESETS[id].defaultModel) {
      setSelectedModel(PRESETS[id].defaultModel);
    }
    setConnectError('');
  };

  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = apiKeyInput.trim();
    const url = normalizeBaseUrl(baseUrl);
    if (!key || !url || connecting) return;

    setConnecting(true);
    setConnectError('');
    try {
      const res = await fetch(`${url}/models`, {
        headers: { authorization: `Bearer ${key}` },
        cache: 'no-store',
        credentials: 'omit',
      });
      if (res.status === 401 || res.status === 403) {
        throw new Error('API key tidak valid atau ditolak oleh provider.');
      }
      if (!res.ok) {
        throw new Error(`Gagal memuat model (HTTP ${res.status}).`);
      }
      const data = (await res.json()) as { data?: { id?: string }[] };
      const list = (data.data ?? [])
        .map((m) => m.id)
        .filter((id): id is string => typeof id === 'string')
        .sort((a, b) => a.localeCompare(b));

      setActiveKey(key);
      setActiveUrl(url);
      setApiKeyInput('');
      setModels(list);
      if (list.length > 0) {
        setSelectedModel((cur) =>
          cur && list.includes(cur)
            ? cur
            : PRESETS[preset].defaultModel &&
                list.includes(PRESETS[preset].defaultModel)
              ? PRESETS[preset].defaultModel
              : list[0],
        );
      }
    } catch (err) {
      setConnectError(
        err instanceof Error
          ? err.message
          : 'Gagal terhubung ke endpoint. Periksa Base URL dan API key.',
      );
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setActiveKey('');
    setActiveUrl('');
    setModels([]);
    setMessages([]);
    setStreaming(false);
    setChatError('');
  };

  const sendPrompt = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = prompt.trim();
    const model = selectedModel.trim();
    if (!text || !activeKey || !activeUrl || !model || streaming) return;

    const nextHistory: ChatMessage[] = [
      ...messages,
      { role: 'user', content: text },
    ];
    setMessages([...nextHistory, { role: 'assistant', content: '' }]);
    setPrompt('');
    setChatError('');
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${activeUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${activeKey}`,
        },
        credentials: 'omit',
        signal: controller.signal,
        body: JSON.stringify({
          model,
          stream: true,
          messages: nextHistory,
        }),
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => '');
        throw new Error(errText || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let acc = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const parsed = JSON.parse(payload) as {
              choices?: {
                delta?: { content?: string };
                message?: { content?: string };
              }[];
            };
            const delta =
              parsed.choices?.[0]?.delta?.content ??
              parsed.choices?.[0]?.message?.content ??
              '';
            if (delta) {
              acc += delta;
              setMessages([
                ...nextHistory,
                { role: 'assistant', content: acc },
              ]);
            }
          } catch {
            // ignore non-JSON SSE comments
          }
        }
      }
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError')) {
        setChatError(
          err instanceof Error ? err.message : 'Gagal mengirim pesan.',
        );
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
    }
  };

  const copyRelayUrl = async () => {
    const url = `${window.location.origin}/v1`;
    await navigator.clipboard.writeText(url);
    setCopiedBase(true);
    setTimeout(() => setCopiedBase(false), 1500);
  };

  return (
    <div className='games-ui flex min-h-dvh flex-col text-[15px] text-ink'>
      <DocumentTitle title='AI Chat' />

      <main className='mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 pt-6 pb-8'>
        <TopNav />

        {!activeKey ? (
          /* Step 1: Masukkan API Key */
          <div className='mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-6'>
            <div className='mb-5'>
              <h1 className='text-2xl font-semibold tracking-tight'>AI Chat</h1>
              <p className='mt-1 text-sm text-[var(--mute)]'>
                Masukkan API key milikmu sendiri. Key hanya disimpan di memori
                tab ini dan tidak pernah disimpan di server.
              </p>
            </div>

            <form
              onSubmit={connect}
              className='flex flex-col gap-4 rounded-xl border border-line bg-surface/50 p-5'
            >
              <div>
                <span className='mb-2 block text-xs text-[var(--mute)]'>
                  Pilih Provider
                </span>
                <div className='flex flex-wrap gap-1.5'>
                  {(Object.keys(PRESETS) as PresetId[]).map((id) => (
                    <button
                      key={id}
                      type='button'
                      onClick={() => pickPreset(id)}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                        preset === id
                          ? 'border-transparent bg-ink text-paper'
                          : 'border-line-strong text-[var(--mute)] hover:text-ink'
                      }`}
                    >
                      {PRESETS[id].label}
                    </button>
                  ))}
                </div>
              </div>

              <label className='flex flex-col gap-1.5 text-xs text-[var(--mute)]'>
                Base URL
                <input
                  type='text'
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder='https://api.openai.com/v1'
                  className='rounded-lg border border-line-strong bg-paper px-3 py-2 font-mono text-xs text-ink focus:border-accent focus:outline-none'
                />
              </label>

              <label className='flex flex-col gap-1.5 text-xs text-[var(--mute)]'>
                API Key Kamu
                <div className='flex items-center gap-1.5'>
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder='sk-... / gsk_... / or-...'
                    className='min-w-0 flex-1 rounded-lg border border-line-strong bg-paper px-3 py-2 font-mono text-xs text-ink focus:border-accent focus:outline-none'
                  />
                  <button
                    type='button'
                    onClick={() => setShowKey((s) => !s)}
                    className='rounded-lg border border-line-strong px-3 py-2 text-xs text-[var(--mute)] hover:text-ink'
                  >
                    {showKey ? 'Tutup' : 'Lihat'}
                  </button>
                </div>
              </label>

              {connectError && (
                <p className='text-xs text-err'>{connectError}</p>
              )}

              <button
                type='submit'
                disabled={connecting || !apiKeyInput.trim() || !baseUrl.trim()}
                className='w-full rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-paper transition hover:opacity-90 disabled:opacity-40'
              >
                {connecting ? 'Menghubungkan...' : 'Masuk ke Chat →'}
              </button>
            </form>

            <div className='mt-4 flex items-center justify-between rounded-xl border border-line bg-surface/30 px-4 py-3 text-xs text-[var(--mute)]'>
              <span>Pakai di Cursor / Cline / SDK lewat endpoint /v1</span>
              <button
                type='button'
                onClick={copyRelayUrl}
                className='shrink-0 text-accent hover:underline'
              >
                {copiedBase ? 'Tersalin' : 'Salin URL'}
              </button>
            </div>
          </div>
        ) : (
          /* Step 2: Halaman Chat */
          <div className='mx-auto flex w-full max-w-4xl flex-1 flex-col gap-3'>
            <div className='flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface/50 px-4 py-2.5'>
              <div className='flex min-w-0 flex-1 items-center gap-2'>
                <span className='size-2 shrink-0 rounded-full bg-accent' />
                {models.length > 0 ? (
                  <select
                    aria-label='Pilih model'
                    value={selectedModel}
                    disabled={streaming}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className='max-w-xs truncate rounded-lg border border-line-strong bg-paper px-2.5 py-1.5 font-mono text-xs text-ink'
                  >
                    {models.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type='text'
                    aria-label='Nama model'
                    value={selectedModel}
                    disabled={streaming}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    placeholder='gpt-4o-mini'
                    className='max-w-xs rounded-lg border border-line-strong bg-paper px-2.5 py-1.5 font-mono text-xs text-ink'
                  />
                )}
                <span className='hidden truncate font-mono text-xs text-[var(--mute)] sm:inline'>
                  {activeUrl}
                </span>
              </div>

              <div className='flex items-center gap-2'>
                <button
                  type='button'
                  onClick={() => {
                    abortRef.current?.abort();
                    setMessages([]);
                    setChatError('');
                  }}
                  className='rounded-lg border border-line-strong px-3 py-1.5 text-xs hover:border-accent'
                >
                  Chat Baru
                </button>
                <button
                  type='button'
                  onClick={disconnect}
                  className='rounded-lg border border-line-strong px-3 py-1.5 text-xs text-[var(--mute)] hover:border-err/50 hover:text-err'
                >
                  Ganti Key
                </button>
              </div>
            </div>

            <div className='flex min-h-[480px] flex-1 flex-col rounded-xl border border-line bg-surface/50'>
              <div className='flex-1 space-y-4 overflow-y-auto p-4'>
                {messages.length === 0 ? (
                  <div className='flex h-full min-h-[320px] flex-col items-center justify-center text-center text-sm text-[var(--mute)]'>
                    <p>
                      Terhubung ke{' '}
                      <span className='font-mono text-ink'>
                        {selectedModel || 'model'}
                      </span>
                      . Mulai kirim pesan di bawah.
                    </p>
                  </div>
                ) : (
                  messages.map((m, idx) => (
                    <div
                      key={idx}
                      className={`rounded-xl border p-3.5 ${
                        m.role === 'user'
                          ? 'ml-auto max-w-[85%] border-line-strong bg-card'
                          : 'mr-auto max-w-[95%] border-line bg-paper'
                      }`}
                    >
                      <div className='mb-1 text-[11px] font-medium text-[var(--mute)]'>
                        {m.role === 'user' ? 'Kamu' : selectedModel}
                      </div>
                      {m.role === 'assistant' ? (
                        <Markdown>{m.content || '...'}</Markdown>
                      ) : (
                        <div className='text-sm whitespace-pre-wrap text-ink'>
                          {m.content}
                        </div>
                      )}
                    </div>
                  ))
                )}
                <div ref={endRef} />
              </div>

              {chatError && (
                <div className='mx-4 mb-2 rounded-lg border border-err/40 bg-err/10 px-3 py-2 text-xs text-err'>
                  {chatError}
                </div>
              )}

              <form
                onSubmit={sendPrompt}
                className='flex items-end gap-2 border-t border-line p-3'
              >
                <textarea
                  rows={2}
                  disabled={streaming}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendPrompt();
                    }
                  }}
                  placeholder='Tulis pesan... (Enter untuk kirim, Shift+Enter baris baru)'
                  className='min-w-0 flex-1 resize-none rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink placeholder:text-[var(--mute)] focus:border-accent focus:outline-none disabled:opacity-50'
                />
                {streaming ? (
                  <button
                    type='button'
                    onClick={() => abortRef.current?.abort()}
                    className='rounded-lg border border-err/50 px-4 py-2 text-sm text-err hover:bg-err/10'
                  >
                    Stop
                  </button>
                ) : (
                  <button
                    type='submit'
                    disabled={!prompt.trim()}
                    className='rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:opacity-90 disabled:opacity-40'
                  >
                    Kirim
                  </button>
                )}
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
