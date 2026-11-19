/**
 * Short "how to play" hints shown on each game's room screen, keyed by game id.
 * A few plain bullets: the goal, how a turn works, and how you win. Role games
 * list what the special roles do. Kept brief on purpose; the full rules live in
 * the game itself.
 */
export const GAME_HINTS: Record<string, string[]> = {
  connect4: [
    'Jatuhkan bidakmu ke salah satu kolom, bergantian dengan lawan.',
    'Menang kalau berhasil membuat empat berjajar: mendatar, menurun, atau diagonal.',
    'Halangi lawan yang sudah punya tiga berjajar sebelum dia menutupnya.',
  ],
  suit: [
    'Batu, gunting, kertas. Batu kalahkan gunting, gunting kalahkan kertas, kertas kalahkan batu.',
    'Pilih diam-diam; pilihan baru terbuka setelah kedua pemain memilih.',
    'Yang menang dua ronde lebih dulu, menang.',
  ],
  karambol: [
    'Bisa 2 pemain (1v1 Putih vs Hitam), 3 pemain (rebutan poin), atau 4 pemain (2v2 tim seberang).',
    'Geser posisi striker di garismu, lalu tarik mundur dan lepas untuk menembak.',
    'Bidak yang masuk memberi giliran tambahan. Jika memasukkan Ratu (merah), wajib cover dengan memasukkan 1 bidak.',
    'Striker masuk lubang = foul (1 bidak yang sudah masuk dikembalikan ke tengah / -1 poin).',
  ],
  gelud: [
    'Duel fighting Best of 3 ronde: habiskan HP lawan atau unggul HP saat waktu habis.',
    'A/D (atau Panah) gerak, W/↑ lompat, S/↓ tahan untuk blokir (mengurangi damage 75%).',
    'F/Spasi pukul cepat, G tendang, H jurus super saat bar kuning ≥ 50%.',
  ],
  uno: [
    'Buang kartu yang warna atau angka/simbolnya sama dengan kartu teratas.',
    'Tidak ada yang cocok? Tarik satu kartu; boleh langsung dimainkan kalau pas, kalau tidak giliran lewat.',
    'Kartu aksi: Skip (lewati), Reverse (balik arah), +2, Wild (ganti warna), +4.',
    'Sisa dua kartu, teriak UNO sebelum main. Lupa dan sisa satu, bisa ditangkap lawan: tarik 2.',
    'Yang kartunya habis duluan menang; sisanya lanjut memperebutkan peringkat.',
  ],
  unoflip: [
    'Seperti Uno, tapi setiap kartu punya dua sisi. Mulai di sisi terang.',
    'Kartu FLIP membalik tumpukan dan semua tangan ke sisi gelap yang lebih kejam (dan kembali).',
    'Kamu memegang sisi yang sedang berlaku; lawan melihat sisi lainnya.',
    'Teriak UNO di kartu kedua terakhir, atau ditangkap dan tarik 2.',
  ],
  unomercy: [
    'Uno paling kejam: hukuman +2/+4 bisa ditumpuk ke korban berikutnya.',
    'Ada kartu tukar tangan dan oper kartu; waspada.',
    'Sampai 25 kartu? Kamu langsung gugur dari ronde itu.',
    'Teriak UNO di kartu kedua terakhir seperti biasa.',
  ],
  sekata: [
    'Susun kata bahasa Indonesia yang sah dari kartu suku kata.',
    'Pilih atau seret kartu untuk merangkai kata, lalu kirim.',
    'Lomba cepat-cepatan: makin cepat dan makin panjang katanya, makin banyak poin.',
  ],
  dart: [
    'Bidik dengan pointer, klik atau ketuk untuk melempar.',
    'Setiap pemain melempar bergantian; nilai dihitung dari zona yang kena.',
    'Cincin luar dua kali lipat, cincin dalam tiga kali lipat, bullseye nilai tertinggi.',
    'Kumpulkan skor tertinggi untuk menang.',
  ],
  remo: [
    'Rummy klasik: susun kartu jadi urutan (seri) atau set (angka sama beda jenis).',
    'Setiap giliran: ambil satu kartu, susun kombinasi kalau bisa, lalu buang satu.',
    'Yang pertama menghabiskan semua kartunya menang.',
  ],
  werewolf: [
    'Warga vs serigala. Warga menang kalau semua serigala tersingkir; serigala menang kalau jumlah mereka menyamai warga.',
    'Malam: serigala memilih korban diam-diam, dan peran khusus beraksi. Siang: semua berdebat lalu memilih siapa yang digantung.',
    'Peran: Seer mengintip satu orang tiap malam, Doctor/Bodyguard melindungi, Witch bisa menyembuhkan/meracun, Hunter menembak saat mati.',
    'Peranmu rahasia. Pembuat room mengatur peran yang dipakai sebelum mulai.',
  ],
  monkeys: [
    'Tepat tiga pemain menjinakkan satu bom bersama-sama.',
    'Tiap pemain cuma punya satu kemampuan: satu bisa menyentuh bom, satu bisa membaca manual, satu bisa melihat dan bicara.',
    'Kalian harus saling memberi tahu lewat suara/gerakan karena tidak ada yang tahu semuanya.',
    'Jinakkan sebelum waktu habis.',
  ],
  battleship: [
    'Susun armada kapalmu diam-diam di petak.',
    'Bergantian menembak satu petak di perairan lawan.',
    'Tenggelamkan semua kapal lawan lebih dulu untuk menang.',
  ],
  gomoku: [
    'Papan 15x15. Bergantian menaruh bidak; hitam jalan duluan.',
    'Menang kalau berhasil membuat lima bidak berjajar: mendatar, menurun, atau diagonal.',
  ],
  checkers: [
    'Gerakkan bidak diagonal ke depan. Wajib memakan bidak lawan kalau ada kesempatan.',
    'Sampai di baris ujung lawan, bidak jadi raja dan bisa mundur.',
    'Habisi semua bidak lawan, atau buat dia tak bisa bergerak.',
  ],
  chess: [
    'Catur lengkap: rokade, en passant, dan promosi semua jalan.',
    'Pembuat room memegang putih dan jalan duluan.',
    'Skakmat raja lawan untuk menang.',
  ],
  dice: [
    'Dadu bohong: tawar berapa banyak dadu dengan angka tertentu ada di meja (angka 1 jadi joker).',
    'Tiap tawaran harus lebih tinggi dari sebelumnya, atau tantang "bohong!" kalau tak percaya.',
    'Kalau tantangan benar, penawar kehilangan satu dadu; kalau salah, penantang yang kehilangan.',
    'Yang terakhir punya dadu, menang.',
  ],
  domino: [
    'Sambung ujung yang angkanya sama di rantai.',
    'Tidak punya yang cocok? Tarik dari tumpukan sampai dapat atau habis.',
    'Yang pertama menghabiskan kartunya menang rondenya.',
  ],
  quiz: [
    'Soal pilihan ganda; jawab secepat dan setepat mungkin.',
    'Jawaban benar yang lebih cepat dapat poin lebih banyak.',
    'Skor tertinggi setelah semua soal, menang.',
  ],
  pictionary: [
    'Satu orang menggambar kata rahasia, yang lain menebak di chat.',
    'Menebak lebih cepat dapat poin lebih banyak; penggambar juga dapat poin kalau tebakannya kena.',
    'Bergiliran jadi penggambar. Skor tertinggi menang.',
  ],
};
