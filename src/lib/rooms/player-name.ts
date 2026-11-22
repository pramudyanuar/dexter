export const NAME_MAX = 16;

/** A display name stripped of control characters and limited to NAME_MAX characters. */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = Array.from(
    raw
      .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e]/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
  )
    .slice(0, NAME_MAX)
    .join('')
    .trim();
  return name || null;
}
