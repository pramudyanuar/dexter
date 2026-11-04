import {
  activePath,
  addNode,
  Chat,
  ChatNode,
  emptyChat,
  pathTo,
  selectNode,
  siblingsOf,
} from '@/lib/chatTree';

const node = (
  id: string,
  parent: string | null,
  role: ChatNode['role'],
  content = id,
): ChatNode => ({ id, parent, role, content });

function build(...nodes: ChatNode[]): Chat {
  return nodes.reduce(addNode, emptyChat());
}

const ids = (c: Chat) => activePath(c).map((n) => n.id);

describe('chatTree', () => {
  const base = build(
    node('u1', null, 'user'),
    node('a1', 'u1', 'assistant'),
    node('u2', 'a1', 'user'),
    node('a2', 'u2', 'assistant'),
  );

  it('walks the selected path', () => {
    expect(ids(base)).toEqual(['u1', 'a1', 'u2', 'a2']);
  });

  it('editing a prompt branches and replaces what follows it', () => {
    const edited = addNode(base, node('u2b', 'a1', 'user', 'edited'));
    expect(ids(edited)).toEqual(['u1', 'a1', 'u2b']);
    expect(siblingsOf(edited, edited.nodes.u2b).map((n) => n.id)).toEqual([
      'u2',
      'u2b',
    ]);
  });

  it('switching back to the old version restores its replies', () => {
    const edited = addNode(base, node('u2b', 'a1', 'user'));
    expect(ids(selectNode(edited, 'u2'))).toEqual(['u1', 'a1', 'u2', 'a2']);
  });

  it('keeps each branch independent', () => {
    let chat = addNode(base, node('u2b', 'a1', 'user'));
    chat = addNode(chat, node('a2b', 'u2b', 'assistant'));
    expect(ids(chat)).toEqual(['u1', 'a1', 'u2b', 'a2b']);
    expect(ids(selectNode(chat, 'u2'))).toEqual(['u1', 'a1', 'u2', 'a2']);
    expect(ids(selectNode(chat, 'u2b'))).toEqual(['u1', 'a1', 'u2b', 'a2b']);
  });

  it('regenerating a reply adds an assistant sibling', () => {
    const regen = addNode(base, node('a2b', 'u2', 'assistant'));
    expect(ids(regen)).toEqual(['u1', 'a1', 'u2', 'a2b']);
    expect(ids(selectNode(regen, 'a2'))).toEqual(['u1', 'a1', 'u2', 'a2']);
  });

  it('pathTo returns the ancestors of any node', () => {
    expect(pathTo(base, 'u2').map((n) => n.id)).toEqual(['u1', 'a1', 'u2']);
  });
});
