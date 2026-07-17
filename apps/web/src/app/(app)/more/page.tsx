import Link from 'next/link';
import { Icon, type IconName } from '@/components/Icon';
import { Logo } from '@/components/brand';

export const dynamic = 'force-dynamic';

interface MoreLink {
  href: string;
  label: string;
  hint: string;
  icon: IconName;
}

// Grouped so the daily-money tools sit above setup/records.
const GROUPS: { title: string; items: MoreLink[] }[] = [
  {
    title: 'Understand',
    items: [
      { href: '/goals', label: 'Goals', hint: 'Am I on track?', icon: 'target' },
      { href: '/plan/priorities', label: 'Priorities', hint: 'What should I pay first?', icon: 'list' },
      { href: '/insights', label: 'Insights', hint: 'How am I doing?', icon: 'chart' },
      { href: '/freedom', label: 'Freedom Plan', hint: 'Leaving employment', icon: 'sparkle' },
      { href: '/brain', label: 'Financial Brain', hint: 'Ask anything', icon: 'chat' },
    ],
  },
  {
    title: 'Your money',
    items: [
      { href: '/accounts', label: 'Accounts', hint: 'Balances', icon: 'bank' },
      { href: '/income', label: 'Income', hint: 'What comes in', icon: 'wallet' },
      { href: '/obligations', label: 'Obligations', hint: 'Bills you owe', icon: 'list' },
      { href: '/subscriptions', label: 'Subscriptions', hint: 'Recurring charges', icon: 'repeat' },
      { href: '/life-costs', label: 'Life costs', hint: 'Everyday spending', icon: 'wallet' },
      { href: '/settings', label: 'Settings', hint: 'Preferences', icon: 'gear' },
    ],
  },
];

export default function MorePage() {
  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <div className="flex items-center gap-3">
        <Logo size={36} />
        <div>
          <h1 className="text-2xl font-extrabold text-ink900">More</h1>
          <p className="text-sm text-ink600">Everything Financial Brain can do.</p>
        </div>
      </div>

      {GROUPS.map((group) => (
        <section key={group.title} className="mt-8">
          <h2 className="text-xs font-bold uppercase tracking-wide text-ink600">{group.title}</h2>
          <ul className="mt-3 overflow-hidden rounded-card bg-white shadow-card">
            {group.items.map((item) => (
              <li key={item.href} className="border-t border-line first:border-t-0">
                <Link href={item.href} className="flex items-center gap-4 px-5 py-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-button bg-violet100 text-violet600">
                    <Icon name={item.icon} size={22} />
                  </span>
                  <span className="flex-1">
                    <span className="block font-bold text-ink900">{item.label}</span>
                    <span className="block text-sm text-ink600">{item.hint}</span>
                  </span>
                  <Icon name="caret-right" size={18} className="text-ink600" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
