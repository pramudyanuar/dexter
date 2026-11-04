'use client';

import * as React from 'react';

import { Chat } from '@/lib/chatTree';

import ConfirmDialog from '@/components/ConfirmDialog';

interface SidebarProps {
  chats: Chat[];
  currentId: string | null;
  open: boolean;
  disabled: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function Sidebar({
  chats,
  currentId,
  open,
  disabled,
  onSelect,
  onNew,
  onDelete,
  onClose,
}: SidebarProps) {
  const sorted = [...chats].sort((a, b) => b.updated - a.updated);
  const [pendingDelete, setPendingDelete] = React.useState<Chat | null>(null);

  return (
    <>
      {open && (
        <button
          type='button'
          aria-label='Tutup daftar chat'
          onClick={onClose}
          className='fixed inset-0 z-10 bg-paper/70 md:hidden'
        />
      )}
      <aside
        className={`z-20 w-64 shrink-0 flex-col border-r border-line bg-paper md:static md:flex md:w-60 ${
          open ? 'fixed inset-y-0 left-0 flex' : 'hidden'
        }`}
      >
        <div className='flex items-center justify-between border-b border-line px-4 py-2.5 text-xs'>
          <span className='text-mute'>git log --chats</span>
          <button
            type='button'
            onClick={() => {
              onNew();
              onClose();
            }}
            disabled={disabled}
            className='text-accent hover:underline disabled:opacity-30'
          >
            :new
          </button>
        </div>

        <ul className='flex-1 overflow-y-auto py-1'>
          {sorted.length === 0 && (
            <li className='px-4 py-2 text-xs text-mute'>belum ada chat</li>
          )}
          {sorted.map((chat) => (
            <li key={chat.id} className='group flex items-center'>
              <button
                type='button'
                disabled={disabled}
                onClick={() => {
                  onSelect(chat.id);
                  onClose();
                }}
                className={`min-w-0 flex-1 truncate px-4 py-1.5 text-left text-xs transition disabled:opacity-50 ${
                  chat.id === currentId
                    ? 'border-l-2 border-accent pl-[14px] text-ink'
                    : 'text-mute hover:text-ink'
                }`}
                title={chat.title}
              >
                {chat.title}
              </button>
              <button
                type='button'
                disabled={disabled}
                aria-label={`Hapus ${chat.title}`}
                onClick={() => setPendingDelete(chat)}
                className='px-3 text-xs text-mute hover:text-err focus:opacity-100 md:opacity-0 md:group-hover:opacity-100'
              >
                x
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {pendingDelete && (
        <ConfirmDialog
          danger
          title='hapus chat?'
          message={
            <>
              <span className='text-ink'>{pendingDelete.title}</span>
              <br />
              Semua versi dan cabang di chat ini ikut terhapus. Tidak bisa
              dibatalkan.
            </>
          }
          confirmLabel='hapus'
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            onDelete(pendingDelete.id);
            setPendingDelete(null);
          }}
        />
      )}
    </>
  );
}
