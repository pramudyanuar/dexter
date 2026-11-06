/** Files are removed this long after they were uploaded. */
export const TRANSFER_TTL_MS = 24 * 60 * 60 * 1000;
export const TRANSFER_TTL_HOURS = TRANSFER_TTL_MS / 3_600_000;

export const MAX_FILE_BYTES = 200 * 1024 * 1024;
/** Kept under the free Vercel Blob storage allowance (1 GB). */
export const QUOTA_BYTES = 900 * 1024 * 1024;
/** Larger files are uploaded in parallel parts, with retries. */
export const MULTIPART_THRESHOLD = 20 * 1024 * 1024;
