export interface AppEntry {
  /** Shown as the directory name, e.g. `ai/` */
  id: string;
  /** Internal route (/chat) or full URL for an external app */
  href: string;
  description: string;
  tags?: string[];
}

/**
 * Apps listed on the home page. To add one, build it under src/app/<name>/
 * (wrap the page in <AuthGate> to keep it behind the OTP login) and add an
 * entry here.
 */
export const APPS: readonly AppEntry[] = [
  {
    id: 'ai',
    href: '/chat',
    description:
      'Chat AI gratis. Baca gambar dan file, riwayat tersimpan, edit prompt dan bandingkan versi.',
    tags: ['groq', 'openrouter'],
  },
  {
    id: 'web',
    href: '/browse',
    description:
      'Buka situs lewat server ini. Cocok untuk artikel dan dokumentasi; JavaScript dimatikan.',
    tags: ['proxy'],
  },
  {
    id: 'games',
    href: '/games',
    description:
      'Wordle, ular, 2048, minesweeper, tetris, serta connect4, suit, dan uno online. Terbuka tanpa login.',
    tags: ['publik'],
  },
  {
    id: 'send',
    href: '/send',
    description:
      'Kirim file antar device: unggah di satu device, unduh di device lain. File hilang otomatis setelah 24 jam.',
    tags: ['vercel blob'],
  },
];
