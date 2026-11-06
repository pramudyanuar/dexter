import { formatBytes, formatDuration } from '@/lib/transfer/format';

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [1023, '1023 B'],
    [1024, '1.0 KB'],
    [1536, '1.5 KB'],
    [10 * 1024, '10 KB'],
    [5 * 1024 * 1024, '5.0 MB'],
    [200 * 1024 * 1024, '200 MB'],
    [900 * 1024 * 1024, '900 MB'],
    [3 * 1024 ** 3, '3.0 GB'],
  ])('%d -> %s', (bytes, text) => {
    expect(formatBytes(bytes)).toBe(text);
  });
});

describe('formatDuration', () => {
  it.each([
    [0, '<1m'],
    [59_000, '<1m'],
    [60_000, '1m'],
    [45 * 60_000, '45m'],
    [60 * 60_000, '1j'],
    [(5 * 60 + 30) * 60_000, '5j 30m'],
    [(23 * 60 + 59) * 60_000, '23j'],
  ])('%d ms -> %s', (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });
});
