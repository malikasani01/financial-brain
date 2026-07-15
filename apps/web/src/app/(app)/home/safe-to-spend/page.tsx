import Link from 'next/link';
import { loadEngineView } from '@/lib/engine-view';
import { centsToDollars } from '@/lib/money';
import { Card } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function SafeToSpendDetailPage() {
  const { output } = await loadEngineView();
  const s = output.safeToSpend;
  const needed =
    s.totalRequiredObligationsCents +
    s.totalPlannedEssentialCents +
    s.totalCommittedGoalContribCents;

  const rows: { label: string; value: number; muted?: boolean }[] = [
    { label: 'Available now', value: s.currentLiquidCashCents },
    { label: 'Confirmed income (next 90 days)', value: s.totalConfirmedIncomeCents },
    { label: 'Required obligations', value: -s.totalRequiredObligationsCents },
    { label: 'Normal life costs', value: -s.totalPlannedEssentialCents },
    { label: 'Goal contributions', value: -s.totalCommittedGoalContribCents },
    { label: 'Safety buffer', value: -s.safetyBufferCents },
  ];

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <Link href="/home" className="text-sm text-forest underline underline-offset-4">
        Back
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-forest">
        Why is my Safe to Spend {centsToDollars(s.safeToSpendCents)}?
      </h1>

      <Card className="mt-6">
        <ul>
          {rows.map((r) => (
            <li
              key={r.label}
              className="flex items-center justify-between border-t border-sage/20 py-3 first:border-t-0"
            >
              <span className="text-muted">{r.label}</span>
              <span className={r.value < 0 ? 'text-terracotta' : 'text-ink'}>
                {r.value >= 0 ? '' : '-'}
                {centsToDollars(Math.abs(r.value))}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mt-4">
        <div className="flex items-center justify-between">
          <span className="text-muted">Lowest projected cash</span>
          <span className="text-ink">{centsToDollars(s.lowestProjectedCashCents)}</span>
        </div>
        <p className="mt-1 text-sm text-muted">on {s.lowestCashDate}</p>
        <div className="mt-4 flex items-center justify-between border-t border-sage/20 pt-4">
          <span className="font-medium text-forest">Safe to spend</span>
          <span className="text-2xl font-semibold text-forest">
            {centsToDollars(s.safeToSpendCents)}
          </span>
        </div>
      </Card>

      <p className="mt-6 text-sm text-muted">
        Money already assigned to a future obligation is not counted as available spending money. Of
        your balance, {centsToDollars(needed)} is spoken for before your forecast&apos;s low point.
      </p>

      <Link href="/plan" className="mt-6 inline-block text-forest underline">
        View 90-day plan
      </Link>
    </main>
  );
}
