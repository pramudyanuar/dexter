import { RESUMABLE_CHUNK_BYTES } from '@/features/transfer/config';

export type TransferDriver = 'supabase' | 'local';

interface UploadTicket {
  signedUrl: string;
  resumableUrl: string;
  token: string;
  bucket: string;
  objectKey: string;
}

async function errorFrom(res: { status: number; text(): Promise<string> }) {
  try {
    const data = JSON.parse(await res.text());
    if (typeof data?.message === 'string') return data.message;
    if (typeof data?.error === 'string') return data.error;
  } catch {
    // The error may be an HTML response.
  }
  return `HTTP ${res.status}`;
}

function putFile(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
  cloud: boolean,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    if (cloud) xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = async () =>
      xhr.status >= 200 && xhr.status < 300
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

/** Sends a file to storage and reports progress as 0-100. */
export async function uploadFile(
  file: File,
  pathname: string,
  driver: TransferDriver,
  onProgress: (percent: number) => void,
): Promise<void> {
  if (driver === 'local') {
    return putFile(
      `/api/transfer/local-upload?pathname=${encodeURIComponent(pathname)}`,
      file,
      onProgress,
      false,
    );
  }

  const response = await fetch('/api/transfer/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pathname, size: file.size }),
  });
  if (!response.ok) throw new Error(await errorFrom(response));
  const ticket = (await response.json()) as UploadTicket;

  if (file.size <= RESUMABLE_CHUNK_BYTES)
    return putFile(ticket.signedUrl, file, onProgress, true);

  const { Upload } = await import('tus-js-client');
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: ticket.resumableUrl,
      headers: {
        'x-signature': ticket.token,
        ...(publishableKey && { apikey: publishableKey }),
      },
      metadata: {
        bucketName: ticket.bucket,
        objectName: ticket.objectKey,
        contentType: 'application/octet-stream',
      },
      chunkSize: RESUMABLE_CHUNK_BYTES,
      retryDelays: [0, 1000, 3000, 5000, 10000],
      storeFingerprintForResuming: false,
      onProgress: (uploaded, total) =>
        onProgress(Math.round((uploaded / total) * 100)),
      onSuccess: () => resolve(),
      onError: reject,
    });
    upload.start();
  });
}
