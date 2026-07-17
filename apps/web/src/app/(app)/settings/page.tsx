import Link from 'next/link';
import { loadEngineView } from '@/lib/engine-view';
import { centsToWholeDollars } from '@/lib/money';
import { dollarsInput } from '@/lib/db';
import { Card } from '@/components/ui';
import { SaveButton } from '@/components/SaveButton';
import { setSafetyBuffer } from '@/app/actions/financial';
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

export default async function SettingsPage() {
  const { output } = await loadEngineView();
  const bufferCents = output.safetyBufferCents;
  const recommendedCents = output.recommendedBufferCents;

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <Link href="/more" className="text-sm font-bold text-violet600">← More</Link>
      <h1 className="mt-3 text-2xl font-extrabold text-ink900">Settings</h1>

      {/* Safety buffer */}
      <Card className="mt-5">
        <p className="font-bold text-ink900">Safety buffer</p>
        <p className="mt-1 text-sm text-ink600">
          Cash Financial Brain always keeps in reserve — it&apos;s protected from Safe to Spend and
          never suggested for savings, so you keep a cushion in your account.
        </p>
        <form action={setSafetyBuffer} className="mt-4 grid gap-3">
          <label className="block text-sm font-semibold text-ink600">
            Amount to keep
            <input
              name="buffer"
              inputMode="decimal"
              defaultValue={dollarsInput(bufferCents)}
              placeholder="$0.00"
              className="mt-1 w-full rounded-input border border-line bg-white px-4 py-3 outline-none focus:border-violet500"
            />
          </label>
          <p className="text-xs text-ink600">
            Recommended for your situation: {centsToWholeDollars(recommendedCents)}. Leave blank to
            use the recommendation.
          </p>
          <SaveButton label="Save buffer" />
        </form>
      </Card>

      <h2 className="mt-8 text-xs font-bold uppercase tracking-wide text-ink600">Manage</h2>
      <ul className="mt-3 overflow-hidden rounded-card bg-white shadow-card">
        {LINKS.map((l) => (
          <li key={l.href} className="border-t border-line first:border-t-0">
            <Link href={l.href} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="font-bold text-ink900">{l.label}</p>
                <p className="text-sm text-ink600">{l.sub}</p>
              </div>
              <span className="text-violet600">›</span>
            </Link>
          </li>
        ))}
      </ul>

      <form action={signOut} className="mt-8">
        <button className="text-sm font-bold text-violet600">Sign out</button>
      </form>
    </main>
  );
}
