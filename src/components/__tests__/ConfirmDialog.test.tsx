import { fireEvent, render, screen } from '@testing-library/react';

import ConfirmDialog from '@/components/ConfirmDialog';

function setup() {
  const onConfirm = jest.fn();
  const onCancel = jest.fn();
  render(
    <ConfirmDialog
      title='hapus chat?'
      message='tidak bisa dibatalkan'
      confirmLabel='hapus'
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  return { onConfirm, onCancel };
}

describe('ConfirmDialog', () => {
  it('focuses the cancel button first', () => {
    setup();
    expect(screen.getByRole('button', { name: /batal/ })).toHaveFocus();
  });

  it('confirms and cancels via buttons', () => {
    const { onConfirm, onCancel } = setup();
    fireEvent.click(screen.getByRole('button', { name: /hapus/ }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /batal/ }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('cancels on Escape and on backdrop click, not on dialog click', () => {
    const { onCancel } = setup();
    fireEvent.mouseDown(screen.getByRole('alertdialog'));
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.mouseDown(screen.getByRole('alertdialog').parentElement!);
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('keeps Tab focus inside the dialog', () => {
    setup();
    const dialog = screen.getByRole('alertdialog');
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(screen.getByRole('button', { name: /hapus/ })).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(screen.getByRole('button', { name: /batal/ })).toHaveFocus();
  });
});
