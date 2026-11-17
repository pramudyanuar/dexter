export interface ToolEntry {
  id: string;
  title: string;
  href: string;
  description: string;
  category: 'sharing' | 'utility';
  badge?: string;
  requiresAuth?: boolean;
}

export const TOOLS: readonly ToolEntry[] = [
  {
    id: 'paste',
    title: 'Copy-Paste Bersama',
    href: '/paste',
    description:
      'Papan teks sementara antar device dengan kode ruang 6 angka. Sinkron otomatis tanpa login.',
    category: 'sharing',
    badge: '6-digit room',
  },
  {
    id: 'qr',
    title: 'QR Code Generator',
    href: '/tools/qr',
    description:
      'Ubah teks, URL, atau Wi-Fi menjadi QR code. Atur warna dan unduh sebagai PNG atau SVG.',
    category: 'utility',
  },
  {
    id: 'split-bill',
    title: 'Split Bill / Patungan',
    href: '/tools/split-bill',
    description:
      'Hitung patungan bagi rata atau per-item lengkap dengan pajak & servis, lalu salin ringkasannya.',
    category: 'utility',
  },
  {
    id: 'pomodoro',
    title: 'Pomodoro Timer',
    href: '/tools/pomodoro',
    description:
      'Timer fokus 25/5/15 menit dengan notifikasi suara dan penghitung sesi harian.',
    category: 'utility',
  },
  {
    id: 'password',
    title: 'Password Generator',
    href: '/tools/password',
    description:
      'Buat password acak yang kuat atau passphrase menggunakan generator kriptografi browser.',
    category: 'utility',
  },
  {
    id: 'diff',
    title: 'Diff Checker',
    href: '/tools/diff',
    description:
      'Bandingkan dua teks atau potongan kode baris demi baris untuk melihat bagian yang berubah.',
    category: 'utility',
  },
  {
    id: 'text',
    title: 'Word Counter & Case',
    href: '/tools/text',
    description:
      'Hitung kata, karakter, waktu baca, ubah format huruf, dan bersihkan baris duplikat.',
    category: 'utility',
  },
  {
    id: 'convert',
    title: 'Konverter Unit & Jam',
    href: '/tools/convert',
    description:
      'Konversi satuan panjang, berat, suhu, ukuran data, serta perbandingan zona waktu.',
    category: 'utility',
  },
  {
    id: 'regex',
    title: 'Regex Tester',
    href: '/tools/regex',
    description:
      'Uji pola ekspresi reguler secara langsung dengan highlight hasil cocok dan daftar capture group.',
    category: 'utility',
  },
  {
    id: 'jwt',
    title: 'JWT Decoder',
    href: '/tools/jwt',
    description:
      'Baca header, payload, dan status kedaluwarsa token JWT secara lokal tanpa mengirim ke server.',
    category: 'utility',
  },
  {
    id: 'color',
    title: 'Color & Contrast',
    href: '/tools/color',
    description:
      'Konversi warna HEX, RGB, HSL, lihat palet variasi, dan cek rasio kontras teks WCAG AA/AAA.',
    category: 'utility',
  },
  {
    id: 'timer',
    title: 'Stopwatch & Timer',
    href: '/tools/timer',
    description:
      'Stopwatch dengan pencatat putaran (lap) serta hitung mundur custom dengan alarm suara.',
    category: 'utility',
  },
  {
    id: 'dev',
    title: 'JSON, Base64 & Hash',
    href: '/tools/dev',
    description:
      'Format/minify JSON, encode/decode Base64 UTF-8, buat UUID v4, dan hitung hash SHA-256.',
    category: 'utility',
  },
  {
    id: 'image',
    title: 'Kompres & Ubah Gambar',
    href: '/tools/image',
    description:
      'Kompres ukuran, ubah dimensi, dan konversi PNG/JPG/WebP langsung di browser tanpa upload.',
    category: 'utility',
  },
  {
    id: 'pdf',
    title: 'Gambar → PDF',
    href: '/tools/pdf',
    description:
      'Gabungkan beberapa gambar atau screenshot (bisa langsung Ctrl+V) menjadi satu file PDF tanpa upload.',
    category: 'utility',
  },
  {
    id: 'notes',
    title: 'Markdown Scratchpad',
    href: '/tools/notes',
    description:
      'Catatan cepat lokal di browser dengan preview Markdown, daftar multi-catatan, dan ekspor .md.',
    category: 'utility',
  },
  {
    id: 'send',
    title: 'Kirim File',
    href: '/send',
    description:
      'Kirim file antar device lewat server. File otomatis terhapus setelah 24 jam.',
    category: 'sharing',
    badge: 'OTP',
    requiresAuth: true,
  },
  {
    id: 'web',
    title: 'Web Proxy',
    href: '/browse',
    description:
      'Buka situs artikel atau dokumentasi lewat server ini dengan JavaScript dimatikan.',
    category: 'utility',
    badge: 'OTP',
    requiresAuth: true,
  },
];
