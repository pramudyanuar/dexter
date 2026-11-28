/**
 * A chat is a tree of messages. Editing a prompt or regenerating a reply adds
 * a sibling instead of overwriting, and `selected` remembers which child is
 * shown under each parent. The visible conversation is the path from the root
 * following the selected children.
 */

export interface Usage {
  prompt: number;
  completion: number;
  total: number;
}

export interface ChatNode {
  id: string;
  parent: string | null;
  role: 'user' | 'assistant';
  /** What is sent to the model (includes text files inlined as code blocks) */
  content: string;
  /** What the user typed, shown instead of `content` when set */
  shown?: string;
  /** Text files already inlined in `content`, kept so an edit can reuse them */
  fileBlocks?: string[];
  /** Names of attached files, for display */
  attachments?: string[];
  usage?: Usage;
  /** Label of the model that wrote this reply */
  model?: string;
}

export interface Chat {
  id: string;
  title: string;
  updated: number;
  nodes: Record<string, ChatNode>;
  /** parent id (or 'root') -> id of the selected child */
  selected: Record<string, string>;
}

const ROOT = 'root';
const key = (parent: string | null) => parent ?? ROOT;

// prefixed so ids are never integer-like (those would reorder object keys)
export const newId = () =>
  `n${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36)}`;

export function emptyChat(): Chat {
  return {
    id: newId(),
    title: '',
    updated: Date.now(),
    nodes: {},
    selected: {},
  };
}

export function titleFrom(text: string) {
  const line = text.trim().split('\n')[0];
  return line.length > 48 ? `${line.slice(0, 47)}…` : line || 'chat baru';
}

/** Children of every parent, in creation order. */
export function childrenMap(chat: Chat) {
  const map = new Map<string, ChatNode[]>();
  for (const node of Object.values(chat.nodes)) {
    const k = key(node.parent);
    map.set(k, [...(map.get(k) ?? []), node]);
  }
  return map;
}

/** Siblings (including `node`) from a precomputed `childrenMap`. */
export function siblingsIn(
  map: Map<string, ChatNode[]>,
  node: ChatNode,
): ChatNode[] {
  return map.get(key(node.parent)) ?? [];
}

export function siblingsOf(chat: Chat, node: ChatNode): ChatNode[] {
  return siblingsIn(childrenMap(chat), node);
}

/** The visible conversation, root first. */
export function activePath(chat: Chat): ChatNode[] {
  const children = childrenMap(chat);
  const path: ChatNode[] = [];
  let parent: string | null = null;
  for (;;) {
    const kids = children.get(key(parent));
    if (!kids?.length) return path;
    const next: ChatNode =
      kids.find((k) => k.id === chat.selected[key(parent)]) ??
      kids[kids.length - 1];
    path.push(next);
    parent = next.id;
  }
}

/** Ancestors of `id` followed by the node itself, root first. */
export function pathTo(chat: Chat, id: string): ChatNode[] {
  const path: ChatNode[] = [];
  for (let n: ChatNode | undefined = chat.nodes[id]; n;) {
    path.unshift(n);
    n = n.parent ? chat.nodes[n.parent] : undefined;
  }
  return path;
}

/** Adds a node and makes it the selected child of its parent. */
export function addNode(chat: Chat, node: ChatNode): Chat {
  return {
    ...chat,
    updated: Date.now(),
    nodes: { ...chat.nodes, [node.id]: node },
    selected: { ...chat.selected, [key(node.parent)]: node.id },
  };
}

/** Shows `id` (a sibling) instead of the currently selected one. */
export function selectNode(chat: Chat, id: string): Chat {
  const node = chat.nodes[id];
  if (!node) return chat;
  return { ...chat, selected: { ...chat.selected, [key(node.parent)]: id } };
}
