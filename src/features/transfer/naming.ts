/**
 * Files live at `transfer/<id>/<name>`. The id keeps equal names apart, and the
 * pathname doubles as the file's identifier everywhere (API, storage).
 */
export const FILE_PREFIX = 'transfer/';

const FORBIDDEN = /[\\/:*?"<>|\u0000-\u001f]/g;
const PATHNAME = /^transfer\/([a-z0-9]{8,32})\/([^/\\\u0000-\u001f]{1,200})$/;
const MAX_NAME = 150;

export function sanitizeName(raw: string): string {
  let name = raw.replace(FORBIDDEN, '_').trim();
  if (!name || name === '.' || name === '..') return 'file';

  if (name.length > MAX_NAME) {
    // cut the middle, not the extension
    const dot = name.lastIndexOf('.');
    const ext = dot > 0 && name.length - dot <= 20 ? name.slice(dot) : '';
    name = name.slice(0, MAX_NAME - ext.length) + ext;
  }
  return name;
}

export function newFileId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('');
}

export function buildPathname(id: string, name: string) {
  return `${FILE_PREFIX}${id}/${name}`;
}

/** Returns null for anything that is not a pathname we would have made. */
export function parsePathname(
  pathname: string,
): { id: string; name: string } | null {
  const match = PATHNAME.exec(pathname);
  if (!match || match[2] === '.' || match[2] === '..') return null;
  return { id: match[1], name: match[2] };
}
