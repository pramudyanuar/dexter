'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';

interface ConfirmDialogProps {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as destructive. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Modal replacement for window.confirm. Render it only while it is open. */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'ya',
  cancelLabel = 'batal',
  danger,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const confirmRef = React.useRef<HTMLButtonElement>(null);
  const titleId = React.useId();

  // focus the safe choice, and hand focus back to where it was on close
  React.useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onCancel();
    }
    // keep Tab inside the dialog: it only has two buttons
    if (e.key === 'Tab') {
      e.preventDefault();
      const next =
        document.activeElement === cancelRef.current ? confirmRef : cancelRef;
      next.current?.focus();
    }
  };

  return createPortal(
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-paper/80 px-4 font-mono text-[13.5px]'
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        role='alertdialog'
        aria-modal='true'
        aria-labelledby={titleId}
        className='w-full max-w-sm rounded-sm border border-line bg-card p-4 text-ink shadow-lg'
      >
        <p id={titleId} className='font-semibold'>
          <span className='text-accent select-none'>$ </span>
          {title}
        </p>
        <div className='mt-2 leading-6 wrap-break-word text-mute'>
          {message}
        </div>
        <div className='mt-4 flex justify-end gap-4 text-xs'>
          <button
            ref={cancelRef}
            type='button'
            onClick={onCancel}
            className='text-mute hover:text-ink focus-visible:text-ink focus-visible:underline'
          >
            [{cancelLabel}]
          </button>
          <button
            ref={confirmRef}
            type='button'
            onClick={onConfirm}
            className={`${danger ? 'text-err' : 'text-accent'} hover:underline focus-visible:underline`}
          >
            [{confirmLabel}]
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
