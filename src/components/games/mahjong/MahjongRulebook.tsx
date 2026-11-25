'use client';

import { ArrowLeft, ArrowRight, BookOpen, ChevronRight, X } from 'lucide-react';
import * as React from 'react';

import styles from './MahjongRulebook.module.css';

import { DECISION_SECONDS, tileLabel } from '@/lib/games/hk-mahjong/rules';
import { PAYMENTS, TILE_CODES } from '@/lib/games/hk-mahjong/score';

import {
  PATTERN_HANDS,
  readExample,
  STANDARD_HAND,
} from '@/components/games/mahjong/rulebook-hands';
import TileFace from '@/components/games/mahjong/TileFace';

const CHAPTERS = [
  'Dasar permainan',
  'Giliran dan klaim',
  'Atlas pola',
  'Faan dan poin',
];
const TITLES = [
  'Menyusun tangan pertama',
  'Ambil, klaim, lalu buang',
  'Mengenali pola kemenangan',
  'Menghitung hasil tangan',
];

function Tile({ id }: { id: number }) {
  return (
    <span className={styles.tile} role='img' aria-label={tileLabel(id)}>
      <span aria-hidden='true'>
        <TileFace kind={TILE_CODES[id]} />
      </span>
    </span>
  );
}
function Sample({
  example,
  flower = 34,
}: {
  example: typeof STANDARD_HAND;
  flower?: number;
}) {
  const { groups, score } = readExample(example, flower);
  return (
    <figure className={styles.sample}>
      <figcaption>
        <strong>{example.title}</strong>
        <span>{score.faan} faan</span>
      </figcaption>
      <div className={styles.rack}>
        {groups.map(({ tiles, label }, i) => (
          <div className={styles.group} key={i}>
            <div>
              {tiles.map((t, j) => (
                <Tile key={j} id={t} />
              ))}
            </div>
            <small>{label}</small>
          </div>
        ))}
      </div>
      <div className={styles.sampleScore}>
        {score.patterns.map((p) => (
          <span key={p.label}>
            {p.label} <b>+{p.faan}</b>
          </span>
        ))}
      </div>
    </figure>
  );
}
function Basics() {
  return (
    <>
      <p>
        Mahjong Hong Kong dimainkan empat orang. Tujuanmu menyelesaikan tangan
        bernilai minimal <strong>3 faan</strong>. Bentuk yang paling sering
        ditemui adalah empat set dan satu pasang.
      </p>
      <Sample example={STANDARD_HAND} flower={35} />
      <p>
        {STANDARD_HAND.description} Pemain duduk di Selatan pada ronde Timur dan
        memegang bunga nomor 2, sehingga tangan ini tepat mencapai tiga faan.
      </p>
      <h3>Mengenal 144 ubin</h3>
      <dl className={styles.entries}>
        <dt>108 ubin angka</dt>
        <dd>
          Bambu, karakter, dan lingkaran masing-masing bernomor 1–9. Setiap ubin
          punya empat salinan.
        </dd>
        <dt>28 kehormatan</dt>
        <dd>
          Empat angin dan tiga naga, masing-masing empat salinan. Ubin ini bisa
          menjadi pasangan, pong, atau kong.
        </dd>
        <dt>8 bonus</dt>
        <dd>
          Empat bunga dan empat musim. Meja membukanya dan menarik pengganti
          dari belakang tembok sampai mendapat ubin biasa.
        </dd>
      </dl>
      <h3>Duduk dan mulai</h3>
      <p>
        Meja mulai saat keempat kursi terisi. Bandar pertama dipilih acak dan
        duduk di Timur dengan 14 ubin. Pemain lain mendapat 13. Timur membuang
        lebih dulu, lalu giliran bergerak ke Selatan, Barat, dan Utara.
      </p>
    </>
  );
}
function Claims({ seconds }: { seconds: number }) {
  return (
    <>
      <p>
        Ketika giliranmu tiba, meja menarik satu ubin. Pilih ubin di rak lalu
        tekan <strong>Buang</strong>, atau tekan <strong>Mahjong!</strong> jika
        tanganmu memenuhi syarat menang.
      </p>
      <div className={styles.clockNote}>
        <strong>
          {seconds}
          <small> detik</small>
        </strong>
        <p>
          Batas untuk membuang ubin. Jika waktumu habis, meja membuang ubin
          tarikan secara otomatis. Setelah chow atau pong, meja memilih satu
          ubin dari tanganmu. Setiap giliran yang terlewat memberi satu
          peringatan. Pemain keluar dari permainan saat mencapai batas
          peringatan ruang.
        </p>
      </div>
      <h3>Kapan boleh mengambil buangan?</h3>
      <div className={styles.calls}>
        {[
          {
            title: 'Chow',
            tiles: [2, 3, 4],
            text: 'Tiga angka berurutan dari jenis yang sama. Ambil buangan pemain di kirimu jika kamu memegang dua angka pelengkap.',
          },
          {
            title: 'Pong',
            tiles: [31, 31, 31],
            text: 'Tiga ubin identik. Dengan dua di tangan, kamu boleh mengambil ubin ketiga dari buangan pemain mana pun.',
          },
          {
            title: 'Kong',
            tiles: [15, 15, 15, 15],
            text: 'Empat ubin identik. Klaim buangan keempat, nyatakan empat ubin milikmu saat giliran tarik, atau tambahkan satu ubin pada pong terbuka. Meja menarik satu pengganti.',
          },
        ].map((c) => (
          <div key={c.title}>
            <div className={styles.callTiles}>
              {c.tiles.map((t, i) => (
                <Tile key={i} id={t} />
              ))}
            </div>
            <div>
              <h4>{c.title}</h4>
              <p>{c.text}</p>
            </div>
          </div>
        ))}
      </div>
      <h3>Jika beberapa pemain mengklaim</h3>
      <p>
        <strong>Mahjong → pong atau kong → chow.</strong> Semua pemain yang
        berhak mendapat jendela klaim bersama selama {seconds} detik. Jika
        beberapa pemain bisa menang, kursi terdekat setelah pembuang dalam
        urutan giliran mendapat ubinnya.
      </p>
      <p>
        Setelah chow atau pong, langsung buang satu ubin. Tekan{' '}
        <strong>Lewati</strong> untuk melepas klaim. Meja menyelesaikan klaim
        lebih awal saat semua pemain yang berhak sudah menjawab. Saat waktu
        habis, klaim tanpa jawaban dilewati.
      </p>
      <p>
        Kong tambahan dapat direbut oleh pemain yang langsung menang dengan ubin
        keempat. Pada buangan terakhir, satu-satunya klaim yang tersedia adalah
        mahjong.
      </p>
    </>
  );
}
function Patterns() {
  const [index, setIndex] = React.useState(0);
  const example = PATTERN_HANDS[index];
  return (
    <>
      <p>
        Bandingkan bentuk tangan, kelompok ubin, dan rincian faannya. Semua
        contoh memakai kursi Selatan pada ronde Timur, menang dari buangan, dan
        memegang bunga nomor 1.
      </p>
      <label className={styles.field}>
        Pilih contoh pola
        <select
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
        >
          {PATTERN_HANDS.map((h, i) => (
            <option key={h.title} value={i}>
              {h.title}
            </option>
          ))}
        </select>
      </label>
      <div aria-live='polite'>
        <Sample example={example} />
        <p>{example.description}</p>
      </div>
      <h3>Daftar nilai pola</h3>
      <dl className={styles.entries}>
        <dt>1 faan</dt>
        <dd>
          Semua chow dengan pasangan selain naga atau angin kursi. Setiap pong
          atau kong naga, angin kursi, atau angin ronde juga memberi satu faan.
        </dd>
        <dt>3–4 faan</dt>
        <dd>
          Semua pong atau satu jenis angka dengan kehormatan bernilai 3. Tujuh
          pasang berbeda bernilai 4. Kombinasi pong terminal (1 atau 9) dan
          kehormatan juga bernilai 4.
        </dd>
        <dt>5–8 faan</dt>
        <dd>
          Tiga naga kecil bernilai 5. Tiga pong angin dan sepasang angin keempat
          bernilai 6. Satu jenis murni bernilai 7. Tiga pong naga atau empat
          pong tertutup bernilai 8. Untuk empat pong tertutup, buangan hanya
          boleh melengkapi pasangan.
        </dd>
        <dt>Batas 10 faan</dt>
        <dd>
          Empat pong angin, semua kehormatan, semua terminal, tiga belas yatim,
          sembilan gerbang, atau empat kong. Menang dengan tangan awal bandar,
          pada buangan pertama bandar, atau pada tarikan pertama pemain lain
          juga mencapai batas bila belum ada set yang dinyatakan.
        </dd>
      </dl>
    </>
  );
}
function Scoring() {
  const [flower, setFlower] = React.useState(35);
  const { score } = readExample(STANDARD_HAND, flower);
  return (
    <>
      <p>
        Faan mengukur nilai kombinasi tangan. Meja memilih susunan dengan nilai
        tertinggi, lalu mengubahnya menjadi poin. Coba ganti bunga di bawah
        untuk melihat pengaruhnya pada tangan yang sama.
      </p>
      <fieldset className={styles.toggle}>
        <legend>Bunga yang dipegang kursi Selatan</legend>
        {[34, 35].map((t, i) => (
          <button
            key={t}
            type='button'
            aria-pressed={flower === t}
            onClick={() => setFlower(t)}
          >
            <Tile id={t} />
            Bunga {i + 1}
          </button>
        ))}
      </fieldset>
      <div aria-live='polite'>
        <Sample example={STANDARD_HAND} flower={flower} />
        <p>
          {score.units
            ? `Bunga nomor 2 cocok dengan Selatan. Tiga faan cukup untuk menang. Karena ubin penutup berasal dari buangan, pembuang membayar ${score.units} poin.`
            : 'Bunga nomor 1 cocok dengan Timur. Untuk kursi Selatan, tangan ini hanya menghasilkan dua faan. Pemain perlu menambah faan sebelum boleh menang.'}
        </p>
      </div>
      <h3>Bonus yang dapat ditambahkan</h3>
      <p>
        Ambil sendiri, menang tertutup dari buangan, menang dari pengganti kong,
        merebut kong, dan menang dengan ubin atau buangan terakhir masing-masing
        memberi 1 faan. Pola yang sudah mencakup bonus tertentu dihitung sekali.
      </p>
      <p>
        Tanpa bunga dan musim bernilai 1. Bunga atau musim yang cocok dengan
        kursi memberi 1 masing-masing. Nomor kursi berurutan dari 1 untuk Timur
        sampai 4 untuk Utara. Empat bunga lengkap atau empat musim lengkap
        memberi 3 untuk kelompok itu.
      </p>
      <h3>Pembayaran per lawan</h3>
      <table className={styles.payments}>
        <caption className='sr-only'>
          Konversi faan menjadi poin per pembayar
        </caption>
        <thead>
          <tr>
            <th scope='col'>Faan</th>
            {PAYMENTS.slice(3).map((_, i) => (
              <th scope='col' key={i}>
                {i + 3}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope='row'>Poin</th>
            {PAYMENTS.slice(3).map((p) => (
              <td key={p}>{p}</td>
            ))}
          </tr>
        </tbody>
      </table>
      <p>
        Pada ambil sendiri, ketiga lawan masing-masing membayar nilai pada
        tabel. Jika tembok habis dan tak ada yang menang, hasilnya seri dengan
        perpindahan 0 poin.
      </p>
      <h3>Akhir ronde Timur</h3>
      <p>
        Bandar bertahan saat menang atau seri. Saat pemain lain menang, kursi
        berikutnya menjadi bandar. Setelah bandar keempat berganti, pemain
        dengan poin tertinggi menang. Nilai tertinggi yang sama menghasilkan
        pemenang bersama.
      </p>
      <p className={styles.sources}>
        Rujukan meja ·{' '}
        <a href='https://www.majoy.id/' target='_blank' rel='noreferrer'>
          Majoy, Jakarta
        </a>{' '}
        ·{' '}
        <a
          href='https://danielchung.design/mahjong'
          target='_blank'
          rel='noreferrer'
        >
          Hong Kong Old Style
        </a>
      </p>
    </>
  );
}

export function BookButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type='button'
      className={styles.trigger}
      aria-haspopup='dialog'
      onClick={onClick}
    >
      <BookOpen aria-hidden='true' size={17} />
      Buku aturan
    </button>
  );
}

export default function MahjongRulebook({
  onDismiss,
  playing,
  myTurn,
  decisionSeconds = DECISION_SECONDS,
}: {
  onDismiss: () => void;
  playing: boolean;
  myTurn: boolean;
  decisionSeconds?: number;
}) {
  const dialog = React.useRef<HTMLDialogElement>(null);
  const heading = React.useRef<HTMLHeadingElement>(null);
  const content = React.useRef<HTMLDivElement>(null);
  const [chapter, setChapter] = React.useState(0);
  const titleId = React.useId();
  React.useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
  }, []);
  React.useEffect(() => {
    content.current?.scrollTo(0, 0);
    heading.current?.focus({ preventScroll: true });
  }, [chapter]);
  const close = () => dialog.current?.close();
  return (
    <dialog
      ref={dialog}
      className={styles.book}
      aria-labelledby={titleId}
      onClose={onDismiss}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const b = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < b.left ||
          e.clientX > b.right ||
          e.clientY < b.top ||
          e.clientY > b.bottom
        )
          close();
      }}
    >
      <div className={styles.spread}>
        <aside className={styles.index}>
          <div className={styles.coverArt} aria-hidden='true'>
            {[5, 31, 20].map((t) => (
              <Tile key={t} id={t} />
            ))}
          </div>
          <p className={styles.edition}>Mahjong Hong Kong</p>
          <h2 id={titleId}>Buku aturan</h2>
          <nav aria-label='Daftar isi'>
            {CHAPTERS.map((name, i) => (
              <button
                key={name}
                type='button'
                aria-current={i === chapter ? 'page' : undefined}
                onClick={() => setChapter(i)}
              >
                <span>0{i + 1}</span>
                {name}
                <ChevronRight size={15} aria-hidden='true' />
              </button>
            ))}
          </nav>
          <label className={styles.mobileChapters}>
            <span className='sr-only'>Daftar isi</span>
            <select
              value={chapter}
              onChange={(e) => setChapter(Number(e.target.value))}
            >
              {CHAPTERS.map((name, i) => (
                <option key={name} value={i}>
                  Bab {i + 1} · {name}
                </option>
              ))}
            </select>
          </label>
        </aside>
        <div className={styles.page}>
          <div className={styles.topline}>
            <span>
              Bab {chapter + 1} <i>/</i> {CHAPTERS[chapter]}
            </span>
            <button
              aria-label='Tutup buku aturan'
              type='button'
              onClick={close}
            >
              <X size={19} />
            </button>
          </div>
          <div className={styles.reading} ref={content}>
            <h2 ref={heading} tabIndex={-1}>
              {TITLES[chapter]}
            </h2>
            {
              [
                <Basics key='basics' />,
                <Claims key='claims' seconds={decisionSeconds} />,
                <Patterns key='patterns' />,
                <Scoring key='scoring' />,
              ][chapter]
            }
          </div>
          {playing && (
            <button type='button' className={styles.live} onClick={close}>
              {myTurn
                ? 'Meja menunggu pilihanmu'
                : 'Permainan sedang berlangsung'}{' '}
              · Kembali ke meja <ArrowRight size={14} />
            </button>
          )}
          <footer className={styles.footer}>
            <button
              type='button'
              aria-label='Bab sebelumnya'
              disabled={chapter === 0}
              onClick={() => setChapter(chapter - 1)}
            >
              <ArrowLeft size={17} />
            </button>
            <span>
              Bab {chapter + 1} dari {CHAPTERS.length}
            </span>
            {chapter === CHAPTERS.length - 1 ? (
              <button type='button' onClick={close}>
                Selesai <X size={15} />
              </button>
            ) : (
              <button type='button' onClick={() => setChapter(chapter + 1)}>
                Bab berikutnya <ArrowRight size={16} />
              </button>
            )}
          </footer>
        </div>
      </div>
    </dialog>
  );
}
