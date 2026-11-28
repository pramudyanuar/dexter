import 'server-only';

import { TRANSFER_TTL_MS } from '@/features/transfer/config';
import { parsePathname } from '@/features/transfer/naming';
import { getSupabaseAdmin } from '@/integrations/supabase/admin';

const bucketName = 'dexter-transfer';
const objectKey = (pathname: string) =>
  Buffer.from(pathname).toString('base64url');

function bucket() {
  const client = getSupabaseAdmin();
  if (!client) throw new Error('Supabase Storage is not configured');
  return client.storage.from(bucketName);
}

export async function listSupabaseFiles() {
  const storage = bucket();
  const files: {
    id: string;
    name: string;
    size: number;
    uploadedAt: number;
  }[] = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const { data, error } = await storage.list('', {
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw error;
    for (const item of data) {
      const id = Buffer.from(item.name, 'base64url').toString('utf8');
      const parsed = parsePathname(id);
      const size = item.metadata?.size;
      const uploadedAt = Date.parse(item.created_at ?? '');
      if (
        !item.id ||
        !parsed ||
        objectKey(id) !== item.name ||
        typeof size !== 'number' ||
        !Number.isFinite(uploadedAt)
      )
        continue;
      files.push({ id, name: parsed.name, size, uploadedAt });
    }
    if (data.length < limit) return files;
  }
}

export async function removeSupabaseFiles(pathnames: string[]) {
  if (!pathnames.length) return;
  const storage = bucket();
  for (let offset = 0; offset < pathnames.length; offset += 100) {
    const { error } = await storage.remove(
      pathnames.slice(offset, offset + 100).map(objectKey),
    );
    if (error) throw error;
  }
}

export async function openSupabaseFile(pathname: string) {
  const storage = bucket();
  const key = objectKey(pathname);
  const { data, error } = await storage.info(key);
  if (error) {
    if (
      'status' in error &&
      [404, '404'].includes(error.status as number | string)
    )
      return null;
    throw error;
  }
  if (Date.now() - Date.parse(data.createdAt) >= TRANSFER_TTL_MS) return null;
  const signed = await storage.createSignedUrl(key, 60);
  if (signed.error) throw signed.error;
  const response = await fetch(signed.data.signedUrl, {
    cache: 'no-store',
    signal: AbortSignal.timeout(55_000),
  });
  if (response.status === 404) return null;
  if (!response.ok || !response.body)
    throw new Error('Supabase download failed');

  const length = response.headers.get('content-length');
  const size = data.size ?? (length === null ? undefined : Number(length));
  if (size === undefined || !Number.isFinite(size))
    throw new Error('Supabase download size is unavailable');
  return {
    stream: response.body,
    size,
    contentType: 'application/octet-stream',
  };
}

export async function signSupabaseUpload(pathname: string) {
  const key = objectKey(pathname);
  const { data, error } = await bucket().createSignedUploadUrl(key, {
    upsert: false,
  });
  if (error) throw error;

  const resumable = new URL(
    '/storage/v1/upload/resumable/sign',
    data.signedUrl,
  );
  if (/^[a-z0-9]+\.supabase\.co$/.test(resumable.hostname)) {
    resumable.hostname = resumable.hostname.replace(
      '.supabase.co',
      '.storage.supabase.co',
    );
  }
  return {
    signedUrl: data.signedUrl,
    resumableUrl: resumable.toString(),
    token: data.token,
    bucket: bucketName,
    objectKey: key,
  };
}
