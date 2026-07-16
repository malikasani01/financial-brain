import Link from 'next/link';
import type { CashEvent, LedgerPeriod } from '@fb/types';
import { buildPaycheckLedger } from '@fb/engine';
import { loadEngineView } from '@/lib/engine-view';
import { listOwn } from '@/lib/db';
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

export default async function LedgerPage() {
  const { input } = await loadEngineView();
  const ledger = buildPaycheckLedger(input);

  // Resolve names for lines and period headers (events carry only a sourceId).
  const [subRows, lifeRows, incomeRows] = await Promise.all([
    listOwn('subscriptions', 'id,name'),
    listOwn('life_cost_categories', 'id,category'),
    listOwn('income_sources', 'id,name'),
  ]);
  const nameById = new Map<string, string>();
  for (const o of input.obligations) nameById.set(o.id, o.name);
  for (const g of input.goals) nameById.set(g.id, g.name);
  for (const r of subRows) nameById.set(r.id, String(r.name));
  for (const r of lifeRows) nameById.set(r.id, String(r.category));
  for (const r of incomeRows) nameById.set(r.id, String(r.name));

  const incomeLabel = (p: LedgerPeriod): string => {
    const names = p.incomeSourceIds.map((id) => nameById.get(id)).filter(Boolean);
    return names.length > 0 ? names.join(' + ') : 'Paycheck';
  };

  const dips = ledger.lowestCents < ledger.safetyBufferCents;

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <Link href="/plan" className="text-sm text-forest underline underline-offset-4">
        Back
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-forest">Paycheck ledger</h1>
      <p className="mt-1 text-sm text-muted">
        Your running balance, paycheck by paycheck — every bill subtracted in date order, the same
        way you&apos;d track it by hand. Numbers come straight from your plan.
      </p>

      <div
        className={`mt-5 rounded-2xl px-4 py-3 text-sm ${
          ledger.lowestCents < 0
            ? 'bg-terracotta/10 text-terracotta'
            : dips
              ? 'bg-amber-500/10 text-amber-700'
              : 'bg-forest/10 text-forest'
        }`}
      >
        Lowest point in view: {centsToDollars(ledger.lowestCents)}.{' '}
        {ledger.lowestCents < 0
          ? 'Your balance goes negative — something needs to move.'
          : dips
            ? `This dips below your ${centsToWholeDollars(ledger.safetyBufferCents)} safety buffer.`
            : `You stay above your ${centsToWholeDollars(ledger.safetyBufferCents)} safety buffer throughout.`}
      </div>

      {ledger.periods.length === 0 && (
        <p className="mt-8 text-sm text-muted">
          Nothing scheduled yet. Add income and bills and your ledger will fill in.
        </p>
      )}

      <div className="mt-6 space-y-6">
        {ledger.periods.map((p, pi) => (
          <section key={`${p.incomeDate ?? 'onhand'}-${pi}`}>
            <div className="flex items-baseline justify-between">
              <div>
                <p className="font-medium text-forest">
                  {p.incomeDate ? incomeLabel(p) : 'Cash on hand'}
                </p>
                {p.incomeDate && <p className="text-xs text-muted">{p.incomeDate}</p>}
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-muted">Available</p>
                <p className="font-semibold text-ink">{centsToDollars(p.availableCents)}</p>
              </div>
            </div>

            <ul className="mt-2 rounded-card bg-white/60 px-5 py-1 shadow-card">
              {p.lines.length === 0 && (
                <li className="py-3 text-sm text-muted">Nothing due this period.</li>
              )}
              {p.lines.map((l, li) => (
                <li
                  key={`${l.sourceId}-${l.date}-${li}`}
                  className={`flex items-center justify-between gap-2 border-t border-sage/20 py-3 first:border-t-0 ${
                    l.negative
                      ? 'text-terracotta'
                      : l.belowBuffer
                        ? 'text-amber-700'
                        : 'text-ink'
                  }`}
                >
                  <span className="w-14 shrink-0 text-xs text-muted">{l.date.slice(5)}</span>
                  <span className="flex-1 truncate">
                    {nameById.get(l.sourceId) ?? KIND_LABEL[l.kind]}
                    <span className="ml-2 text-xs text-muted">{KIND_LABEL[l.kind]}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">{centsToDollars(l.amountCents)}</span>
                  <span className="w-20 shrink-0 text-right font-medium tabular-nums">
                    {centsToDollars(l.runningCents)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
