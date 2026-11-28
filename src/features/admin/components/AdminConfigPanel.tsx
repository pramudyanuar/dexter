'use client';

import * as React from 'react';

import { COUNTUP_ROUNDS } from '@/features/games/logic/dart-config';
import {
  DECISION_LIMITS,
  DECISION_SECONDS,
} from '@/features/games/logic/hk-mahjong/rules';
import {
  CAMPAIGN,
  MONKEY_CUSTOM_LIMITS,
} from '@/features/games/logic/monkeys-config';
import {
  ROUND_LIMITS,
  ROUND_SECONDS,
  TURNS_EACH,
} from '@/features/games/logic/pictionary';
import { REMO_CLOCK } from '@/features/games/logic/remo-config';
import {
  SEKATA_BLANK_CARDS,
  SEKATA_LIMITS,
} from '@/features/games/logic/sekata-config';
import {
  maxMercyHandSize,
  UNO_HAND_SIZE,
  UNO_MERCY_LIMIT,
} from '@/features/games/logic/uno-rules';
import { GameConfig } from '@/features/rooms/game-config';

const rangeHint = ({ min, max }: { min: number; max: number }) =>
  `${min}–${max}`;

type Category = 'all' | 'global' | 'cards' | 'party' | 'duel';

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'all', label: 'Semua' },
  { id: 'global', label: 'Global Room' },
  { id: 'cards', label: 'Permainan Kartu' },
  { id: 'party', label: 'Pesta & Sosial' },
  { id: 'duel', label: 'Duel & Aksi' },
];

function ConfigCard({
  title,
  badge,
  description,
  children,
}: {
  title: string;
  badge: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className='flex flex-col gap-3 rounded-xl border border-line bg-surface/50 p-4'>
      <div className='border-b border-line pb-2.5'>
        <div className='flex items-center justify-between gap-2'>
          <h3 className='text-sm font-semibold text-ink'>{title}</h3>
          <span className='rounded-full border border-line-strong bg-paper px-2 py-0.5 text-[10px] font-medium text-[var(--mute)]'>
            {badge}
          </span>
        </div>
        <p className='mt-0.5 text-xs text-[var(--mute)]'>{description}</p>
      </div>
      <div className='flex flex-col gap-2.5'>{children}</div>
    </section>
  );
}

function NumberField({
  label,
  hint,
  value,
  min,
  max,
  fallback,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  fallback: number;
  onChange: (next: number) => void;
}) {
  return (
    <label className='flex flex-col gap-1'>
      <div className='flex items-baseline justify-between gap-2 text-xs'>
        <span className='text-ink'>{label}</span>
        {hint && <span className='text-[11px] text-[var(--mute)]'>{hint}</span>}
      </div>
      <input
        type='number'
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(raw === '' ? fallback : Number(raw));
        }}
        className='rounded-lg border border-line-strong bg-paper px-3 py-1.5 font-mono text-sm text-ink focus:border-accent focus:outline-none'
      />
    </label>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <label className='flex flex-col gap-1'>
      <span className='text-xs text-ink'>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className='rounded-lg border border-line-strong bg-paper px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none'
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className='flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-line bg-paper/60 px-3 py-2 text-xs text-ink'>
      <span>{label}</span>
      <input
        type='checkbox'
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className='size-4 accent-accent'
      />
    </label>
  );
}

export default function AdminConfigPanel({
  config,
  setConfig,
  saving,
  notice,
  onSave,
  onReset,
}: {
  config: GameConfig;
  setConfig: React.Dispatch<React.SetStateAction<GameConfig>>;
  saving: boolean;
  notice: string;
  onSave: () => void;
  onReset: () => void;
}) {
  const [category, setCategory] = React.useState<Category>('all');
  const unoHandSizeHint = `${UNO_HAND_SIZE.min}–${UNO_HAND_SIZE.max} kartu`;
  const maxMercyHand = maxMercyHandSize(
    Math.max(UNO_MERCY_LIMIT.min, Math.round(config.unomercy.mercyLimit)),
  );

  const update = <K extends keyof GameConfig>(
    section: K,
    patch: Partial<GameConfig[K]>,
  ) => {
    setConfig((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        ...patch,
      },
    }));
  };

  const show = (cat: Exclude<Category, 'all'>) =>
    category === 'all' || category === cat;

  return (
    <div className='flex flex-col gap-5'>
      {notice && (
        <div className='rounded-xl border border-accent/40 bg-accent/10 px-4 py-2.5 text-sm text-accent'>
          {notice}
        </div>
      )}

      {/* Category Filter + Actions */}
      <div className='flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface/50 p-3'>
        <div className='flex flex-wrap gap-1.5'>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type='button'
              onClick={() => setCategory(c.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                category === c.id
                  ? 'bg-ink text-paper'
                  : 'text-[var(--mute)] hover:bg-paper hover:text-ink'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className='flex flex-wrap gap-2'>
          <button
            type='button'
            disabled={saving}
            onClick={onReset}
            className='rounded-lg border border-line-strong px-3.5 py-1.5 text-xs text-[var(--mute)] transition hover:text-ink disabled:opacity-40'
          >
            Reset Default
          </button>
          <button
            type='button'
            disabled={saving}
            onClick={onSave}
            className='rounded-lg bg-ink px-4 py-1.5 text-xs font-medium text-paper transition hover:opacity-90 disabled:opacity-40'
          >
            {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        </div>
      </div>

      {/* Global Room */}
      {show('global') && (
        <div className='flex flex-col gap-3'>
          <h2 className='text-xs font-semibold tracking-wider text-[var(--mute)] uppercase'>
            Global Room & Moderasi
          </h2>
          <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
            <ConfigCard
              title='Aturan Umum Room'
              badge='Semua Game'
              description='Diterapkan ke semua room baru yang dibuat pemain.'
            >
              <NumberField
                label='Batas Waktu Giliran'
                hint='detik (0 = default game). Game dengan timer sendiri memakai pengaturannya.'
                value={config.room.turnSeconds}
                min={0}
                max={300}
                fallback={0}
                onChange={(turnSeconds) => update('room', { turnSeconds })}
              />
              <NumberField
                label='Maksimal Strike AFK'
                hint='1–10x'
                value={config.room.maxStrikes}
                min={1}
                max={10}
                fallback={3}
                onChange={(maxStrikes) => update('room', { maxStrikes })}
              />
              <NumberField
                label='Toleransi Keluar Tab'
                hint='3–60 detik'
                value={config.room.leaveGraceSeconds}
                min={3}
                max={60}
                fallback={10}
                onChange={(leaveGraceSeconds) =>
                  update('room', { leaveGraceSeconds })
                }
              />
            </ConfigCard>
          </div>
        </div>
      )}

      {/* Permainan Kartu */}
      {show('cards') && (
        <div className='flex flex-col gap-3'>
          <h2 className='text-xs font-semibold tracking-wider text-[var(--mute)] uppercase'>
            Permainan Kartu
          </h2>
          <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
            <ConfigCard
              title='Uno Classic'
              badge='uno'
              description='Pengaturan bawaan room Uno Classic.'
            >
              <NumberField
                label='Kartu Awal per Pemain'
                hint={unoHandSizeHint}
                value={config.uno.handSize}
                min={UNO_HAND_SIZE.min}
                max={UNO_HAND_SIZE.max}
                fallback={UNO_HAND_SIZE.default}
                onChange={(handSize) => update('uno', { handSize })}
              />
            </ConfigCard>

            <ConfigCard
              title='Uno Flip'
              badge='unoflip'
              description='Pengaturan bawaan room Uno Flip.'
            >
              <NumberField
                label='Kartu Awal per Pemain'
                hint={unoHandSizeHint}
                value={config.unoflip.handSize}
                min={UNO_HAND_SIZE.min}
                max={UNO_HAND_SIZE.max}
                fallback={UNO_HAND_SIZE.default}
                onChange={(handSize) => update('unoflip', { handSize })}
              />
            </ConfigCard>

            <ConfigCard
              title='Uno No Mercy'
              badge='unomercy'
              description='Aturan mercy limit dan kartu awal.'
            >
              <NumberField
                label='Batas Kartu Gugur (Mercy)'
                hint={`${UNO_MERCY_LIMIT.min}–${UNO_MERCY_LIMIT.max} kartu`}
                value={config.unomercy.mercyLimit}
                min={UNO_MERCY_LIMIT.min}
                max={UNO_MERCY_LIMIT.max}
                fallback={UNO_MERCY_LIMIT.default}
                onChange={(mercyLimit) => update('unomercy', { mercyLimit })}
              />
              <NumberField
                label='Kartu Awal per Pemain'
                hint={
                  maxMercyHand < UNO_HAND_SIZE.max
                    ? `Dibagikan maksimal ${maxMercyHand} kartu sesuai batas gugur`
                    : unoHandSizeHint
                }
                value={config.unomercy.handSize}
                min={UNO_HAND_SIZE.min}
                max={UNO_HAND_SIZE.max}
                fallback={UNO_HAND_SIZE.default}
                onChange={(handSize) => update('unomercy', { handSize })}
              />
            </ConfigCard>

            <ConfigCard
              title='Domino'
              badge='domino'
              description='Pengaturan jumlah kartu awal Domino.'
            >
              <NumberField
                label='Kartu Awal per Pemain'
                hint='3–10 kartu'
                value={config.domino.handSize}
                min={3}
                max={10}
                fallback={7}
                onChange={(handSize) => update('domino', { handSize })}
              />
            </ConfigCard>

            <ConfigCard
              title='Remo (Remi)'
              badge='remo'
              description='Default mode, kartu awal, joker, dan aturan meld.'
            >
              <SelectField
                label='Mode Default'
                value={config.remo.mode}
                options={[
                  { value: 'classic', label: 'Classic' },
                  { value: 'point', label: 'Point' },
                  { value: 'quick', label: 'Quick' },
                  { value: 'joker', label: 'Joker' },
                ]}
                onChange={(mode) => update('remo', { mode })}
              />
              <div className='grid grid-cols-2 gap-2'>
                <NumberField
                  label='Kartu Awal'
                  hint='5–10'
                  value={config.remo.handSize}
                  min={5}
                  max={10}
                  fallback={7}
                  onChange={(handSize) => update('remo', { handSize })}
                />
                <NumberField
                  label='Jumlah Joker'
                  hint='0–4'
                  value={config.remo.jokers}
                  min={0}
                  max={4}
                  fallback={0}
                  onChange={(jokers) => update('remo', { jokers })}
                />
                <NumberField
                  label='Maks Joker / Meld'
                  hint='1–3'
                  value={config.remo.jokerLimit}
                  min={1}
                  max={3}
                  fallback={1}
                  onChange={(jokerLimit) => update('remo', { jokerLimit })}
                />
                <NumberField
                  label='Min Poin Meld Awal'
                  hint='0 = bebas'
                  value={config.remo.initialMeld}
                  min={0}
                  max={60}
                  fallback={0}
                  onChange={(initialMeld) => update('remo', { initialMeld })}
                />
                <NumberField
                  label='Waktu Giliran'
                  hint={`0 = tanpa timer, atau ${rangeHint(REMO_CLOCK)} dtk`}
                  value={config.remo.turnSeconds}
                  min={0}
                  max={REMO_CLOCK.max}
                  fallback={60}
                  onChange={(turnSeconds) => update('remo', { turnSeconds })}
                />
                <NumberField
                  label='Jumlah Ronde'
                  hint='1–10'
                  value={config.remo.rounds}
                  min={1}
                  max={10}
                  fallback={1}
                  onChange={(rounds) => update('remo', { rounds })}
                />
              </div>
              <SelectField
                label='Cara Menang (Finish)'
                value={config.remo.finish}
                options={[
                  { value: 'discard', label: 'Buang kartu terakhir' },
                  { value: 'melded', label: 'Semua kartu harus di-meld' },
                ]}
                onChange={(finish) => update('remo', { finish })}
              />
              <ToggleField
                label='As bisa rendah (A-2-3)'
                checked={config.remo.aceLow}
                onChange={(aceLow) => update('remo', { aceLow })}
              />
              <ToggleField
                label='As bisa tinggi (Q-K-A)'
                checked={config.remo.aceHigh}
                onChange={(aceHigh) => update('remo', { aceHigh })}
              />
              <ToggleField
                label='Izinkan Layoff ke meja'
                checked={config.remo.layoff}
                onChange={(layoff) => update('remo', { layoff })}
              />
              <ToggleField
                label='Larang buang kartu yang baru diambil'
                checked={config.remo.noSameDiscard}
                onChange={(noSameDiscard) => update('remo', { noSameDiscard })}
              />
            </ConfigCard>
          </div>
        </div>
      )}

      {/* Pesta & Sosial */}
      {show('party') && (
        <div className='flex flex-col gap-3'>
          <h2 className='text-xs font-semibold tracking-wider text-[var(--mute)] uppercase'>
            Pesta & Sosial
          </h2>
          <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
            <ConfigCard
              title='Werewolf'
              badge='werewolf'
              description='Preset, durasi fase, jumlah wolf, dan aturan peran.'
            >
              <div className='grid grid-cols-2 gap-2'>
                <SelectField
                  label='Preset Default'
                  value={config.werewolf.preset}
                  options={[
                    { value: 'classic', label: 'Classic' },
                    { value: 'beginner', label: 'Beginner' },
                    { value: 'chaotic', label: 'Chaotic' },
                    { value: 'custom', label: 'Custom' },
                  ]}
                  onChange={(preset) => update('werewolf', { preset })}
                />
                <SelectField
                  label='Aturan Seri Vote'
                  value={config.werewolf.tieRule}
                  options={[
                    { value: 'none', label: 'Tidak ada yang mati' },
                    { value: 'revote', label: 'Voting ulang' },
                    { value: 'random', label: 'Pilih acak' },
                  ]}
                  onChange={(tieRule) => update('werewolf', { tieRule })}
                />
                <NumberField
                  label='Jumlah Wolf'
                  hint='0 = otomatis'
                  value={config.werewolf.wolves}
                  min={0}
                  max={6}
                  fallback={0}
                  onChange={(wolves) => update('werewolf', { wolves })}
                />
                <NumberField
                  label='Maks Pemain'
                  hint='5–16'
                  value={config.werewolf.maxPlayers}
                  min={5}
                  max={16}
                  fallback={12}
                  onChange={(maxPlayers) => update('werewolf', { maxPlayers })}
                />
                <NumberField
                  label='Diskusi (dtk)'
                  hint='30–300'
                  value={config.werewolf.discussionSeconds}
                  min={30}
                  max={300}
                  fallback={90}
                  onChange={(discussionSeconds) =>
                    update('werewolf', { discussionSeconds })
                  }
                />
                <NumberField
                  label='Voting (dtk)'
                  hint='15–180'
                  value={config.werewolf.votingSeconds}
                  min={15}
                  max={180}
                  fallback={45}
                  onChange={(votingSeconds) =>
                    update('werewolf', { votingSeconds })
                  }
                />
                <NumberField
                  label='Malam (dtk)'
                  hint='15–180'
                  value={config.werewolf.nightSeconds}
                  min={15}
                  max={180}
                  fallback={45}
                  onChange={(nightSeconds) =>
                    update('werewolf', { nightSeconds })
                  }
                />
              </div>
              <ToggleField
                label='Aktifkan peran variasi'
                checked={config.werewolf.variations}
                onChange={(variations) => update('werewolf', { variations })}
              />
              <ToggleField
                label='Dokter boleh lindungi diri sendiri'
                checked={config.werewolf.doctorSelf}
                onChange={(doctorSelf) => update('werewolf', { doctorSelf })}
              />
              <ToggleField
                label='Bodyguard boleh ulang target sama'
                checked={config.werewolf.bodyguardRepeat}
                onChange={(bodyguardRepeat) =>
                  update('werewolf', { bodyguardRepeat })
                }
              />
              <ToggleField
                label='Bodyguard mati saat menangkis'
                checked={config.werewolf.bodyguardDies}
                onChange={(bodyguardDies) =>
                  update('werewolf', { bodyguardDies })
                }
              />
              <ToggleField
                label='Alpha Wolf tersembunyi dari Seer'
                checked={config.werewolf.alphaHidden}
                onChange={(alphaHidden) => update('werewolf', { alphaHidden })}
              />
              <ToggleField
                label='Hunter menembak jika diracun Witch'
                checked={config.werewolf.hunterOnPoison}
                onChange={(hunterOnPoison) =>
                  update('werewolf', { hunterOnPoison })
                }
              />
              <ToggleField
                label='Voting anonim'
                checked={config.werewolf.anonymousVoting}
                onChange={(anonymousVoting) =>
                  update('werewolf', { anonymousVoting })
                }
              />
              <ToggleField
                label='Buka peran saat pemain gugur'
                checked={config.werewolf.revealRoles}
                onChange={(revealRoles) => update('werewolf', { revealRoles })}
              />
              <ToggleField
                label='Boleh ubah pilihan vote'
                checked={config.werewolf.voteChange}
                onChange={(voteChange) => update('werewolf', { voteChange })}
              />
              <ToggleField
                label='Chat khusus pemain mati'
                checked={config.werewolf.deadChat}
                onChange={(deadChat) => update('werewolf', { deadChat })}
              />
            </ConfigCard>

            <ConfigCard
              title='Sekata'
              badge='sekata'
              description='Pengaturan default mode, kartu huruf, penalti, dan waktu.'
            >
              <SelectField
                label='Mode Default'
                value={config.sekata.mode}
                options={[
                  { value: 'classic', label: 'Classic' },
                  { value: 'green', label: 'Green' },
                  { value: 'point', label: 'Point' },
                  { value: 'elimination', label: 'Elimination' },
                  { value: 'speed', label: 'Speed' },
                  { value: 'vocabulary', label: 'Vocabulary' },
                  { value: 'norepeat', label: 'No Repeat' },
                ]}
                onChange={(mode) => update('sekata', { mode })}
              />
              <div className='grid grid-cols-2 gap-2'>
                <NumberField
                  label='Kartu Awal'
                  hint={rangeHint(SEKATA_LIMITS.handSize)}
                  value={config.sekata.handSize}
                  {...SEKATA_LIMITS.handSize}
                  fallback={7}
                  onChange={(handSize) => update('sekata', { handSize })}
                />
                <NumberField
                  label='Kartu Kuning Tengah'
                  hint={rangeHint(SEKATA_LIMITS.sharedYellow)}
                  value={config.sekata.sharedYellow}
                  {...SEKATA_LIMITS.sharedYellow}
                  fallback={2}
                  onChange={(sharedYellow) =>
                    update('sekata', { sharedYellow })
                  }
                />
                <NumberField
                  label='Joker Hijau / Pemain'
                  hint={rangeHint(SEKATA_LIMITS.greenPerPlayer)}
                  value={config.sekata.greenPerPlayer}
                  {...SEKATA_LIMITS.greenPerPlayer}
                  fallback={1}
                  onChange={(greenPerPlayer) =>
                    update('sekata', { greenPerPlayer })
                  }
                />
                <ToggleField
                  label={`Tambahkan ${SEKATA_BLANK_CARDS} kartu kosong`}
                  checked={config.sekata.blankCards === SEKATA_BLANK_CARDS}
                  onChange={(checked) =>
                    update('sekata', {
                      blankCards: checked ? SEKATA_BLANK_CARDS : 0,
                    })
                  }
                />
                <NumberField
                  label='Penalti Kata Ditolak'
                  hint={rangeHint(SEKATA_LIMITS.penalty)}
                  value={config.sekata.penalty}
                  {...SEKATA_LIMITS.penalty}
                  fallback={1}
                  onChange={(penalty) => update('sekata', { penalty })}
                />
                <NumberField
                  label='Batas Waktu (dtk)'
                  hint='0 = tanpa batas'
                  value={config.sekata.timeLimit}
                  {...SEKATA_LIMITS.timeLimit}
                  fallback={0}
                  onChange={(timeLimit) => update('sekata', { timeLimit })}
                />
                <NumberField
                  label='Min Kartu / Kata'
                  hint={rangeHint(SEKATA_LIMITS.minWordCards)}
                  value={config.sekata.minWordCards}
                  {...SEKATA_LIMITS.minWordCards}
                  fallback={2}
                  onChange={(minWordCards) =>
                    update('sekata', { minWordCards })
                  }
                />
                <NumberField
                  label='Batas Ganti Kartu'
                  hint='1–5x'
                  value={config.sekata.replaceLimit}
                  min={1}
                  max={5}
                  fallback={2}
                  onChange={(replaceLimit) =>
                    update('sekata', { replaceLimit })
                  }
                />
              </div>
              <ToggleField
                label='Cooldown setelah dapat kata'
                checked={config.sekata.cooldown}
                onChange={(cooldown) => update('sekata', { cooldown })}
              />
              <ToggleField
                label='Izinkan ganti kartu'
                checked={config.sekata.replacement}
                onChange={(replacement) => update('sekata', { replacement })}
              />
              <ToggleField
                label='Izinkan kata berulang'
                checked={config.sekata.allowRepeats}
                onChange={(allowRepeats) => update('sekata', { allowRepeats })}
              />
              <ToggleField
                label='Aktifkan tantangan (Challenge)'
                checked={config.sekata.challenges}
                onChange={(challenges) => update('sekata', { challenges })}
              />
              <ToggleField
                label='Wajib jelaskan arti kata'
                checked={config.sekata.needMeaning}
                onChange={(needMeaning) => update('sekata', { needMeaning })}
              />
            </ConfigCard>

            <ConfigCard
              title='Quiz'
              badge='quiz'
              description='Jumlah pertanyaan per sesi kuis.'
            >
              <NumberField
                label='Jumlah Soal Quiz'
                hint='3–30 soal'
                value={config.quiz.totalQuestions}
                min={3}
                max={30}
                fallback={10}
                onChange={(totalQuestions) =>
                  update('quiz', { totalQuestions })
                }
              />
            </ConfigCard>

            <ConfigCard
              title='Mahjong Hong Kong'
              badge='mahjong-hk'
              description='Berlaku untuk giliran dan klaim di room baru.'
            >
              <NumberField
                label='Waktu Giliran dan Klaim'
                hint='detik'
                value={config['mahjong-hk'].decisionSeconds}
                min={DECISION_LIMITS.min}
                max={DECISION_LIMITS.max}
                fallback={DECISION_SECONDS}
                onChange={(decisionSeconds) =>
                  update('mahjong-hk', { decisionSeconds })
                }
              />
            </ConfigCard>

            <ConfigCard
              title='Pictionary'
              badge='pictionary'
              description='Giliran menggambar dan durasi ronde untuk room baru.'
            >
              <NumberField
                label='Giliran Gambar / Pemain'
                hint='1–5x'
                value={config.pictionary.turnsEach}
                min={1}
                max={5}
                fallback={TURNS_EACH}
                onChange={(turnsEach) => update('pictionary', { turnsEach })}
              />
              <NumberField
                label='Durasi Ronde'
                hint='detik. Penggambar punya paling lama 60 detik untuk mulai.'
                value={config.pictionary.roundSeconds}
                min={ROUND_LIMITS.min}
                max={ROUND_LIMITS.max}
                fallback={ROUND_SECONDS}
                onChange={(roundSeconds) =>
                  update('pictionary', { roundSeconds })
                }
              />
            </ConfigCard>
          </div>
        </div>
      )}

      {/* Duel & Aksi */}
      {show('duel') && (
        <div className='flex flex-col gap-3'>
          <h2 className='text-xs font-semibold tracking-wider text-[var(--mute)] uppercase'>
            Duel & Aksi
          </h2>
          <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
            <ConfigCard
              title='Batu Gunting Kertas (Suit)'
              badge='suit'
              description='Target kemenangan ronde untuk menang match.'
            >
              <NumberField
                label='Skor Menang (Best of)'
                hint='1–10 ronde'
                value={config.suit.winsNeeded}
                min={1}
                max={10}
                fallback={2}
                onChange={(winsNeeded) => update('suit', { winsNeeded })}
              />
            </ConfigCard>

            <ConfigCard
              title="Liar's Dice"
              badge='dice'
              description='Jumlah dadu awal masing-masing pemain.'
            >
              <NumberField
                label='Dadu Awal per Pemain'
                hint='1–10 dadu'
                value={config.dice.startDice}
                min={1}
                max={10}
                fallback={5}
                onChange={(startDice) => update('dice', { startDice })}
              />
            </ConfigCard>

            <ConfigCard
              title='Dart'
              badge='dart'
              description='Pengaturan default mode, tingkat kesulitan, dan ronde.'
            >
              <SelectField
                label='Mode Default'
                value={config.dart.mode}
                options={[
                  { value: '501', label: '501' },
                  { value: '301', label: '301' },
                  { value: 'countup', label: 'Count Up' },
                  { value: 'clock', label: 'Around the Clock' },
                  { value: 'cricket', label: 'Cricket' },
                ]}
                onChange={(mode) => update('dart', { mode })}
              />
              <div className='grid grid-cols-2 gap-2'>
                <NumberField
                  label='Skor Awal (301/501)'
                  hint='61–1001'
                  value={config.dart.startScore}
                  min={61}
                  max={1001}
                  fallback={501}
                  onChange={(startScore) => update('dart', { startScore })}
                />
                <SelectField
                  label='Mode Lempar'
                  value={config.dart.throwMode}
                  options={[
                    { value: 'casual', label: 'Casual' },
                    { value: 'skill', label: 'Skill' },
                  ]}
                  onChange={(throwMode) => update('dart', { throwMode })}
                />
                <SelectField
                  label='Kesulitan'
                  value={config.dart.difficulty}
                  options={[
                    { value: 'easy', label: 'Easy' },
                    { value: 'normal', label: 'Normal' },
                    { value: 'hard', label: 'Hard' },
                  ]}
                  onChange={(difficulty) => update('dart', { difficulty })}
                />
                <NumberField
                  label='Ronde Count Up'
                  hint={rangeHint(COUNTUP_ROUNDS)}
                  value={config.dart.rounds}
                  {...COUNTUP_ROUNDS}
                  fallback={8}
                  onChange={(rounds) => update('dart', { rounds })}
                />
                <NumberField
                  label='Maks Ronde'
                  hint='0 = tanpa batas'
                  value={config.dart.maxRounds}
                  min={0}
                  max={50}
                  fallback={0}
                  onChange={(maxRounds) => update('dart', { maxRounds })}
                />
              </div>
              <ToggleField
                label='Wajib Double Out (301/501)'
                checked={config.dart.doubleOut}
                onChange={(doubleOut) => update('dart', { doubleOut })}
              />
              <ToggleField
                label='Around the Clock: selesai di Bull'
                checked={config.dart.clockBull}
                onChange={(clockBull) => update('dart', { clockBull })}
              />
            </ConfigCard>

            <ConfigCard
              title='Three Monkeys'
              badge='monkeys'
              description='Default mode, level campaign, dan spesifikasi bom custom.'
            >
              <SelectField
                label='Mode Default'
                value={config.monkeys.mode}
                options={[
                  { value: 'campaign', label: 'Campaign' },
                  { value: 'practice', label: 'Practice' },
                  { value: 'custom', label: 'Custom' },
                  { value: 'endless', label: 'Endless' },
                ]}
                onChange={(mode) => update('monkeys', { mode })}
              />
              <div className='grid grid-cols-2 gap-2'>
                <NumberField
                  label='Level Awal'
                  hint={`1–${CAMPAIGN.length}`}
                  value={config.monkeys.level}
                  min={1}
                  max={CAMPAIGN.length}
                  fallback={1}
                  onChange={(level) => update('monkeys', { level })}
                />
                <SelectField
                  label='Pembagian Peran'
                  value={config.monkeys.roles}
                  options={[
                    { value: 'random', label: 'Acak' },
                    { value: 'host', label: 'Dipilih Host' },
                  ]}
                  onChange={(roles) => update('monkeys', { roles })}
                />
                <NumberField
                  label='Modul Custom'
                  hint={rangeHint(MONKEY_CUSTOM_LIMITS.modules)}
                  value={config.monkeys.custom.modules}
                  {...MONKEY_CUSTOM_LIMITS.modules}
                  fallback={3}
                  onChange={(modules) =>
                    update('monkeys', {
                      custom: { ...config.monkeys.custom, modules },
                    })
                  }
                />
                <NumberField
                  label='Waktu Custom (dtk)'
                  hint={rangeHint(MONKEY_CUSTOM_LIMITS.seconds)}
                  value={config.monkeys.custom.seconds}
                  {...MONKEY_CUSTOM_LIMITS.seconds}
                  fallback={120}
                  onChange={(seconds) =>
                    update('monkeys', {
                      custom: { ...config.monkeys.custom, seconds },
                    })
                  }
                />
                <NumberField
                  label='Batas Salah Custom'
                  hint={rangeHint(MONKEY_CUSTOM_LIMITS.mistakes)}
                  value={config.monkeys.custom.strikes}
                  {...MONKEY_CUSTOM_LIMITS.mistakes}
                  fallback={3}
                  onChange={(strikes) =>
                    update('monkeys', {
                      custom: { ...config.monkeys.custom, strikes },
                    })
                  }
                />
              </div>
            </ConfigCard>
          </div>
        </div>
      )}
    </div>
  );
}
