import Link from 'next/link';
import type { CashEvent } from '@fb/types';
import { reservedForBills } from '@fb/engine';
import { loadEngineView } from '@/lib/engine-view';
import { listOwn } from '@/lib/db';
import { listTransactions } from '@/lib/transactions';
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
  MANUAL: 'Expense',
};

export default async function ReservedPage() {
  const { input } = await loadEngineView();
  const reserved = reservedForBills(input);

  const [subRows, lifeRows, txns] = await Promise.all([
    listOwn('subscriptions', 'id,name'),
    listOwn('life_cost_categories', 'id,category'),
    listTransactions({ limit: 200 }),
  ]);
  const nameById = new Map<string, string>();
  for (const o of input.obligations) nameById.set(o.id, o.name);
  for (const g of input.goals) nameById.set(g.id, g.name);
  for (const r of subRows) nameById.set(r.id, String(r.name));
  for (const r of lifeRows) nameById.set(r.id, String(r.category));
  for (const t of txns) if (t.name) nameById.set(t.id, t.name);

  const windows = [
    { label: 'This week', cents: reserved.thisWeekCents },
    { label: reserved.hasPayday ? 'Before payday' : 'Next 90 days', cents: reserved.untilPaydayCents },
    { label: 'This month', cents: reserved.thisMonthCents },
    { label: '90-day total', cents: reserved.horizonCents },
  ];

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <Link href="/home" className="text-sm font-bold text-violet600">← Home</Link>
      <h1 className="mt-3 text-2xl font-extrabold text-ink900">Reserved for bills</h1>
      <p className="mt-1 text-sm text-ink600">
        Money already committed to required bills and living costs — set aside before it counts as
        available.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {windows.map((w) => (
          <Card key={w.label} className="p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-ink600">{w.label}</p>
            <p className="mt-1 font-num text-2xl font-bold text-ink900">
              {centsToWholeDollars(w.cents)}
            </p>
          </Card>
        ))}
      </div>

      <h2 className="mt-8 text-lg font-extrabold text-ink900">What&apos;s reserved</h2>
      {reserved.items.length === 0 ? (
        <p className="mt-3 text-sm text-ink600">Nothing committed in the next 90 days.</p>
      ) : (
        <Card className="mt-3">
          {reserved.items.map((it, i) => (
            <div
              key={`${it.sourceId}-${it.date}-${i}`}
              className="flex items-center justify-between gap-3 border-t border-line py-3 first:border-t-0"
            >
              <span className="w-12 shrink-0 text-xs text-ink600">{it.date.slice(5)}</span>
              <span className="flex-1 truncate text-ink900">
                {nameById.get(it.sourceId) ?? KIND_LABEL[it.kind]}
                <span className="ml-2 text-xs text-ink600">{KIND_LABEL[it.kind]}</span>
              </span>
              <span className="font-num text-neg">-{centsToDollars(it.amountCents)}</span>
            </div>
          ))}
        </Card>
      )}
    </main>
  );
}
