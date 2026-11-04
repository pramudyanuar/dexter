import { MAX_IMAGE_DIMENSION, MAX_TEXT_FILE_BYTES } from '@/constant/chat';

export type Attachment =
  | { id: string; kind: 'image'; name: string; dataUrl: string }
  | { id: string; kind: 'text'; name: string; text: string };

/** Downscale and re-encode so the request stays well under Vercel's 4.5 MB. */
async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height),
  );
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas tidak tersedia');
  ctx.fillStyle = '#fff'; // JPEG has no transparency
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return canvas.toDataURL('image/jpeg', 0.82);
}

/** Throws an Error with a user-facing message when the file is unsupported. */
export async function readAttachment(file: File): Promise<Attachment> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (file.type.startsWith('image/')) {
    try {
      return {
        id,
        kind: 'image',
        name: file.name,
        dataUrl: await compressImage(file),
      };
    } catch {
      throw new Error(`${file.name}: gambar tidak bisa dibaca`);
    }
  }

  if (file.size > MAX_TEXT_FILE_BYTES) {
    throw new Error(
      `${file.name}: terlalu besar (maks ${MAX_TEXT_FILE_BYTES / 1000} KB)`,
    );
  }
  const text = await file.text();
  if (text.includes('\u0000')) {
    throw new Error(`${file.name}: hanya gambar dan file teks yang didukung`);
  }
  return { id, kind: 'text', name: file.name, text };
}

/** Text file as a fenced block, with a fence longer than any inside it. */
export function formatTextFile(name: string, text: string) {
  let fence = '```';
  while (text.includes(fence)) fence += '`';
  const lang = name.includes('.') ? name.split('.').pop() : '';
  return `${name}:\n${fence}${lang}\n${text.replace(/\n$/, '')}\n${fence}`;
}
