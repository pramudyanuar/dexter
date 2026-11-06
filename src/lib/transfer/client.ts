import { upload } from '@vercel/blob/client';

import { MULTIPART_THRESHOLD } from '@/constant/transfer';

export type TransferDriver = 'blob' | 'local';

async function errorFrom(res: { status: number; text(): Promise<string> }) {
  try {
    const data = JSON.parse(await res.text());
    if (typeof data?.error === 'string') return data.error;
  } catch {
    // not JSON
  }
  return `HTTP ${res.status}`;
}

/** Sends a file to storage and reports progress as 0-100. */
export async function uploadFile(
  file: File,
  pathname: string,
  driver: TransferDriver,
  onProgress: (percent: number) => void,
): Promise<void> {
  if (driver === 'blob') {
    // straight to Vercel Blob; the server only issues the token
    await upload(pathname, file, {
      access: 'private',
      handleUploadUrl: '/api/transfer/upload',
      clientPayload: JSON.stringify({ size: file.size }),
      multipart: file.size > MULTIPART_THRESHOLD,
      onUploadProgress: (e) => onProgress(Math.round(e.percentage)),
    });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      'PUT',
      `/api/transfer/local-upload?pathname=${encodeURIComponent(pathname)}`,
    );
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = async () =>
      xhr.status < 300
        ? resolve()
        : reject(
            new Error(
              await errorFrom({
                status: xhr.status,
                text: async () => xhr.responseText,
              }),
            ),
          );
    xhr.onerror = () => reject(new Error('Koneksi terputus'));
    xhr.send(file);
  });
}
