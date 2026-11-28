'use client';

import * as React from 'react';

import ToolShell from '@/features/tools/components/ToolShell';

type Mode = 'equal' | 'items';

interface BillItem {
  id: string;
  name: string;
  price: number;
  participants: string[];
}

function formatRp(n: number): string {
  return `Rp ${Math.round(n).toLocaleString('id-ID')}`;
}

export default function SplitBillPage() {
  const [mode, setMode] = React.useState<Mode>('equal');
  const [copied, setCopied] = React.useState(false);

  // Equal split state
  const [totalStr, setTotalStr] = React.useState('150000');
  const [peopleCount, setPeopleCount] = React.useState(3);
  const [taxPct, setTaxPct] = React.useState(10);
  const [servicePct, setServicePct] = React.useState(5);

  // Per-item split state
  const [people, setPeople] = React.useState<string[]>([
    'Andi',
    'Budi',
    'Citra',
  ]);
  const [newPerson, setNewPerson] = React.useState('');
  const [items, setItems] = React.useState<BillItem[]>([
    { id: '1', name: 'Nasi Goreng', price: 45000, participants: ['Andi'] },
    {
      id: '2',
      name: 'Ayam Bakar',
      price: 55000,
      participants: ['Budi', 'Citra'],
    },
  ]);
  const [itemName, setItemName] = React.useState('');
  const [itemPrice, setItemPrice] = React.useState('');

  const equalSubtotal = Math.max(0, Number(totalStr) || 0);
  const equalMultiplier = 1 + (taxPct + servicePct) / 100;
  const equalGrandTotal = equalSubtotal * equalMultiplier;
  const perPerson = peopleCount > 0 ? equalGrandTotal / peopleCount : 0;

  const perItemTotals = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of people) map[p] = 0;
    for (const item of items) {
      const valid = item.participants.filter((p) => p in map);
      if (valid.length === 0) continue;
      const share = item.price / valid.length;
      for (const p of valid) map[p] += share;
    }
    const mult = 1 + (taxPct + servicePct) / 100;
    for (const p of Object.keys(map)) map[p] *= mult;
    return map;
  }, [people, items, taxPct, servicePct]);

  const itemsSubtotal = items.reduce((sum, it) => sum + it.price, 0);
  const itemsGrandTotal = itemsSubtotal * (1 + (taxPct + servicePct) / 100);

  const addPerson = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newPerson.trim();
    if (!name || people.includes(name)) return;
    setPeople([...people, name]);
    setNewPerson('');
  };

  const addItem = (e: React.FormEvent) => {
    e.preventDefault();
    const name = itemName.trim();
    const price = Number(itemPrice);
    if (!name || !Number.isFinite(price) || price <= 0) return;
    setItems([
      ...items,
      {
        id: `${Date.now()}`,
        name,
        price,
        participants: [...people],
      },
    ]);
    setItemName('');
    setItemPrice('');
  };

  const toggleParticipant = (itemId: string, person: string) => {
    setItems((list) =>
      list.map((it) => {
        if (it.id !== itemId) return it;
        const exists = it.participants.includes(person);
        return {
          ...it,
          participants: exists
            ? it.participants.filter((p) => p !== person)
            : [...it.participants, person],
        };
      }),
    );
  };

  const copySummary = async () => {
    let text = '';
    if (mode === 'equal') {
      text = [
        'Ringkasan Patungan (Bagi Rata)',
        `Subtotal: ${formatRp(equalSubtotal)}`,
        `Pajak ${taxPct}% + Servis ${servicePct}%`,
        `Total: ${formatRp(equalGrandTotal)}`,
        `Dibagi ${peopleCount} orang = ${formatRp(perPerson)} / orang`,
      ].join('\n');
    } else {
      const lines = people.map(
        (p) => `- ${p}: ${formatRp(perItemTotals[p] ?? 0)}`,
      );
      text = [
        'Ringkasan Patungan (Per Item)',
        `Subtotal: ${formatRp(itemsSubtotal)} (+Pajak ${taxPct}% & Servis ${servicePct}%)`,
        `Total: ${formatRp(itemsGrandTotal)}`,
        '',
        ...lines,
      ].join('\n');
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <ToolShell
      title='Split Bill / Patungan'
      description='Hitung pembagian tagihan bagi rata atau per-item lengkap dengan pajak & servis.'
      wide
    >
      <div className='mb-5 flex flex-wrap items-center justify-between gap-3'>
        <div className='flex gap-2'>
          <button
            type='button'
            onClick={() => setMode('equal')}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
              mode === 'equal'
                ? 'border-transparent bg-ink text-paper'
                : 'border-line-strong text-[var(--mute)] hover:text-ink'
            }`}
          >
            Bagi Rata
          </button>
          <button
            type='button'
            onClick={() => setMode('items')}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
              mode === 'items'
                ? 'border-transparent bg-ink text-paper'
                : 'border-line-strong text-[var(--mute)] hover:text-ink'
            }`}
          >
            Per Item
          </button>
        </div>

        <button
          type='button'
          onClick={copySummary}
          className='rounded-lg border border-line-strong px-3.5 py-1.5 text-xs transition hover:border-accent hover:text-accent'
        >
          {copied ? 'Ringkasan Tersalin' : 'Salin Ringkasan'}
        </button>
      </div>

      {mode === 'equal' ? (
        <div className='grid gap-6 md:grid-cols-2'>
          <div className='flex flex-col gap-4 rounded-xl border border-line bg-surface/50 p-4'>
            <label className='flex flex-col gap-1.5 text-xs text-[var(--mute)]'>
              Subtotal Tagihan (Rp)
              <input
                type='number'
                min={0}
                value={totalStr}
                onChange={(e) => setTotalStr(e.target.value)}
                className='rounded-lg border border-line-strong bg-paper px-3 py-2 font-mono text-sm text-ink'
              />
            </label>

            <label className='flex flex-col gap-1.5 text-xs text-[var(--mute)]'>
              Jumlah Orang
              <input
                type='number'
                min={1}
                max={100}
                value={peopleCount}
                onChange={(e) =>
                  setPeopleCount(Math.max(1, Number(e.target.value) || 1))
                }
                className='rounded-lg border border-line-strong bg-paper px-3 py-2 font-mono text-sm text-ink'
              />
            </label>

            <div className='grid grid-cols-2 gap-3'>
              <label className='flex flex-col gap-1.5 text-xs text-[var(--mute)]'>
                Pajak (%)
                <input
                  type='number'
                  min={0}
                  max={100}
                  value={taxPct}
                  onChange={(e) =>
                    setTaxPct(Math.max(0, Number(e.target.value) || 0))
                  }
                  className='rounded-lg border border-line-strong bg-paper px-3 py-2 font-mono text-sm text-ink'
                />
              </label>
              <label className='flex flex-col gap-1.5 text-xs text-[var(--mute)]'>
                Servis (%)
                <input
                  type='number'
                  min={0}
                  max={100}
                  value={servicePct}
                  onChange={(e) =>
                    setServicePct(Math.max(0, Number(e.target.value) || 0))
                  }
                  className='rounded-lg border border-line-strong bg-paper px-3 py-2 font-mono text-sm text-ink'
                />
              </label>
            </div>
          </div>

          <div className='flex flex-col justify-center gap-3 rounded-xl border border-line bg-surface/50 p-5'>
            <span className='text-xs text-[var(--mute)]'>Per Orang</span>
            <div className='font-mono text-3xl font-semibold text-accent'>
              {formatRp(perPerson)}
            </div>
            <div className='border-t border-line pt-3 text-xs text-[var(--mute)]'>
              Total akhir:{' '}
              <span className='text-ink'>{formatRp(equalGrandTotal)}</span>{' '}
              (termasuk pajak {taxPct}% + servis {servicePct}%)
            </div>
          </div>
        </div>
      ) : (
        <div className='grid gap-6 md:grid-cols-[1fr_280px]'>
          <div className='flex flex-col gap-4'>
            {/* People */}
            <div className='rounded-xl border border-line bg-surface/50 p-4'>
              <form onSubmit={addPerson} className='mb-3 flex gap-2'>
                <input
                  type='text'
                  placeholder='Tambah nama teman...'
                  value={newPerson}
                  onChange={(e) => setNewPerson(e.target.value)}
                  className='flex-1 rounded-lg border border-line-strong bg-paper px-3 py-1.5 text-sm text-ink'
                />
                <button
                  type='submit'
                  className='rounded-lg bg-ink px-3.5 py-1.5 text-xs font-medium text-paper'
                >
                  + Orang
                </button>
              </form>
              <div className='flex flex-wrap gap-1.5'>
                {people.map((p) => (
                  <span
                    key={p}
                    className='inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-paper px-2.5 py-1 text-xs'
                  >
                    {p}
                    {people.length > 1 && (
                      <button
                        type='button'
                        onClick={() => setPeople(people.filter((x) => x !== p))}
                        className='text-[var(--mute)] hover:text-err'
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>

            {/* Add item */}
            <form
              onSubmit={addItem}
              className='flex flex-col gap-2 rounded-xl border border-line bg-surface/50 p-4 sm:flex-row'
            >
              <input
                type='text'
                placeholder='Nama menu / item'
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className='flex-1 rounded-lg border border-line-strong bg-paper px-3 py-1.5 text-sm text-ink'
              />
              <input
                type='number'
                min={0}
                placeholder='Harga (Rp)'
                value={itemPrice}
                onChange={(e) => setItemPrice(e.target.value)}
                className='w-full rounded-lg border border-line-strong bg-paper px-3 py-1.5 font-mono text-sm text-ink sm:w-36'
              />
              <button
                type='submit'
                className='rounded-lg bg-ink px-3.5 py-1.5 text-xs font-medium text-paper'
              >
                + Item
              </button>
            </form>

            {/* Items list */}
            <ul className='flex flex-col gap-2'>
              {items.map((it) => (
                <li
                  key={it.id}
                  className='rounded-xl border border-line bg-surface/50 p-3.5'
                >
                  <div className='flex items-center justify-between gap-2'>
                    <span className='font-medium text-ink'>{it.name}</span>
                    <div className='flex items-center gap-3'>
                      <span className='font-mono text-sm text-accent'>
                        {formatRp(it.price)}
                      </span>
                      <button
                        type='button'
                        onClick={() =>
                          setItems(items.filter((x) => x.id !== it.id))
                        }
                        className='text-xs text-[var(--mute)] hover:text-err'
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                  <div className='mt-2.5 flex flex-wrap gap-1.5'>
                    {people.map((p) => {
                      const active = it.participants.includes(p);
                      return (
                        <button
                          key={p}
                          type='button'
                          onClick={() => toggleParticipant(it.id, p)}
                          className={`rounded-full border px-2.5 py-0.5 text-xs transition ${
                            active
                              ? 'border-accent bg-accent/15 text-ink'
                              : 'border-line text-[var(--mute)]'
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Summary */}
          <div className='flex flex-col gap-3 self-start rounded-xl border border-line bg-surface/50 p-4'>
            <div className='grid grid-cols-2 gap-2'>
              <label className='flex flex-col gap-1 text-xs text-[var(--mute)]'>
                Pajak (%)
                <input
                  type='number'
                  min={0}
                  value={taxPct}
                  onChange={(e) =>
                    setTaxPct(Math.max(0, Number(e.target.value) || 0))
                  }
                  className='rounded-lg border border-line-strong bg-paper px-2.5 py-1.5 font-mono text-xs text-ink'
                />
              </label>
              <label className='flex flex-col gap-1 text-xs text-[var(--mute)]'>
                Servis (%)
                <input
                  type='number'
                  min={0}
                  value={servicePct}
                  onChange={(e) =>
                    setServicePct(Math.max(0, Number(e.target.value) || 0))
                  }
                  className='rounded-lg border border-line-strong bg-paper px-2.5 py-1.5 font-mono text-xs text-ink'
                />
              </label>
            </div>

            <div className='border-t border-line pt-3'>
              <h2 className='mb-2 text-xs font-medium text-[var(--mute)]'>
                Tagihan per Orang
              </h2>
              <ul className='flex flex-col gap-2'>
                {people.map((p) => (
                  <li
                    key={p}
                    className='flex items-center justify-between text-sm'
                  >
                    <span>{p}</span>
                    <span className='font-mono font-medium text-accent'>
                      {formatRp(perItemTotals[p] ?? 0)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className='border-t border-line pt-3 text-xs text-[var(--mute)]'>
              Total:{' '}
              <span className='font-mono text-ink'>
                {formatRp(itemsGrandTotal)}
              </span>
            </div>
          </div>
        </div>
      )}
    </ToolShell>
  );
}
