import Link from 'next/link';
import type { CashEvent } from '@fb/types';
import { loadEngineView } from '@/lib/engine-view';
import { centsToDollars, centsToWholeDollars } from '@/lib/money';
import { Card } from '@/components/ui';

export const dynamic = 'force-dynamic';

const KIND_LABEL: Record<CashEvent['kind'], string> = {
  INCOME: 'Income',
  OBLIGATION: 'Bill',
  LIFE_COST: 'Living cost',
  SUBSCRIPTION: 'Subscription',
  GOAL_CONTRIBUTION: 'Goal',
  PLANNED_PURCHASE: 'Planned purchase',
};

export default async function PlanPage() {
  const { input, output, clock } = await loadEngineView();
  const s = output.safeToSpend;

  const nextFunding = input.fundingEvents.find((f) => f.date > clock.today);
  const until = nextFunding?.date;

  // Outflows that must be covered before the next paycheck lands.
  const beforeNext = input.events
    .filter(
      (e) =>
        e.amountCents < 0 && e.date >= clock.today && (!nextFunding || e.date <= nextFunding.date),
    )
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const beforeNextTotal = beforeNext.reduce((t, e) => t + e.amountCents, 0);

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <h1 className="text-2xl font-semibold text-forest">Paycheck plan</h1>

      <Card className="mt-6">
        <p className="text-sm uppercase tracking-wide text-muted">Next money in</p>
        {nextFunding ? (
          <>
            <p className="mt-1 text-3xl font-semibold text-forest">
              {centsToWholeDollars(nextFunding.amountCents)}
            </p>
            <p className="text-sm text-muted">on {nextFunding.date}</p>
          </>
        ) : (
          <p className="mt-1 text-muted">No confirmed income scheduled.</p>
        )}
        {s.dailyFlexibilityCents != null && (
          <p className="mt-3 border-t border-sage/20 pt-3 text-sm text-muted">
            {centsToDollars(s.dailyFlexibilityCents)} per day flexible{' '}
            {until ? `until ${until}` : ''}
          </p>
        )}
      </Card>

      <h2 className="mt-8 text-lg font-semibold text-forest">
        What must be covered {nextFunding ? 'before then' : 'soon'}
      </h2>
      <ul className="mt-3 rounded-card bg-white/60 px-6 py-2 shadow-card">
        {beforeNext.map((e, i) => (
          <li
            key={`${e.sourceId}-${e.date}-${i}`}
            className="flex items-center justify-between border-t border-sage/20 py-3 first:border-t-0"
          >
            <span className="text-sm text-muted">{e.date}</span>
            <span className="text-ink">{KIND_LABEL[e.kind]}</span>
            <span className="text-ink">{centsToDollars(e.amountCents)}</span>
          </li>
        ))}
        {beforeNext.length === 0 && <li className="py-3 text-sm text-muted">Nothing due yet.</li>}
      </ul>
      {beforeNext.length > 0 && (
        <p className="mt-2 text-right text-sm text-muted">
          Total: {centsToDollars(beforeNextTotal)}
        </p>
      )}

      <div className="mt-8 space-y-3">
        <Link
          href="/plan/priorities"
          className="block rounded-2xl border border-forest px-6 py-4 text-center font-medium text-forest"
        >
          What needs your money first?
        </Link>
        <Link
          href="/plan/allocate"
          className="block rounded-2xl bg-forest px-6 py-4 text-center font-medium text-cream"
        >
          I have money — what should I pay?
        </Link>
      </div>
    </main>
  );
}
