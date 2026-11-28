/**
 * Turns what was typed in the address bar into a URL: a full URL is kept, a
 * bare domain gets https://, and anything else becomes a search.
 */
export function toTarget(
  input: string,
  searchUrl: (query: string) => string,
): string | null {
  const value = input.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (!/\s/.test(value) && /^[\w-]+(\.[\w-]+)+(:\d+)?([/?#].*)?$/.test(value)) {
    return `https://${value}`;
  }
  return searchUrl(value);
}
