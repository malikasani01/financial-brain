'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/Icon';
import { Logo } from '@/components/brand';

const ITEMS: { href: string; label: string; icon: IconName; match?: string[] }[] = [
  { href: '/home', label: 'Home', icon: 'house' },
  { href: '/calendar', label: 'Calendar', icon: 'calendar' },
  { href: '/plan', label: 'Plan', icon: 'plan' },
  { href: '/ask', label: 'Ask', icon: 'chat' },
  { href: '/transactions', label: 'Transactions', icon: 'list' },
  { href: '/goals', label: 'Goals', icon: 'target' },
  { href: '/insights', label: 'Insights', icon: 'chart' },
  { href: '/brain', label: 'Financial Brain', icon: 'sparkle' },
  { href: '/more', label: 'More', icon: 'dots', match: ['/accounts', '/income', '/obligations', '/subscriptions', '/life-costs', '/freedom', '/settings', '/reserved'] },
];

/** Desktop-only left rail. Hidden on mobile (the bottom nav covers that). */
export function Sidebar() {
  const pathname = usePathname();
  const active = (i: (typeof ITEMS)[number]) =>
    pathname === i.href ||
    pathname.startsWith(`${i.href}/`) ||
    (i.match?.some((m) => pathname === m || pathname.startsWith(`${m}/`)) ?? false);

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-paper px-4 py-6 lg:flex">
      <Link href="/home" className="mb-6 flex items-center gap-2 px-2">
        <Logo size={32} />
        <span className="text-lg font-extrabold text-ink900">Financial Brain</span>
      </Link>
      <nav className="flex flex-col gap-1">
        {ITEMS.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={`flex items-center gap-3 rounded-button px-3 py-2.5 text-sm font-bold ${
              active(i) ? 'bg-violet100 text-violet600' : 'text-ink600 hover:bg-line/50'
            }`}
          >
            <Icon name={i.icon} size={22} />
            {i.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
