/** Files are removed this long after they were uploaded. */
export const TRANSFER_TTL_MS = 24 * 60 * 60 * 1000;
export const TRANSFER_TTL_HOURS = TRANSFER_TTL_MS / 3_600_000;

export const MAX_FILE_BYTES = 200 * 1024 * 1024;
export const SUPABASE_DEFAULT_MAX_FILE_BYTES = 50_000_000;
/** Kept under the free Supabase Storage allowance (1 GB). */
export const QUOTA_BYTES = 900 * 1024 * 1024;
export const RESUMABLE_CHUNK_BYTES = 6 * 1024 * 1024;
