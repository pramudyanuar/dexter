export interface CheatItem {
  cmd: string;
  desc: string;
}

export interface CheatSection {
  id: string;
  title: string;
  intro: string;
  items: CheatItem[];
}

export const CHEATSHEET: readonly CheatSection[] = [
  {
    id: 'git',
    title: 'Git',
    intro: 'Perintah harian untuk riwayat, cabang, dan merapikan commit.',
    items: [
      { cmd: 'git status -sb', desc: 'Status ringkas beserta nama branch' },
      {
        cmd: 'git switch -c <branch>',
        desc: 'Buat branch baru dan pindah ke sana',
      },
      {
        cmd: 'git add -p',
        desc: 'Pilih potongan perubahan yang mau di-stage satu per satu',
      },
      {
        cmd: 'git commit --amend --no-edit',
        desc: 'Gabungkan perubahan yang sudah di-stage ke commit terakhir',
      },
      {
        cmd: 'git log --oneline --graph --decorate -20',
        desc: '20 commit terakhir sebagai grafik ringkas',
      },
      {
        cmd: 'git stash push -m "pesan"',
        desc: 'Simpan perubahan sementara; kembalikan dengan git stash pop',
      },
      {
        cmd: 'git rebase -i HEAD~3',
        desc: 'Edit, gabung, atau urutkan ulang 3 commit terakhir',
      },
      {
        cmd: 'git restore --staged <file>',
        desc: 'Batalkan stage sebuah file tanpa menghapus perubahannya',
      },
      {
        cmd: 'git restore <file>',
        desc: 'Buang perubahan di working tree (tidak bisa dibatalkan)',
      },
      {
        cmd: 'git reset --soft HEAD~1',
        desc: 'Batalkan commit terakhir, perubahan tetap ter-stage',
      },
      {
        cmd: 'git fetch --prune',
        desc: 'Perbarui remote dan hapus referensi branch yang sudah dihapus',
      },
      {
        cmd: 'git cherry-pick <sha>',
        desc: 'Salin satu commit ke branch saat ini',
      },
      {
        cmd: 'git diff --stat main...HEAD',
        desc: 'Ringkasan file yang berubah sejak branch ini keluar dari main',
      },
      {
        cmd: 'git reflog',
        desc: 'Riwayat posisi HEAD, berguna untuk menemukan commit yang "hilang"',
      },
    ],
  },
  {
    id: 'nextjs',
    title: 'Next.js',
    intro: 'CLI dan konvensi file di App Router.',
    items: [
      { cmd: 'npx create-next-app@latest', desc: 'Buat proyek Next.js baru' },
      {
        cmd: 'next dev',
        desc: 'Jalankan server pengembangan (default port 3000)',
      },
      { cmd: 'next build && next start', desc: 'Build produksi lalu jalankan' },
      { cmd: 'app/page.tsx', desc: 'UI untuk sebuah rute' },
      {
        cmd: 'app/layout.tsx',
        desc: 'Layout yang dibagi oleh rute di bawahnya',
      },
      {
        cmd: 'app/loading.tsx',
        desc: 'UI loading otomatis (batas Suspense) untuk sebuah segmen',
      },
      {
        cmd: 'app/error.tsx',
        desc: 'Error boundary segmen; harus client component',
      },
      { cmd: 'app/not-found.tsx', desc: 'Halaman 404 untuk segmen tersebut' },
      {
        cmd: 'app/api/<nama>/route.ts',
        desc: 'Route Handler: ekspor fungsi GET, POST, dan seterusnya',
      },
      {
        cmd: "'use client'",
        desc: 'Tandai file sebagai client component (state, effect, event handler)',
      },
      {
        cmd: 'export const metadata = { title: "..." }',
        desc: 'Atur title dan meta tag dari server component',
      },
      {
        cmd: 'NEXT_PUBLIC_*',
        desc: 'Awalan env var yang ikut dikirim ke browser; lainnya hanya di server',
      },
    ],
  },
  {
    id: 'vercel',
    title: 'Vercel CLI',
    intro: 'Deploy dan kelola proyek dari terminal.',
    items: [
      { cmd: 'npm i -g vercel', desc: 'Pasang CLI' },
      { cmd: 'vercel login', desc: 'Masuk ke akun' },
      { cmd: 'vercel link', desc: 'Hubungkan folder ini dengan sebuah proyek' },
      {
        cmd: 'vercel dev',
        desc: 'Jalankan lokal dengan environment seperti di Vercel',
      },
      { cmd: 'vercel', desc: 'Deploy preview' },
      { cmd: 'vercel --prod', desc: 'Deploy ke produksi' },
      {
        cmd: 'vercel env pull .env.local',
        desc: 'Unduh env var proyek ke file lokal',
      },
      {
        cmd: 'vercel env add <NAMA>',
        desc: 'Tambah env var (akan menanyakan nilai dan environment)',
      },
      {
        cmd: 'vercel logs <url-deployment>',
        desc: 'Lihat log runtime sebuah deployment',
      },
      { cmd: 'vercel ls', desc: 'Daftar deployment proyek' },
      {
        cmd: 'vercel rollback',
        desc: 'Kembalikan produksi ke deployment sebelumnya',
      },
    ],
  },
  {
    id: 'shell',
    title: 'Shell',
    intro: 'Linux dan macOS: mencari, memeriksa, dan membersihkan.',
    items: [
      {
        cmd: 'ls -lah',
        desc: 'Daftar file lengkap dengan ukuran yang mudah dibaca',
      },
      { cmd: 'cd -', desc: 'Kembali ke direktori sebelumnya' },
      {
        cmd: 'grep -rn "teks" .',
        desc: 'Cari teks di semua file, tampilkan nomor baris',
      },
      {
        cmd: 'find . -name "*.ts" -not -path "./node_modules/*"',
        desc: 'Cari file berdasarkan nama, abaikan node_modules',
      },
      {
        cmd: 'du -sh * | sort -h',
        desc: 'Ukuran tiap item di folder ini, dari terkecil',
      },
      {
        cmd: 'tail -f <file>',
        desc: 'Ikuti isi file yang terus bertambah (log)',
      },
      {
        cmd: 'ss -ltnp',
        desc: 'Port TCP yang sedang listen beserta prosesnya',
      },
      { cmd: 'lsof -i :3000', desc: 'Proses yang memakai port 3000' },
      { cmd: 'curl -I <url>', desc: 'Lihat header respons saja' },
      {
        cmd: 'tar -czf arsip.tgz folder/',
        desc: 'Buat arsip terkompresi; ekstrak dengan tar -xzf arsip.tgz',
      },
      { cmd: 'chmod +x <file>', desc: 'Jadikan file bisa dieksekusi' },
    ],
  },
  {
    id: 'pnpm',
    title: 'pnpm',
    intro: 'Manajemen dependensi.',
    items: [
      {
        cmd: 'pnpm add <paket>',
        desc: 'Tambah dependensi; tambahkan -D untuk devDependencies',
      },
      { cmd: 'pnpm remove <paket>', desc: 'Hapus dependensi' },
      {
        cmd: 'pnpm install --frozen-lockfile',
        desc: 'Pasang persis sesuai lockfile (cocok untuk CI)',
      },
      {
        cmd: 'pnpm outdated',
        desc: 'Daftar paket yang punya versi lebih baru',
      },
      {
        cmd: 'pnpm up --latest',
        desc: 'Naikkan paket ke versi terbaru, melewati rentang di package.json',
      },
      {
        cmd: 'pnpm why <paket>',
        desc: 'Kenapa paket ini terpasang (siapa yang membutuhkannya)',
      },
      {
        cmd: 'pnpm dlx <paket>',
        desc: 'Jalankan paket sekali pakai tanpa memasangnya',
      },
      {
        cmd: 'pnpm store prune',
        desc: 'Bersihkan paket yang tidak terpakai dari store',
      },
    ],
  },
  {
    id: 'typescript',
    title: 'TypeScript',
    intro: 'Utility type dan pola yang sering dipakai.',
    items: [
      { cmd: 'Partial<T>', desc: 'Semua properti T menjadi opsional' },
      {
        cmd: "Pick<T, 'a' | 'b'>",
        desc: 'Ambil hanya properti tertentu dari T',
      },
      { cmd: "Omit<T, 'a'>", desc: 'Semua properti T kecuali yang disebut' },
      {
        cmd: 'Record<string, number>',
        desc: 'Objek dengan kunci string dan nilai number',
      },
      {
        cmd: 'ReturnType<typeof fn>',
        desc: 'Tipe nilai kembalian sebuah fungsi',
      },
      {
        cmd: 'Awaited<Promise<T>>',
        desc: 'Tipe hasil setelah promise selesai (T)',
      },
      {
        cmd: 'const x = { a: 1 } as const',
        desc: 'Jadikan literal tidak bisa diubah dan tipenya sesempit mungkin',
      },
      {
        cmd: 'const x = { ... } satisfies T',
        desc: 'Periksa kecocokan dengan T tanpa melebarkan tipe x',
      },
      {
        cmd: 'keyof typeof obj',
        desc: 'Gabungan nama kunci dari sebuah objek',
      },
    ],
  },
];
