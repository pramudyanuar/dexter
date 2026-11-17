'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/games', label: 'Games' },
  { href: '/tools', label: 'Tools' },
  { href: '/ai', label: 'AI' },
] as const;

export default function TopNav() {
  const pathname = usePathname();

  return (
    <nav aria-label='Navigasi utama' className='mb-5 flex items-center'>
      <div className='inline-flex items-center gap-1 rounded-full border border-line bg-surface/60 p-1'>
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`rounded-full px-4 py-1 text-sm font-medium transition-colors ${
                active
                  ? 'bg-ink text-paper'
                  : 'text-[var(--mute)] hover:text-ink'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
