import Link from 'next/link';
import { Card } from '@/components/ui';
import { signOut } from '../actions';

export const dynamic = 'force-dynamic';

const LINKS = [
  { href: '/accounts', label: 'Accounts', sub: 'Update balances, add or remove' },
  { href: '/income', label: 'Income', sub: 'Sources, mark money received' },
  { href: '/obligations', label: 'Obligations', sub: 'Record payments, mark resolved' },
  { href: '/subscriptions', label: 'Subscriptions', sub: 'Pause or cancel' },
  { href: '/life-costs', label: 'Normal life costs', sub: 'Choose planning amounts' },
  { href: '/freedom', label: 'Freedom plan', sub: 'Your freedom number & scenarios' },
];

export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <Link href="/home" className="text-sm text-forest underline underline-offset-4">
        Back
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-forest">Manage</h1>

      <ul className="mt-6 space-y-3">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href}>
              <Card className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-ink">{l.label}</p>
                  <p className="text-sm text-muted">{l.sub}</p>
                </div>
                <span className="text-forest">›</span>
              </Card>
            </Link>
          </li>
        ))}
      </ul>

      <form action={signOut} className="mt-8">
        <button className="text-sm text-forest underline underline-offset-4">Sign out</button>
      </form>
    </main>
  );
}
