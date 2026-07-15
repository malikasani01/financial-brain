import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadEngineView } from '@/lib/engine-view';
import { centsToDollars, centsToWholeDollars } from '@/lib/money';
import { Card } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { input, output } = await loadEngineView();
  const goal = input.goals.find((g) => g.id === id);
  const f = output.goalFeasibility.find((x) => x.goalId === id);
  if (!goal || !f) notFound();

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <Link href="/goals" className="text-sm text-forest underline underline-offset-4">
        Back
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-forest">{goal.name}</h1>

      <Card className="mt-6">
        <Row label="Target" value={centsToWholeDollars(goal.targetCents)} />
        <Row label="Saved" value={centsToWholeDollars(goal.savedCents)} />
        <Row label="Remaining" value={centsToDollars(f.remainingCents)} />
        {goal.targetDate && <Row label="Target date" value={goal.targetDate} />}
        <Row
          label="Estimated completion"
          value={f.estimatedCompletionDate ?? 'Not at current pace'}
        />
      </Card>

      <Card className="mt-4">
        <Row
          label="Committed per paycheck"
          value={centsToDollars(goal.committedPerPaycheckCents)}
        />
        <Row label="Needed per paycheck" value={centsToDollars(f.requiredPerPaycheckCents)} />
        <Row label="Needed per month" value={centsToDollars(f.requiredPerMonthCents)} />
      </Card>

      <div
        className={`mt-6 rounded-2xl px-4 py-3 text-sm ${
          f.feasible ? 'bg-forest/10 text-forest' : 'bg-terracotta/10 text-terracotta'
        }`}
      >
        {f.feasible
          ? 'Your committed pace reaches this goal on time.'
          : goal.targetDate
            ? `Your current committed pace can't reach this by ${goal.targetDate}. Short by ${centsToDollars(
                f.shortfallCents,
              )}. Increase the per-paycheck amount, move the date, or free up cash elsewhere.`
            : 'Set a committed per-paycheck amount to start moving toward this goal.'}
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-t border-sage/20 py-3 first:border-t-0">
      <span className="text-muted">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}
