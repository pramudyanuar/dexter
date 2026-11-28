'use client';

import * as React from 'react';

import useStoredState from '@/hooks/useStoredState';

import Markdown from '@/components/Markdown';

import ToolShell from '@/features/tools/components/ToolShell';

interface Note {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
}

const DEFAULT_NOTES: Note[] = [
  {
    id: 'welcome',
    title: 'Catatan Pertama',
    body: '# Halo!\n\nIni adalah **Markdown Scratchpad** lokal.\n\n- Tersimpan otomatis di browser (`localStorage`)\n- Mendukung tabel, daftar tugas, dan blok kode\n\n```ts\nconsole.log("dexter tools");\n```\n',
    updatedAt: 0,
  },
];

export default function NotesToolPage() {
  const [notes, setNotes] = useStoredState<Note[]>(
    'dexter:notes:v1',
    DEFAULT_NOTES,
  );
  const [activeId, setActiveId] = React.useState<string>('welcome');
  const [mode, setMode] = React.useState<'split' | 'edit' | 'preview'>('split');
  const [copied, setCopied] = React.useState(false);

  const active =
    notes.find((n) => n.id === activeId) ?? notes[0] ?? DEFAULT_NOTES[0];

  const updateActive = (patch: Partial<Note>) => {
    setNotes(
      notes.map((n) =>
        n.id === active.id ? { ...n, ...patch, updatedAt: Date.now() } : n,
      ),
    );
  };

  const addNote = () => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const next: Note = {
      id,
      title: `Catatan ${notes.length + 1}`,
      body: '',
      updatedAt: Date.now(),
    };
    setNotes([next, ...notes]);
    setActiveId(id);
  };

  const deleteNote = (id: string) => {
    if (notes.length <= 1) return;
    const next = notes.filter((n) => n.id !== id);
    setNotes(next);
    if (active.id === id) setActiveId(next[0].id);
  };

  const exportMd = () => {
    const blob = new Blob([active.body], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${active.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'catatan'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyMd = async () => {
    await navigator.clipboard.writeText(active.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <ToolShell
      title='Markdown Scratchpad'
      description='Catatan cepat lokal di browser dengan preview Markdown.'
      wide
    >
      <div className='grid gap-4 md:grid-cols-[220px_1fr]'>
        {/* Sidebar notes */}
        <div className='flex flex-col gap-2 rounded-xl border border-line bg-surface/50 p-3'>
          <button
            type='button'
            onClick={addNote}
            className='w-full rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-paper transition hover:opacity-90'
          >
            + Catatan Baru
          </button>

          <ul className='flex flex-col gap-1'>
            {notes.map((note) => (
              <li key={note.id} className='flex items-center gap-1'>
                <button
                  type='button'
                  onClick={() => setActiveId(note.id)}
                  className={`min-w-0 flex-1 truncate rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                    note.id === active.id
                      ? 'bg-card font-medium text-ink'
                      : 'text-[var(--mute)] hover:text-ink'
                  }`}
                >
                  {note.title || 'Tanpa Judul'}
                </button>
                {notes.length > 1 && (
                  <button
                    type='button'
                    aria-label={`Hapus ${note.title}`}
                    onClick={() => deleteNote(note.id)}
                    className='px-1.5 text-xs text-[var(--mute)] hover:text-err'
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Editor / Preview */}
        <div className='flex flex-col gap-3 rounded-xl border border-line bg-surface/50 p-4'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <input
              type='text'
              value={active.title}
              onChange={(e) => updateActive({ title: e.target.value })}
              placeholder='Judul catatan...'
              className='min-w-0 flex-1 rounded-lg border border-line-strong bg-paper px-3 py-1.5 text-sm font-medium text-ink focus:border-accent focus:outline-none'
            />

            <div className='flex flex-wrap items-center gap-1.5'>
              {(['split', 'edit', 'preview'] as const).map((m) => (
                <button
                  key={m}
                  type='button'
                  onClick={() => setMode(m)}
                  className={`rounded-lg border px-2.5 py-1 text-xs capitalize ${
                    mode === m
                      ? 'border-transparent bg-ink text-paper'
                      : 'border-line-strong text-[var(--mute)] hover:text-ink'
                  }`}
                >
                  {m}
                </button>
              ))}
              <button
                type='button'
                onClick={copyMd}
                className='rounded-lg border border-line-strong px-2.5 py-1 text-xs hover:border-accent'
              >
                {copied ? 'Tersalin' : 'Salin'}
              </button>
              <button
                type='button'
                onClick={exportMd}
                className='rounded-lg border border-line-strong px-2.5 py-1 text-xs hover:border-accent'
              >
                .md
              </button>
            </div>
          </div>

          <div
            className={`grid gap-4 ${
              mode === 'split' ? 'md:grid-cols-2' : 'grid-cols-1'
            }`}
          >
            {mode !== 'preview' && (
              <textarea
                rows={16}
                value={active.body}
                onChange={(e) => updateActive({ body: e.target.value })}
                placeholder='Tulis Markdown di sini...'
                className='w-full rounded-xl border border-line-strong bg-paper p-3 font-mono text-xs leading-relaxed text-ink focus:border-accent focus:outline-none'
              />
            )}
            {mode !== 'edit' && (
              <div className='min-h-[300px] rounded-xl border border-line bg-paper p-4'>
                <Markdown>{active.body || '*Kosong*'}</Markdown>
              </div>
            )}
          </div>
        </div>
      </div>
    </ToolShell>
  );
}
