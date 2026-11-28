'use client';

import * as React from 'react';

import ToolShell from '@/features/tools/components/ToolShell';

type Category = 'length' | 'weight' | 'temp' | 'data' | 'time';

const UNIT_FACTORS: Record<
  'length' | 'weight' | 'data',
  Record<string, { label: string; factor: number }>
> = {
  length: {
    mm: { label: 'Milimeter (mm)', factor: 0.001 },
    cm: { label: 'Sentimeter (cm)', factor: 0.01 },
    m: { label: 'Meter (m)', factor: 1 },
    km: { label: 'Kilometer (km)', factor: 1000 },
    in: { label: 'Inci (in)', factor: 0.0254 },
    ft: { label: 'Kaki (ft)', factor: 0.3048 },
    mi: { label: 'Mil (mi)', factor: 1609.344 },
  },
  weight: {
    mg: { label: 'Miligram (mg)', factor: 0.001 },
    g: { label: 'Gram (g)', factor: 1 },
    kg: { label: 'Kilogram (kg)', factor: 1000 },
    oz: { label: 'Ons (oz)', factor: 28.349523125 },
    lb: { label: 'Pound (lb)', factor: 453.59237 },
  },
  data: {
    B: { label: 'Byte (B)', factor: 1 },
    KB: { label: 'Kilobyte (KB)', factor: 1024 },
    MB: { label: 'Megabyte (MB)', factor: 1024 ** 2 },
    GB: { label: 'Gigabyte (GB)', factor: 1024 ** 3 },
    TB: { label: 'Terabyte (TB)', factor: 1024 ** 4 },
  },
};

const ZONES = [
  { id: 'Asia/Jakarta', label: 'WIB (Jakarta)' },
  { id: 'Asia/Makassar', label: 'WITA (Makassar)' },
  { id: 'Asia/Jayapura', label: 'WIT (Jayapura)' },
  { id: 'Asia/Singapore', label: 'SGT (Singapura)' },
  { id: 'Asia/Tokyo', label: 'JST (Tokyo)' },
  { id: 'UTC', label: 'UTC' },
  { id: 'Europe/London', label: 'London' },
  { id: 'America/New_York', label: 'New York (ET)' },
];

function convertTemp(val: number, from: string): Record<string, number> {
  const c =
    from === 'C' ? val : from === 'F' ? ((val - 32) * 5) / 9 : val - 273.15;
  return {
    C: c,
    F: (c * 9) / 5 + 32,
    K: c + 273.15,
  };
}

export default function ConvertToolPage() {
  const [cat, setCat] = React.useState<Category>('length');
  const [valueStr, setValueStr] = React.useState('1');
  const [fromUnit, setFromUnit] = React.useState('km');
  const [hourStr, setHourStr] = React.useState('14:00');
  const [sourceZoneOffset, setSourceZoneOffset] = React.useState(7);

  const changeCategory = (next: Category) => {
    setCat(next);
    if (next === 'length') setFromUnit('km');
    else if (next === 'weight') setFromUnit('kg');
    else if (next === 'data') setFromUnit('MB');
    else if (next === 'temp') setFromUnit('C');
  };

  const num = Number(valueStr) || 0;

  const unitResults = React.useMemo(() => {
    if (cat === 'time') return [];
    if (cat === 'temp') {
      const t = convertTemp(num, fromUnit);
      return [
        { key: 'C', label: 'Celsius (°C)', val: t.C },
        { key: 'F', label: 'Fahrenheit (°F)', val: t.F },
        { key: 'K', label: 'Kelvin (K)', val: t.K },
      ];
    }
    const table = UNIT_FACTORS[cat];
    const base = num * (table[fromUnit]?.factor ?? 1);
    return Object.entries(table).map(([key, info]) => ({
      key,
      label: info.label,
      val: base / info.factor,
    }));
  }, [cat, num, fromUnit]);

  const timeResults = React.useMemo(() => {
    if (cat !== 'time') return [];
    const [hh, mm] = hourStr.split(':').map((x) => Number(x) || 0);
    const now = new Date();
    const utcMs =
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        hh,
        mm,
      ) -
      sourceZoneOffset * 3600_000;
    const instant = new Date(utcMs);
    return ZONES.map((z) => ({
      ...z,
      formatted: new Intl.DateTimeFormat('id-ID', {
        timeZone: z.id,
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'short',
        hour12: false,
      }).format(instant),
    }));
  }, [cat, hourStr, sourceZoneOffset]);

  const cats: { id: Category; label: string }[] = [
    { id: 'length', label: 'Panjang' },
    { id: 'weight', label: 'Berat' },
    { id: 'temp', label: 'Suhu' },
    { id: 'data', label: 'Data' },
    { id: 'time', label: 'Zona Waktu' },
  ];

  return (
    <ToolShell
      title='Konverter Unit & Jam'
      description='Konversi cepat satuan panjang, berat, suhu, ukuran data, serta perbandingan zona waktu.'
    >
      <div className='mb-5 flex flex-wrap gap-2'>
        {cats.map((c) => (
          <button
            key={c.id}
            type='button'
            onClick={() => changeCategory(c.id)}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
              cat === c.id
                ? 'border-transparent bg-ink text-paper'
                : 'border-line-strong text-[var(--mute)] hover:text-ink'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {cat !== 'time' ? (
        <div className='flex flex-col gap-4'>
          <div className='grid gap-3 rounded-xl border border-line bg-surface/50 p-4 sm:grid-cols-2'>
            <label className='flex flex-col gap-1.5 text-xs text-[var(--mute)]'>
              Nilai
              <input
                type='number'
                value={valueStr}
                onChange={(e) => setValueStr(e.target.value)}
                className='rounded-lg border border-line-strong bg-paper px-3 py-2 font-mono text-sm text-ink'
              />
            </label>
            <label className='flex flex-col gap-1.5 text-xs text-[var(--mute)]'>
              Dari Satuan
              <select
                value={fromUnit}
                onChange={(e) => setFromUnit(e.target.value)}
                className='rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink'
              >
                {cat === 'temp' ? (
                  <>
                    <option value='C'>Celsius (°C)</option>
                    <option value='F'>Fahrenheit (°F)</option>
                    <option value='K'>Kelvin (K)</option>
                  </>
                ) : (
                  Object.entries(UNIT_FACTORS[cat]).map(([k, info]) => (
                    <option key={k} value={k}>
                      {info.label}
                    </option>
                  ))
                )}
              </select>
            </label>
          </div>

          <ul className='grid gap-2.5 sm:grid-cols-2'>
            {unitResults.map((r) => (
              <li
                key={r.key}
                className='flex items-center justify-between rounded-xl border border-line bg-surface/50 px-4 py-3'
              >
                <span className='text-xs text-[var(--mute)]'>{r.label}</span>
                <span className='font-mono text-sm font-semibold text-ink'>
                  {Number.isInteger(r.val)
                    ? r.val.toLocaleString('id-ID')
                    : Number(r.val.toFixed(6)).toString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className='flex flex-col gap-4'>
          <div className='grid gap-3 rounded-xl border border-line bg-surface/50 p-4 sm:grid-cols-2'>
            <label className='flex flex-col gap-1.5 text-xs text-[var(--mute)]'>
              Jam
              <input
                type='time'
                value={hourStr}
                onChange={(e) => setHourStr(e.target.value)}
                className='rounded-lg border border-line-strong bg-paper px-3 py-2 font-mono text-sm text-ink'
              />
            </label>
            <label className='flex flex-col gap-1.5 text-xs text-[var(--mute)]'>
              Zona Asal
              <select
                value={sourceZoneOffset}
                onChange={(e) => setSourceZoneOffset(Number(e.target.value))}
                className='rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink'
              >
                <option value={7}>WIB (UTC+7)</option>
                <option value={8}>WITA / SGT (UTC+8)</option>
                <option value={9}>WIT / JST (UTC+9)</option>
                <option value={0}>UTC (UTC+0)</option>
                <option value={-5}>New York (UTC-5)</option>
              </select>
            </label>
          </div>

          <ul className='grid gap-2.5 sm:grid-cols-2'>
            {timeResults.map((z) => (
              <li
                key={z.id}
                className='flex items-center justify-between rounded-xl border border-line bg-surface/50 px-4 py-3'
              >
                <span className='text-xs text-[var(--mute)]'>{z.label}</span>
                <span className='font-mono text-sm font-semibold text-accent'>
                  {z.formatted}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ToolShell>
  );
}
