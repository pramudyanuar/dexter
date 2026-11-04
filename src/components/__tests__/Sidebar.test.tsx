import { fireEvent, render, screen } from '@testing-library/react';

import { addNode, emptyChat } from '@/lib/chatTree';

import Sidebar from '@/components/Sidebar';

const chat = {
  ...addNode(emptyChat(), {
    id: 'n1',
    parent: null,
    role: 'user',
    content: 'hello',
  }),
  title: 'hello',
};

function setup() {
  const onDelete = jest.fn();
  const confirm = jest.spyOn(window, 'confirm');
  render(
    <Sidebar
      chats={[chat]}
      currentId={null}
      open={false}
      disabled={false}
      onSelect={jest.fn()}
      onNew={jest.fn()}
      onDelete={onDelete}
      onClose={jest.fn()}
    />,
  );
  return { onDelete, confirm };
}

describe('Sidebar delete', () => {
  it('asks in a modal, never with window.confirm, and deletes on confirm', () => {
    const { onDelete, confirm } = setup();

    fireEvent.click(screen.getByRole('button', { name: /Hapus hello/ }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /\[hapus\]/ }));
    expect(onDelete).toHaveBeenCalledWith(chat.id);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('does nothing when cancelled', () => {
    const { onDelete } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Hapus hello/ }));
    fireEvent.click(screen.getByRole('button', { name: /\[batal\]/ }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
