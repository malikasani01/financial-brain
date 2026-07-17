import Link from 'next/link';
import { addDays, addMonths } from '@fb/engine';
import { loadEngineView } from '@/lib/engine-view';
import { listTransactions } from '@/lib/transactions';
import { centsToDollars, centsToWholeDollars } from '@/lib/money';
import { Card } from '@/components/ui';

export const dynamic = 'force-dynamic';

const PERIODS = [
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'lastmonth', label: 'Last month' },
  { key: '90', label: 'Last 90 days' },
  { key: 'ytd', label: 'Year to date' },
  { key: 'all', label: 'All' },
] as const;
type PeriodKey = (typeof PERIODS)[number]['key'];

/** Inclusive [start, end] window for a period, relative to today. */
function windowFor(key: PeriodKey, today: string): { start: string; end: string; label: string } {
  const monthStart = `${today.slice(0, 7)}-01`;
  switch (key) {
    case 'week':
      return { start: addDays(today, -6), end: today, label: 'the last 7 days' };
    case 'lastmonth': {
      const lm = addMonths(monthStart, -1);
      return { start: lm, end: addDays(monthStart, -1), label: 'last month' };
    }
    case '90':
      return { start: addDays(today, -89), end: today, label: 'the last 90 days' };
    case 'ytd':
      return { start: `${today.slice(0, 4)}-01-01`, end: today, label: 'this year' };
    case 'all':
      return { start: '0000-01-01', end: today, label: 'all time' };
    case 'month':
    default:
      return { start: monthStart, end: today, label: 'this month' };
  }
}

// Warm, distinct category swatches (decorative — not money meaning).
const SWATCHES = ['#6C4CFF', '#1FAE6B', '#F0A93B', '#2E6BFF', '#C46A4E', '#8FA99A', '#C9BFFF', '#5B5868'];

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const { p } = await searchParams;
  const period = (PERIODS.find((x) => x.key === p)?.key ?? 'month') as PeriodKey;
  const { output, clock } = await loadEngineView();
  const today = clock.today;
  const w = windowFor(period, today);

  const txns = await listTransactions({ limit: 1000 });
  const inWindow = txns.filter(
    (t) => t.status === 'cleared' && t.txn_date >= w.start && t.txn_date <= w.end,
  );
  const incomeCents = inWindow.filter((t) => t.direction === 'income').reduce((s, t) => s + t.amount_cents, 0);
  const spentCents = inWindow.filter((t) => t.direction === 'expense').reduce((s, t) => s + t.amount_cents, 0);
  const netCents = incomeCents - spentCents;

  const byCategory = new Map<string, number>();
  for (const t of inWindow) {
    if (t.direction !== 'expense') continue;
    const cat = t.category ?? 'Uncategorized';
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + t.amount_cents);
  }
  const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  const topCategory = categories[0];

  const days = Math.max(1, Math.min(daysBetweenLocal(w.start, w.end), daysBetweenLocal(w.start, today)) + 1);
  const avgDailyCents = Math.round(spentCents / days);

  const goals = output.goalFeasibility.filter((g) => g.status !== 'COMPLETED');
  const goalsOnTrack = goals.filter((g) => g.status === 'ON_TRACK').length;

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <h1 className="text-2xl font-extrabold text-ink900">Insights</h1>
      <p className="mt-1 text-sm text-ink600">How your money is moving.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {PERIODS.map((x) => (
          <Link
            key={x.key}
            href={`/insights?p=${x.key}`}
            className={`rounded-full px-3 py-1.5 text-sm font-bold ${
              x.key === period ? 'bg-violet500 text-white' : 'border border-line text-ink600'
            }`}
          >
            {x.label}
          </Link>
        ))}
      </div>

      {/* Headline metrics */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Metric label="Income" cents={incomeCents} tone="pos" />
        <Metric label="Spent" cents={spentCents} tone="neg" />
        <Metric label="Net" cents={netCents} tone={netCents >= 0 ? 'pos' : 'neg'} signed />
      </div>

      {/* Review summary — number first */}
      <Card className="mt-4">
        <p className="text-sm text-ink900">
          {inWindow.length === 0 ? (
            <>No cleared transactions {w.label} yet. Record or clear a few and your review will fill in.</>
          ) : (
            <>
              You brought in{' '}
              <span className="font-num font-bold text-pos">{centsToDollars(incomeCents)}</span> and
              spent{' '}
              <span className="font-num font-bold text-neg">{centsToDollars(spentCents)}</span>{' '}
              {w.label} — a net of{' '}
              <span className={`font-num font-bold ${netCents >= 0 ? 'text-pos' : 'text-neg'}`}>
                {netCents >= 0 ? '+' : ''}
                {centsToDollars(netCents)}
              </span>
              . {topCategory ? `Most went to ${topCategory[0]} (${centsToDollars(topCategory[1])}). ` : ''}
              That&apos;s about {centsToDollars(avgDailyCents)} a day.
            </>
          )}
        </p>
        <p className="mt-3 border-t border-line pt-3 text-sm text-ink600">
          Right now, <span className="font-num font-bold text-pos">{centsToWholeDollars(output.safeToSpend.safeToSpendCents)}</span>{' '}
          is safe to spend
          {goals.length > 0 && <>, and {goalsOnTrack} of {goals.length} goals are on track</>}.
        </p>
      </Card>

      {/* Spending by category */}
      <h2 className="mt-8 text-lg font-extrabold text-ink900">Spending by category</h2>
      {categories.length === 0 ? (
        <p className="mt-3 text-sm text-ink600">No spending recorded {w.label}.</p>
      ) : (
        <Card className="mt-3">
          {categories.map(([cat, cents], i) => {
            const pct = spentCents > 0 ? Math.round((cents / spentCents) * 100) : 0;
            return (
              <div key={cat} className="border-t border-line py-3 first:border-t-0">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-ink900">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: SWATCHES[i % SWATCHES.length] }} />
                    {cat}
                  </span>
                  <span className="font-num font-bold text-ink900">{centsToDollars(cents)}</span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: SWATCHES[i % SWATCHES.length] }}
                  />
                </div>
              </div>
            );
          })}
          <div className="mt-2 flex items-center justify-between border-t border-line pt-3">
            <span className="font-bold text-ink900">Total spent</span>
            <span className="font-num font-bold text-neg">{centsToDollars(spentCents)}</span>
          </div>
        </Card>
      )}

      <p className="mt-6 text-center text-sm">
        <Link href="/transactions" className="font-bold text-violet600">See all transactions</Link>
      </p>
    </main>
  );
}

/** Local calendar-day difference (avoids importing engine just for this). */
function daysBetweenLocal(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

function Metric({
  label,
  cents,
  tone,
  signed = false,
}: {
  label: string;
  cents: number;
  tone: 'pos' | 'neg';
  signed?: boolean;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-ink600">{label}</p>
      <p className={`mt-1 font-num text-xl font-bold ${tone === 'pos' ? 'text-pos' : 'text-neg'}`}>
        {signed && cents >= 0 ? '+' : ''}
        {centsToDollars(cents)}
      </p>
    </Card>
  );
}
