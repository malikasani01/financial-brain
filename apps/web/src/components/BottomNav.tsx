'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/Icon';

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  center?: boolean;
  /** Extra path prefixes that should light this tab up as active. */
  match?: string[];
}

const ITEMS: NavItem[] = [
  { href: '/home', label: 'Home', icon: 'house' },
  { href: '/calendar', label: 'Calendar', icon: 'calendar' },
  { href: '/ask', label: 'Ask', icon: 'chat', center: true },
  { href: '/plan', label: 'Plan', icon: 'plan' },
  {
    href: '/more',
    label: 'More',
    icon: 'dots',
    // The secondary screens live under More.
    match: [
      '/goals',
      '/priorities',
      '/accounts',
      '/income',
      '/obligations',
      '/subscriptions',
      '/life-costs',
      '/insights',
      '/transactions',
      '/freedom',
      '/brain',
      '/settings',
    ],
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const isActive = (item: NavItem) =>
    pathname === item.href ||
    pathname.startsWith(`${item.href}/`) ||
    (item.match?.some((m) => pathname === m || pathname.startsWith(`${m}/`)) ?? false);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-paper/95 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-md items-end justify-around px-4 py-2">
        {ITEMS.map((item) => {
          const active = isActive(item);
          if (item.center) {
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                className="-mt-6 flex h-16 w-16 flex-col items-center justify-center rounded-full bg-violet500 text-white shadow-card"
              >
                <Icon name={item.icon} size={24} />
                <span className="mt-0.5 text-[11px] font-bold">{item.label}</span>
              </Link>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-bold ${
                active ? 'text-violet600' : 'text-ink600'
              }`}
            >
              <Icon name={item.icon} size={24} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
