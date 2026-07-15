import Link from 'next/link';
import type { CashEvent } from '@fb/types';
import { loadEngineView } from '@/lib/engine-view';
import { centsToWholeDollars, centsToDollars } from '@/lib/money';
import { Card } from '@/components/ui';

export const dynamic = 'force-dynamic';

function greeting(tz: string): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz }).format(
      new Date(),
    ),
  );
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const KIND_LABEL: Record<CashEvent['kind'], string> = {
  INCOME: 'Income',
  OBLIGATION: 'Bill',
  LIFE_COST: 'Living cost',
  SUBSCRIPTION: 'Subscription',
  GOAL_CONTRIBUTION: 'Goal',
  PLANNED_PURCHASE: 'Planned purchase',
};

export default async function HomePage() {
  const { output, input, clock } = await loadEngineView();
  const s = output.safeToSpend;

  const obligationName = new Map(input.obligations.map((o) => [o.id, o.name]));
  const nextMoves = output.urgency
    .map((u) => ({ ...u, name: obligationName.get(u.obligationId) ?? 'Obligation' }))
    .filter((u) => {
      const ob = input.obligations.find((o) => o.id === u.obligationId);
      return ob && !ob.resolved;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const urgentCount = nextMoves.filter((u) => u.score >= 70).length;
  const nextFunding = input.fundingEvents.find((f) => f.date > clock.today);
  const alreadyNeeded = s.currentLiquidCashCents - s.lowestProjectedCashCents;

  const timeline = [...input.events]
    .filter((e) => e.date >= clock.today)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .slice(0, 6);

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <p className="text-muted">{greeting(clock.timezone)}, Malika.</p>

      <Card className="mt-5 text-center">
        <p className="text-6xl font-semibold text-forest">
          {centsToWholeDollars(s.safeToSpendCents)}
        </p>
        <p className="mt-1 text-sm uppercase tracking-wide text-muted">Safe to spend</p>
        {nextFunding && <p className="mt-1 text-sm text-muted">until {nextFunding.date}</p>}
        <p className="mt-4 text-sm text-muted">
          You have {centsToWholeDollars(s.currentLiquidCashCents)} available, but{' '}
          {centsToWholeDollars(alreadyNeeded)} is needed for upcoming obligations and{' '}
          {centsToWholeDollars(s.safetyBufferCents)} is protected.
        </p>
        <Link
          href="/home/safe-to-spend"
          className="mt-3 inline-block text-sm text-forest underline"
        >
          Why?
        </Link>
      </Card>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Mini
          label="Daily flexible"
          value={s.dailyFlexibilityCents != null ? centsToDollars(s.dailyFlexibilityCents) : '—'}
        />
        <Mini
          label="Next money in"
          value={nextFunding ? centsToWholeDollars(nextFunding.amountCents) : '—'}
          sub={nextFunding?.date}
        />
        <Mini label="Needs attention" value={`${urgentCount}`} sub="urgent" />
      </div>

      <Link
        href="/ask"
        className="mt-5 block rounded-2xl bg-forest px-6 py-4 text-center font-medium text-cream"
      >
        Can I afford something?
      </Link>

      <h2 className="mt-8 text-lg font-semibold text-forest">Your next money moves</h2>
      {nextMoves.length > 0 ? (
        <ul className="mt-3 space-y-3">
          {nextMoves.map((m, i) => (
            <li key={m.obligationId}>
              <Card className="flex items-center justify-between">
                <div>
                  <p className="text-ink">
                    <span className="text-muted">{i + 1}. </span>
                    {m.name}
                  </p>
                  <p className="text-sm text-muted">Urgency {m.score}</p>
                </div>
                <Link href="/plan/priorities" className="text-sm text-forest underline">
                  Plan
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">
          You&apos;re current on your critical obligations. Your next focus is your buffer and
          goals.
        </p>
      )}

      <h2 className="mt-8 text-lg font-semibold text-forest">Upcoming</h2>
      <ul className="mt-3 rounded-card bg-white/60 px-6 py-2 shadow-card">
        {timeline.map((e, i) => (
          <li
            key={`${e.sourceId}-${e.date}-${i}`}
            className="flex items-center justify-between border-t border-sage/20 py-3 first:border-t-0"
          >
            <span className="text-sm text-muted">{e.date}</span>
            <span className="text-ink">{KIND_LABEL[e.kind]}</span>
            <span className={e.amountCents >= 0 ? 'text-forest' : 'text-ink'}>
              {e.amountCents >= 0 ? '+' : ''}
              {centsToDollars(e.amountCents)}
            </span>
          </li>
        ))}
        {timeline.length === 0 && <li className="py-3 text-sm text-muted">No upcoming events.</li>}
      </ul>
    </main>
  );
}

function Mini({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-card bg-white p-4 shadow-card">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}
