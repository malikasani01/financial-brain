'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  center?: boolean;
}

const ITEMS: NavItem[] = [
  { href: '/home', label: 'Home' },
  { href: '/plan', label: 'Plan' },
  { href: '/ask', label: 'Ask', center: true },
  { href: '/goals', label: 'Goals' },
  { href: '/brain', label: 'Brain' },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-sage/20 bg-cream/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-end justify-around px-4 py-2">
        {ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          if (item.center) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="-mt-6 flex h-16 w-16 flex-col items-center justify-center rounded-full bg-forest text-cream shadow-card"
              >
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center py-2 text-sm ${
                active ? 'font-semibold text-forest' : 'text-muted'
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
