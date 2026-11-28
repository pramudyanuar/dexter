export interface Question {
  q: string;
  options: [string, string, string, string];
  /** Index of the right option */
  answer: 0 | 1 | 2 | 3;
}

export const QUESTIONS: readonly Question[] = [
  {
    q: 'Ibu kota Indonesia saat ini adalah...',
    options: ['Bandung', 'Jakarta', 'Surabaya', 'Medan'],
    answer: 1,
  },
  {
    q: 'Siapa proklamator kemerdekaan Indonesia bersama Soekarno?',
    options: ['Moh. Hatta', 'Sutan Sjahrir', 'Ki Hajar Dewantara', 'Soeharto'],
    answer: 0,
  },
  {
    q: 'Planet terbesar di tata surya adalah...',
    options: ['Saturnus', 'Neptunus', 'Jupiter', 'Bumi'],
    answer: 2,
  },
  {
    q: 'Gunung tertinggi di Indonesia adalah...',
    options: ['Semeru', 'Rinjani', 'Kerinci', 'Puncak Jaya'],
    answer: 3,
  },
  {
    q: 'Hewan khas Pulau Komodo adalah...',
    options: ['Komodo', 'Orangutan', 'Badak Jawa', 'Anoa'],
    answer: 0,
  },
  {
    q: 'Berapa jumlah provinsi di Pulau Jawa (tidak termasuk DKI)?',
    options: ['4', '5', '6', '3'],
    answer: 1,
  },
  {
    q: 'Lambang kimia untuk air adalah...',
    options: ['CO2', 'O2', 'H2O', 'NaCl'],
    answer: 2,
  },
  {
    q: 'Candi Buddha terbesar di dunia terdapat di...',
    options: ['Prambanan', 'Borobudur', 'Mendut', 'Sewu'],
    answer: 1,
  },
  {
    q: 'Hasil dari 12 x 12 adalah...',
    options: ['124', '122', '144', '148'],
    answer: 2,
  },
  {
    q: 'Alat musik tradisional Jawa Barat yang terbuat dari bambu adalah...',
    options: ['Sasando', 'Angklung', 'Tifa', 'Gong'],
    answer: 1,
  },
  {
    q: 'Benua terluas di dunia adalah...',
    options: ['Afrika', 'Amerika', 'Asia', 'Eropa'],
    answer: 2,
  },
  {
    q: 'Pulau terbesar di Indonesia adalah...',
    options: ['Jawa', 'Sumatra', 'Sulawesi', 'Kalimantan'],
    answer: 3,
  },
  {
    q: 'Siapa penulis novel "Laskar Pelangi"?',
    options: [
      'Andrea Hirata',
      'Tere Liye',
      'Pramoedya A. Toer',
      'Habiburrahman',
    ],
    answer: 0,
  },
  {
    q: 'Gas yang paling banyak di atmosfer bumi adalah...',
    options: ['Oksigen', 'Nitrogen', 'Karbon dioksida', 'Hidrogen'],
    answer: 1,
  },
  {
    q: 'Tarian Kecak berasal dari pulau...',
    options: ['Lombok', 'Jawa', 'Bali', 'Sumba'],
    answer: 2,
  },
  {
    q: 'Berapa jumlah sisi pada segi enam?',
    options: ['5', '7', '8', '6'],
    answer: 3,
  },
  {
    q: 'Negara dengan menara Eiffel adalah...',
    options: ['Prancis', 'Italia', 'Spanyol', 'Jerman'],
    answer: 0,
  },
  {
    q: 'Mata uang Jepang adalah...',
    options: ['Won', 'Yen', 'Yuan', 'Ringgit'],
    answer: 1,
  },
  {
    q: 'Sumpah Pemuda diikrarkan pada tahun...',
    options: ['1908', '1945', '1928', '1950'],
    answer: 2,
  },
  {
    q: 'Organ yang memompa darah ke seluruh tubuh adalah...',
    options: ['Paru-paru', 'Hati', 'Ginjal', 'Jantung'],
    answer: 3,
  },
  {
    q: 'Samudra terluas di dunia adalah...',
    options: ['Pasifik', 'Atlantik', 'Hindia', 'Arktik'],
    answer: 0,
  },
  {
    q: 'Rumah adat Minangkabau disebut...',
    options: ['Joglo', 'Rumah Gadang', 'Honai', 'Tongkonan'],
    answer: 1,
  },
  {
    q: 'Berapa hasil dari 7 x 8?',
    options: ['54', '48', '56', '63'],
    answer: 2,
  },
  {
    q: 'Presiden pertama Republik Indonesia adalah...',
    options: ['Soeharto', 'B.J. Habibie', 'Megawati', 'Soekarno'],
    answer: 3,
  },
  {
    q: 'Hewan yang dikenal sebagai raja hutan adalah...',
    options: ['Singa', 'Harimau', 'Gajah', 'Beruang'],
    answer: 0,
  },
  {
    q: 'Proses tumbuhan membuat makanan dengan bantuan cahaya disebut...',
    options: ['Respirasi', 'Fotosintesis', 'Fermentasi', 'Evaporasi'],
    answer: 1,
  },
  {
    q: 'Piala Dunia sepak bola 2022 diselenggarakan di...',
    options: ['Rusia', 'Brasil', 'Qatar', 'Jerman'],
    answer: 2,
  },
  {
    q: 'Benda langit yang mengelilingi bumi adalah...',
    options: ['Mars', 'Venus', 'Matahari', 'Bulan'],
    answer: 3,
  },
  {
    q: 'Warna yang dihasilkan dari campuran biru dan kuning adalah...',
    options: ['Hijau', 'Ungu', 'Oranye', 'Cokelat'],
    answer: 0,
  },
  {
    q: 'Pahlawan wanita dari Aceh yang gigih melawan Belanda adalah...',
    options: [
      'R.A. Kartini',
      'Cut Nyak Dien',
      'Dewi Sartika',
      'Martha C. Tiahahu',
    ],
    answer: 1,
  },
  {
    q: 'Jumlah huruf dalam alfabet Latin adalah...',
    options: ['24', '25', '26', '28'],
    answer: 2,
  },
  {
    q: 'Satuan untuk mengukur kuat arus listrik adalah...',
    options: ['Volt', 'Watt', 'Ohm', 'Ampere'],
    answer: 3,
  },
  {
    q: 'Bahasa pemrograman yang berjalan di browser adalah...',
    options: ['JavaScript', 'C++', 'Rust', 'COBOL'],
    answer: 0,
  },
  {
    q: 'Makanan khas Padang yang terkenal dari daging berbumbu santan pedas adalah...',
    options: ['Gudeg', 'Rendang', 'Pempek', 'Rawon'],
    answer: 1,
  },
  {
    q: 'Hewan mamalia yang bisa terbang adalah...',
    options: ['Burung hantu', 'Capung', 'Kelelawar', 'Elang'],
    answer: 2,
  },
  {
    q: 'Kota yang dijuluki Kota Pahlawan adalah...',
    options: ['Bandung', 'Semarang', 'Yogyakarta', 'Surabaya'],
    answer: 3,
  },
  {
    q: 'Berapa derajat sudut siku-siku?',
    options: ['90', '45', '180', '60'],
    answer: 0,
  },
  {
    q: 'Sungai terpanjang di dunia (umumnya disebut) adalah...',
    options: ['Amazon', 'Nil', 'Yangtze', 'Mississippi'],
    answer: 1,
  },
  {
    q: 'Mata uang Indonesia disingkat...',
    options: ['IDN', 'RPH', 'IDR', 'INR'],
    answer: 2,
  },
  {
    q: 'Logam yang berwujud cair pada suhu ruang adalah...',
    options: ['Besi', 'Emas', 'Tembaga', 'Raksa'],
    answer: 3,
  },
  {
    q: 'Bunga nasional Indonesia (puspa bangsa) adalah...',
    options: ['Melati', 'Mawar', 'Anggrek', 'Teratai'],
    answer: 0,
  },
  {
    q: 'Negara terkecil di dunia berdasarkan luas wilayah adalah...',
    options: ['Monako', 'Vatikan', 'Nauru', 'Malta'],
    answer: 1,
  },
  {
    q: 'Selat yang memisahkan Pulau Jawa dan Sumatra adalah Selat...',
    options: ['Bali', 'Makassar', 'Sunda', 'Malaka'],
    answer: 2,
  },
  {
    q: 'Tahun kemerdekaan Indonesia adalah...',
    options: ['1942', '1950', '1949', '1945'],
    answer: 3,
  },
];
